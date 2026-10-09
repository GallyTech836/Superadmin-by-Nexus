import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { buildPlanFeatures } from '../shared/capabilityModel';

/**
 * Planes reales, guardados en Firestore (colección `planes`, mismo
 * proyecto que GallyFlow).
 *
 * Forma de un plan:
 *   { name, description, price, currency, billingCycle, active, trialDays,
 *     features: { [capacidad]: true|false|{ enabled, limit } },
 *     createdAt, updatedAt }
 * `features` siempre se guarda COMPLETO (todas las capacidades explícitas),
 * ver buildPlanFeatures en capabilityModel.
 */
export function usePlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'planes'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, active: true, ...d.data() }));
      list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0) || (a.createdAt || '').localeCompare(b.createdAt || ''));
      setPlans(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function clean(data) {
    return {
      name: (data.name || '').trim(),
      description: (data.description || '').trim(),
      price: data.price === '' || data.price === null || data.price === undefined ? 0 : Number(data.price) || 0,
      currency: data.currency || 'Bs',
      billingCycle: data.billingCycle || 'monthly',
      active: data.active !== false,
      trialDays: data.trialDays ? Number(data.trialDays) : null,
      features: buildPlanFeatures(data.features || {}),
      updatedAt: new Date().toISOString(),
    };
  }

  async function createPlan(data) {
    const ref = await addDoc(collection(db, 'planes'), { ...clean(data), createdAt: new Date().toISOString() });
    return ref.id;
  }

  async function updatePlan(id, data) {
    await updateDoc(doc(db, 'planes', id), clean(data));
  }

  async function deletePlan(id) {
    await deleteDoc(doc(db, 'planes', id));
  }

  return { plans, loading, createPlan, updatePlan, deletePlan };
}
