// Seguimiento del Asistente de WhatsApp (mismo criterio que el backend:
// backend/services/assistantMetrics/assistantMetrics.js en el repo de Nexus).
//   negocios/{id}.assistantMetrics = { startDate: 'AAAA-MM-DD' | null, enabled: boolean }

export const TRACKING_LABELS = {
  medicion: 'En medición',
  pruebas: 'En pruebas',
  pausado: 'Seguimiento pausado',
};

export const TRACKING_TONES = { medicion: 'ok', pruebas: 'warn', pausado: 'neutral' };

export const CONVERSATION_LABELS = {
  reserva: 'Con reserva',
  reprogramacion: 'Reprogramación',
  humano: 'Pasó a una persona',
  abandonada: 'Abandonada',
  consulta: 'Solo consulta',
};

export function todayInLaPaz(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function trackingState(config, hoy = todayInLaPaz()) {
  if (config?.enabled === false) return 'pausado';
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(config?.startDate || '')) ? config.startDate : null;
  if (!start || start > hoy) return 'pruebas';
  return 'medicion';
}

/** "2026-11" -> "nov 2026" */
export function monthLabel(mes) {
  const [y, m] = String(mes).split('-').map(Number);
  if (!y || !m) return mes;
  return new Date(y, m - 1, 1).toLocaleDateString('es-BO', { month: 'short', year: 'numeric' }).replace('.', '');
}

/** "2026-11-05" -> "5 nov" */
export function dayLabel(fecha) {
  const [y, m, d] = String(fecha).split('-').map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(y, m - 1, d).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }).replace('.', '');
}
