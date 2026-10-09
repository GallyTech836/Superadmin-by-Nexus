import { useState, useEffect, useCallback } from 'react';
import { collectionGroup, getDocs, getCountFromServer, getAggregateFromServer, query, where, sum } from 'firebase/firestore';
import { db } from '../firebase/config';

function monthRange(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  const last = new Date(y, m + 1, 0).getDate();
  return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(last)}`, label: `${y}-${pad(m + 1)}` };
}

// Conteo barato con agregación de servidor; si falla (reglas/índices), cae
// a getDocs para no dejar el dashboard vacío.
async function safeCount(q) {
  try {
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    const snap = await getDocs(q);
    return snap.size;
  }
}

/**
 * Métricas globales de la plataforma (todas las cuentas de un vistazo).
 * Cada métrica se calcula por separado: si una falla, las demás siguen y
 * el error se reporta con su nombre.
 */
export function usePlatformStats() {
  const [stats, setStats] = useState({
    professionals: null, branches: null, clients: null, appointments: null,
    periodAppointments: null, periodRevenue: null, period: monthRange().label,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { start, end, label } = monthRange();
    const results = { period: label };
    const errors = [];

    const tasks = {
      professionals: () => safeCount(collectionGroup(db, 'profesionales')),
      branches: () => safeCount(collectionGroup(db, 'sucursales')),
      clients: () => safeCount(collectionGroup(db, 'clientes')),
      appointments: () => safeCount(collectionGroup(db, 'citas')),
      periodAppointments: () => safeCount(query(collectionGroup(db, 'citas'), where('date', '>=', start), where('date', '<=', end))),
      // Facturación de los negocios en el período: suma de price de
      // citas COMPLETADAS. Necesita un índice compuesto (status + date) en
      // el grupo `citas`; si no existe, Firestore devuelve el link para crearlo.
      periodRevenue: async () => {
        const q = query(collectionGroup(db, 'citas'), where('status', '==', 'completed'), where('date', '>=', start), where('date', '<=', end));
        const snap = await getAggregateFromServer(q, { total: sum('price') });
        return snap.data().total || 0;
      },
    };

    await Promise.all(Object.entries(tasks).map(async ([key, fn]) => {
      try {
        results[key] = await fn();
      } catch (err) {
        results[key] = null;
        errors.push(`${key}: ${err.message}`);
      }
    }));

    setStats(results);
    if (errors.length > 0) setError(errors.join(' | '));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...stats, loading, error, refresh };
}
