import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { computeEffectiveStatus, cleanOverrides } from '../shared/capabilityModel';

// Muchos negocios existentes se auto-crearon vía useNegocio.js en GallyFlow
// y NO tienen plan/status/subscriptionEnd todavía. Este normalizador les
// pone un default sensato sin tocar Firestore hasta que tú cambies algo
// explícitamente desde el panel.
// El estado efectivo (vencido por fecha, prueba vencida, suspendido) se
// calcula con computeEffectiveStatus del modelo compartido — el mismo
// criterio que usan Nexus y el backend.
function normalize(id, data) {
  const rawStatus = data.status || 'active';
  const subscriptionEnd = data.subscriptionEnd || null;
  const trialEnd = data.trialEnd || null;
  return {
    id,
    name: data.heroConfig?.businessName || data.name || data.slug || id,
    ownerName: data.ownerName || '',
    ownerEmail: data.email || '',
    phone: data.phone || '',
    country: data.country || '',
    city: data.city || '',
    // 'trial' era un valor fijo viejo (no es un ID de plan real).
    plan: data.plan && data.plan !== 'trial' ? data.plan : null,
    rawStatus,
    status: computeEffectiveStatus(rawStatus, subscriptionEnd, trialEnd),
    createdAt: data.createdAt ? data.createdAt.slice(0, 10) : '',
    subscriptionEnd,
    trialStart: data.trialStart || null,
    trialEnd,
    trialDays: data.trialDays || null,
    capabilityOverrides: data.capabilityOverrides || {},
    adminUid: data.adminUid || null,
    assistantConfig: data.assistantConfig || null,
    analyticsPinEnabled: data.analyticsPinEnabled === true,
    hasFinancePin: !!data.financePinHash,
  };
}

/**
 * Lee en tiempo real TODOS los negocios de GallyFlow (colección
 * `negocios`, misma que usa AdminApp/BarberApp/ClienteApp).
 */
export function useBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'negocios'), (snap) => {
      const list = snap.docs.map((d) => normalize(d.id, d.data()));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setBusinesses(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function updateStatus(id, status) {
    await updateDoc(doc(db, 'negocios', id), { status });
  }

  async function updatePlan(id, plan) {
    await updateDoc(doc(db, 'negocios', id), { plan: plan || null });
  }

  async function updateInfo(id, { name, ownerName, phone, country, city }) {
    await updateDoc(doc(db, 'negocios', id), {
      ownerName, phone, country, city,
      'heroConfig.businessName': name,
    });
  }

  async function updateSubscriptionEnd(id, subscriptionEnd) {
    await updateDoc(doc(db, 'negocios', id), { subscriptionEnd: subscriptionEnd || null });
  }

  /** Reemplaza TODAS las excepciones de capacidades del negocio. */
  async function updateOverrides(id, overrides) {
    await updateDoc(doc(db, 'negocios', id), { capabilityOverrides: cleanOverrides(overrides) });
  }

  /** Prueba gratuita: { trialStart, trialEnd, trialDays } y opcionalmente status. */
  async function updateTrial(id, { trialStart, trialEnd, trialDays, status }) {
    const patch = {
      trialStart: trialStart || null,
      trialEnd: trialEnd || null,
      trialDays: trialDays ? Number(trialDays) : null,
    };
    if (status) patch.status = status;
    await updateDoc(doc(db, 'negocios', id), patch);
  }

  return { businesses, loading, updateStatus, updatePlan, updateInfo, updateSubscriptionEnd, updateOverrides, updateTrial };
}
