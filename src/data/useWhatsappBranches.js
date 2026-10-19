import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/** Id del documento donde el backend cuenta los números que no se pudieron asociar a una sucursal (también con límite). */
export const NO_BRANCH_ID = 'sin-sucursal';

/**
 * Consumo del Asistente de WhatsApp POR SUCURSAL en un período:
 *   negocios/{id}/uso/{AAAA-MM}/sucursales/{sucursalId} = { enviados, nombre? }
 * (lo escribe el backend en cada respuesta del bot, según el número de
 * WhatsApp de la sucursal que recibió el mensaje).
 *
 * Se cruza con negocios/{id}/sucursales para mostrar también las sucursales
 * que aún no tienen respuestas este mes (en 0).
 *
 * Devuelve:
 *   rows     -> [{ id, name, enviados, linked }] ordenadas de mayor a menor
 *   atLimit  -> cuántas sucursales están AHORA en el límite (según el límite
 *               actual; si lo subes, el número baja solo)
 */
export function useWhatsappBranches(negocioId, period, branchLimit, enabled = true) {
  const [usageDocs, setUsageDocs] = useState([]);
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!negocioId || !period || !enabled) { setUsageDocs([]); return undefined; }
    const unsub = onSnapshot(
      collection(db, 'negocios', negocioId, 'uso', period, 'sucursales'),
      (snap) => {
        setUsageDocs(snap.docs.map((d) => ({ id: d.id, enviados: Number(d.data().enviados) || 0, nombre: d.data().nombre || '' })));
        setError(null);
      },
      (err) => setError(err.message),
    );
    return () => unsub();
  }, [negocioId, period, enabled]);

  useEffect(() => {
    if (!negocioId || !enabled) { setBranches([]); return undefined; }
    const unsub = onSnapshot(
      collection(db, 'negocios', negocioId, 'sucursales'),
      (snap) => setBranches(snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.data().nombre || d.id }))),
      () => setBranches([]), // sin permiso: se muestran solo las que tienen consumo
    );
    return () => unsub();
  }, [negocioId, enabled]);

  const byId = Object.fromEntries(usageDocs.map((u) => [u.id, u]));
  const rows = [
    ...branches.map((b) => ({ id: b.id, name: b.name, enviados: byId[b.id]?.enviados || 0, linked: true })),
    ...usageDocs
      .filter((u) => !branches.some((b) => b.id === u.id))
      .map((u) => ({
        id: u.id,
        name: u.id === NO_BRANCH_ID ? 'Sin sucursal asignada' : (u.nombre || u.id),
        enviados: u.enviados,
        linked: u.id !== NO_BRANCH_ID,
      })),
  ].sort((a, b) => b.enviados - a.enviados);

  const atLimit = typeof branchLimit === 'number'
    ? rows.filter((r) => r.enviados >= branchLimit).length
    : 0;

  return { rows, atLimit, error };
}
