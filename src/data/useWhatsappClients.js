import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit as qLimit, where, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Consumo del Asistente de WhatsApp POR CLIENTE en un período:
 *   negocios/{id}/uso/{AAAA-MM}/clientes/{celular} = { enviados }
 * (lo escribe el backend en cada respuesta del bot).
 *
 * Devuelve:
 *   top      -> los 3 clientes con más respuestas [{ phone, enviados }]
 *   atLimit  -> cuántos clientes están AHORA en el límite (según el límite
 *               actual; si lo subes, el número baja solo)
 */
export function useWhatsappClients(negocioId, period, clientLimit, enabled = true) {
  const [top, setTop] = useState([]);
  const [atLimit, setAtLimit] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!negocioId || !period || !enabled) { setTop([]); return undefined; }
    const ref = collection(db, 'negocios', negocioId, 'uso', period, 'clientes');
    const unsub = onSnapshot(
      query(ref, orderBy('enviados', 'desc'), qLimit(3)),
      (snap) => { setTop(snap.docs.map((d) => ({ phone: d.id, enviados: Number(d.data().enviados) || 0 }))); setError(null); },
      (err) => setError(err.message),
    );
    return () => unsub();
  }, [negocioId, period, enabled]);

  // Se recalcula cuando cambia el top (hay respuestas nuevas) o el límite.
  const topKey = top.map((t) => `${t.phone}:${t.enviados}`).join('|');
  useEffect(() => {
    if (!negocioId || !period || !enabled || typeof clientLimit !== 'number') { setAtLimit(null); return; }
    let cancel = false;
    const ref = collection(db, 'negocios', negocioId, 'uso', period, 'clientes');
    getCountFromServer(query(ref, where('enviados', '>=', clientLimit)))
      .then((s) => { if (!cancel) setAtLimit(s.data().count); })
      .catch(() => { if (!cancel) setAtLimit(top.filter((t) => t.enviados >= clientLimit).length); });
    return () => { cancel = true; };
  }, [negocioId, period, clientLimit, enabled, topKey]);

  return { top, atLimit, error };
}

/** "59171234567" -> "+591 71234567" */
export function formatPhone(phone) {
  const p = String(phone || '');
  if (p.startsWith('591') && p.length === 11) return `+591 ${p.slice(3)}`;
  return p ? `+${p}` : '—';
}
