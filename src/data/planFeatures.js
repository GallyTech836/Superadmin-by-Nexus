// Ciclos de cobro y utilidades de planes.
//
// El catálogo de FUNCIONES ya no vive aquí: está en
// src/shared/capabilityModel.js (mismo archivo que usan Nexus y el backend).
// Ningún nombre de plan ("Básico", "Pro"...) está escrito en el código:
// los planes se crean en la página Planes y se guardan en `planes/{id}`.

import { laPazDateKey, expiryDateKey } from '../shared/capabilityModel';

export const BILLING_CYCLES = [
  { key: 'free', label: 'Gratis', months: 0 },
  { key: 'monthly', label: 'Mensual', months: 1 },
  { key: 'quarterly', label: 'Trimestral', months: 3 },
  { key: 'yearly', label: 'Anual', months: 12 },
];

export const BILLING_LABELS = Object.fromEntries(BILLING_CYCLES.map((c) => [c.key, c.label]));

export const DEFAULT_TRIAL_DAYS = 14;

/**
 * Días de prueba del plan. 0 = el plan no tiene prueba (ej. Profesional, por
 * el costo de activar el Asistente de WhatsApp). Vacío = DEFAULT_TRIAL_DAYS.
 */
export function planTrialDays(plan) {
  if (plan && Number(plan.trialDays) === 0 && plan.trialDays !== null && plan.trialDays !== '') return 0;
  return Number(plan?.trialDays) || DEFAULT_TRIAL_DAYS;
}

/** Hoy "AAAA-MM-DD" en hora de La Paz (antes era UTC: después de las 20:00 daba mañana). */
export function todayISO() {
  return laPazDateKey();
}

export function addDaysISO(dateISO, days) {
  const d = new Date(`${dateISO || todayISO()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

/** Suma meses a "AAAA-MM-DD". Si el día no existe (31 → feb), queda en el último día del mes. */
export function addMonthsISO(dateISO, months) {
  const [y, m, d] = (dateISO || todayISO()).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + Number(months || 0), 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Suma un ciclo del plan a una fecha base. */
function addPlanCycle(baseISO, plan) {
  const cycle = plan?.billingCycle;
  if (cycle === 'free') return addDaysISO(baseISO, Number(plan?.trialDays) || DEFAULT_TRIAL_DAYS);
  if (cycle === 'monthly') return addMonthsISO(baseISO, 1);
  if (cycle === 'quarterly') return addMonthsISO(baseISO, 3);
  if (cycle === 'yearly') return addMonthsISO(baseISO, 12);
  return addDaysISO(baseISO, 30); // sin plan: 30 días por defecto
}

/**
 * Nueva fecha de vencimiento desde hoy según el ciclo de cobro del plan.
 * (Antes estaba duplicada en NegociosPage y SubscriptionsPage.)
 */
export function computeSubscriptionEnd(plan) {
  return addPlanCycle(todayISO(), plan);
}

/**
 * Renovación: suma un ciclo del plan desde el vencimiento actual si todavía no
 * pasó (pago adelantado: no se pierden días), o desde hoy si ya venció.
 */
export function computeRenewalEnd(plan, currentEnd) {
  const today = todayISO();
  const current = expiryDateKey(currentEnd);
  const base = current && current >= today ? current : today;
  return addPlanCycle(base, plan);
}

/** Precio mensual equivalente del plan (para MRR estimado). */
export function monthlyPrice(plan) {
  const price = Number(plan?.price) || 0;
  const cycle = BILLING_CYCLES.find((c) => c.key === plan?.billingCycle);
  if (!cycle || cycle.months === 0) return 0;
  return price / cycle.months;
}

export function formatPrice(plan) {
  const price = Number(plan?.price);
  if (!plan?.price && plan?.price !== 0) return '—';
  if (!price) return 'Gratis';
  return `${plan.currency || 'Bs'} ${price.toLocaleString('es-BO')}`;
}
