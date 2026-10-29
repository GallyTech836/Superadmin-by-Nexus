import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { computeEffectiveStatus, cleanOverrides, normalizeAddons } from '../shared/capabilityModel';
import { isValidBusinessType, cleanTerminologyOverrides } from '../shared/businessProfileModel';
import { getLockedModules } from '../shared/pinLockModel';

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
    // Tipo de negocio. null = negocio anterior sin tipo (Nexus usa el fallback 'otro').
    businessType: isValidBusinessType(data.businessType) ? data.businessType : null,
    // Personalización de términos (solo textos). {} = usa los del tipo.
    terminologyOverrides: cleanTerminologyOverrides(data.terminologyOverrides),
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
    // Complementos contratados aparte del plan (profesionales extra, WhatsApp).
    addons: normalizeAddons(data.addons),
    adminUid: data.adminUid || null,
    assistantConfig: data.assistantConfig || null,
    analyticsPinEnabled: data.analyticsPinEnabled === true,
    // Módulos de Nexus que piden el PIN (negocios viejos: solo Analítica).
    pinLockedModules: getLockedModules(data),
    // El hash vive en negocioSecrets (Super Admin no lo lee); el backend
    // deja financePinSet en el negocio. financePinHash = negocios viejos.
    hasFinancePin: data.financePinSet === true || !!data.financePinHash,
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

  async function updateInfo(id, { name, ownerName, phone, country, city, businessType }) {
    await updateDoc(doc(db, 'negocios', id), {
      ownerName, phone, country, city,
      'heroConfig.businessName': name,
      // Solo se escribe si viene un tipo válido: nunca se borra el existente.
      ...(isValidBusinessType(businessType) ? { businessType } : {}),
    });
  }

  async function updateSubscriptionEnd(id, subscriptionEnd) {
    await updateDoc(doc(db, 'negocios', id), { subscriptionEnd: subscriptionEnd || null });
  }

  /** Reemplaza TODAS las excepciones de capacidades del negocio. */
  async function updateOverrides(id, overrides) {
    await updateDoc(doc(db, 'negocios', id), { capabilityOverrides: cleanOverrides(overrides) });
  }

  /** Complementos contratados: { profesionalesExtra, asistenteWhatsapp }. */
  async function updateAddons(id, addons) {
    await updateDoc(doc(db, 'negocios', id), { addons: normalizeAddons(addons) });
  }

  /** Reemplaza la terminología personalizada del negocio ({} = predeterminada). */
  async function updateTerminology(id, overrides) {
    await updateDoc(doc(db, 'negocios', id), { terminologyOverrides: cleanTerminologyOverrides(overrides) });
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

  return { businesses, loading, updateStatus, updatePlan, updateInfo, updateSubscriptionEnd, updateOverrides, updateTrial, updateTerminology, updateAddons };
}
