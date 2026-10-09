// Ciclos de cobro y utilidades de planes.
//
// El catálogo de FUNCIONES ya no vive aquí: está en
// src/shared/capabilityModel.js (mismo archivo que usan Nexus y el backend).
// Ningún nombre de plan ("Básico", "Pro"...) está escrito en el código:
// los planes se crean en la página Planes y se guardan en `planes/{id}`.

export const BILLING_CYCLES = [
  { key: 'free', label: 'Gratis', months: 0 },
  { key: 'monthly', label: 'Mensual', months: 1 },
  { key: 'quarterly', label: 'Trimestral', months: 3 },
  { key: 'yearly', label: 'Anual', months: 12 },
];

export const BILLING_LABELS = Object.fromEntries(BILLING_CYCLES.map((c) => [c.key, c.label]));

export const DEFAULT_TRIAL_DAYS = 14;

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(dateISO, days) {
  const d = dateISO ? new Date(`${dateISO}T12:00:00`) : new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

/**
 * Nueva fecha de vencimiento desde hoy según el ciclo de cobro del plan.
 * (Antes estaba duplicada en NegociosPage y SubscriptionsPage.)
 */
export function computeSubscriptionEnd(plan) {
  const cycle = plan?.billingCycle;
  const date = new Date();
  if (cycle === 'free') date.setDate(date.getDate() + (Number(plan?.trialDays) || DEFAULT_TRIAL_DAYS));
  else if (cycle === 'monthly') date.setMonth(date.getMonth() + 1);
  else if (cycle === 'quarterly') date.setMonth(date.getMonth() + 3);
  else if (cycle === 'yearly') date.setFullYear(date.getFullYear() + 1);
  else date.setDate(date.getDate() + 30); // sin plan: 30 días por defecto
  return date.toISOString().slice(0, 10);
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
