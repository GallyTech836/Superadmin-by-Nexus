import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit as qLimit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Clientes con más respuestas del Asistente de WhatsApp en un período
 * (solo informativo: el límite ahora es por sucursal, ver useWhatsappBranches):
 *   negocios/{id}/uso/{AAAA-MM}/clientes/{celular} = { enviados }
 * (lo escribe el backend en cada respuesta del bot).
 *
 * Devuelve:
 *   top -> los 3 clientes con más respuestas [{ phone, enviados }]
 */
export function useWhatsappClients(negocioId, period, enabled = true) {
  const [top, setTop] = useState([]);
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

  return { top, error };
}

/** "59171234567" -> "+591 71234567" */
export function formatPhone(phone) {
  const p = String(phone || '');
  if (p.startsWith('591') && p.length === 11) return `+591 ${p.slice(3)}`;
  return p ? `+${p}` : '—';
}
