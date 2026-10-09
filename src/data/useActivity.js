import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

/**
 * Bitácora real de acciones del Super Admin — colección propia
 * `superadmin_activity`, separada de cada negocio (es un log de la
 * plataforma, no de un tenant individual).
 *
 * Cada entrada guarda quién (actorEmail), cuándo (createdAt), sobre qué
 * negocio/plan (negocioId / planId) y, cuando aplica, el valor anterior y
 * el nuevo (before / after).
 */
export function useActivity() {
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'superadmin_activity'), orderBy('date', 'desc'), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // `date` es solo el día; se ordena fino por createdAt.
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setActivity(list);
    });
    return () => unsub();
  }, []);

  /**
   * @param {string} type         título corto ("Plan cambiado")
   * @param {string} description  texto legible
   * @param {object} [extra]      { negocioId, planId, capability, before, after }
   */
  async function pushActivity(type, description, extra = {}) {
    const user = auth.currentUser;
    const entry = {
      type,
      description,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      actorEmail: user?.email || null,
      actorUid: user?.uid || null,
    };
    for (const k of ['negocioId', 'planId', 'capability', 'before', 'after']) {
      // JSON ida y vuelta: Firestore no acepta `undefined` anidado.
      if (extra[k] !== undefined) entry[k] = JSON.parse(JSON.stringify(extra[k] ?? null));
    }
    try {
      await addDoc(collection(db, 'superadmin_activity'), entry);
    } catch (err) {
      // La bitácora nunca debe impedir la acción principal.
      console.warn('[activity] No se pudo registrar la actividad:', err.message);
    }
  }

  return { activity, pushActivity };
}
