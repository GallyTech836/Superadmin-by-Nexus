import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, getCountFromServer, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { usagePeriodKey } from '../shared/capabilityModel';

async function countCollection(ref) {
  try {
    const snap = await getCountFromServer(ref);
    return snap.data().count;
  } catch {
    // Fallback si las reglas no permiten agregaciones.
    const snap = await getDocs(ref);
    return snap.size;
  }
}

/**
 * Consumo de un negocio:
 *  - mensual: negocios/{id}/uso/{AAAA-MM} (lo escribe el backend)
 *  - cantidades actuales: profesionales y sucursales (conteo de documentos)
 */
export function useBusinessUsage(negocioId, period = usagePeriodKey()) {
  const [monthly, setMonthly] = useState({});
  const [counts, setCounts] = useState({ profesionales: null, sucursales: null });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!negocioId) return undefined;
    const unsub = onSnapshot(
      doc(db, 'negocios', negocioId, 'uso', period),
      (snap) => setMonthly(snap.exists() ? snap.data() : {}),
      (err) => setError(err.message),
    );
    return () => unsub();
  }, [negocioId, period]);

  const refreshCounts = useCallback(async () => {
    if (!negocioId) return;
    try {
      const [profesionales, sucursales] = await Promise.all([
        countCollection(collection(db, 'negocios', negocioId, 'profesionales')),
        countCollection(collection(db, 'negocios', negocioId, 'sucursales')),
      ]);
      setCounts({ profesionales, sucursales });
    } catch (err) {
      setError(err.message);
    }
  }, [negocioId]);

  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  /** Consumo actual de una capacidad según su definición en el catálogo. */
  function usedFor(cap) {
    if (!cap?.limit) return null;
    if (cap.kind === 'quota') return counts[cap.key] ?? null;
    if (cap.limit.usageKey) return Number(monthly[cap.limit.usageKey]) || 0;
    return null;
  }

  function rejectedFor(cap) {
    if (!cap?.limit?.usageKey) return 0;
    return Number(monthly.rechazados?.[cap.limit.usageKey]) || 0;
  }

  return { period, monthly, counts, usedFor, rejectedFor, refreshCounts, error };
}
