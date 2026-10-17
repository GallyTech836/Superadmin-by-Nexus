import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { buildPlanFeatures, ADDONS, LAUNCH_PLAN_PRESETS } from '../shared/capabilityModel';

/**
 * Planes reales, guardados en Firestore (colección `planes`, mismo
 * proyecto que GallyFlow).
 *
 * Forma de un plan:
 *   { name, description, price, currency, billingCycle, active, trialDays,
 *     vertical: 'citas' | 'restaurante' | null (plan anterior),
 *     order, setupFee,
 *     addons: { [complemento]: { available, price } },
 *     features: { [capacidad]: true|false|{ enabled, limit } },
 *     createdAt, updatedAt }
 * `features` siempre se guarda COMPLETO (todas las capacidades explícitas),
 * ver buildPlanFeatures en capabilityModel. Los campos nuevos son opcionales:
 * los planes anteriores siguen funcionando igual.
 */
export function usePlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'planes'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, active: true, ...d.data() }));
      list.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99)
        || (Number(a.price) || 0) - (Number(b.price) || 0)
        || (a.createdAt || '').localeCompare(b.createdAt || ''));
      setPlans(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function cleanAddons(raw = {}) {
    const out = {};
    for (const a of ADDONS) {
      const v = raw?.[a.key] || {};
      const price = Number(v.price);
      out[a.key] = {
        available: v.available !== false,
        price: v.price === '' || v.price === undefined || !Number.isFinite(price) || price < 0 ? a.defaultPrice : price,
      };
    }
    return out;
  }

  function clean(data) {
    const vertical = data.vertical || null;
    const setupFee = Number(data.setupFee);
    return {
      name: (data.name || '').trim(),
      description: (data.description || '').trim(),
      price: data.price === '' || data.price === null || data.price === undefined ? 0 : Number(data.price) || 0,
      currency: data.currency || 'Bs',
      billingCycle: data.billingCycle || 'monthly',
      active: data.active !== false,
      trialDays: data.trialDays ? Number(data.trialDays) : null,
      vertical,
      order: data.order === '' || data.order === undefined || data.order === null ? null : Number(data.order) || null,
      setupFee: Number.isFinite(setupFee) && setupFee > 0 ? setupFee : 0,
      addons: cleanAddons(data.addons),
      features: buildPlanFeatures(data.features || {}, { vertical }),
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

  /** Activar / desactivar sin tocar nada más. Los negocios que lo usan lo conservan. */
  async function setPlanActive(id, active) {
    await updateDoc(doc(db, 'planes', id), { active: !!active, updatedAt: new Date().toISOString() });
  }

  async function deletePlan(id) {
    await deleteDoc(doc(db, 'planes', id));
  }

  /**
   * Crea los planes de lanzamiento (Esencial, Profesional, Premium) con IDs
   * fijos. NUNCA reemplaza: si ya existe un documento con ese ID o un plan
   * con el mismo nombre, se omite. Devuelve { created: [...], skipped: [...] }.
   */
  async function seedLaunchPlans() {
    const created = [];
    const skipped = [];
    const names = new Set(plans.map((p) => (p.name || '').trim().toLowerCase()));
    for (const preset of LAUNCH_PLAN_PRESETS) {
      const { id, ...data } = preset;
      const ref = doc(db, 'planes', id);
      const snap = await getDoc(ref);
      if (snap.exists() || names.has(preset.name.toLowerCase())) {
        skipped.push(preset.name);
        continue;
      }
      const now = new Date().toISOString();
      await setDoc(ref, { ...clean(data), createdAt: now, seededFrom: 'launch-2026' });
      created.push(preset.name);
    }
    return { created, skipped };
  }

  return { plans, loading, createPlan, updatePlan, setPlanActive, deletePlan, seedLaunchPlans };
}
