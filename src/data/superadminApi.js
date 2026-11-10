import { auth } from '../firebase/config';

const BASE_URL = 'https://gallyflow-production.up.railway.app/api/superadmin';

async function request(path, { method = 'GET', body } = {}) {
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${idToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/** Crea Auth + negocio. formData: { name, businessType, ownerName, ownerEmail, phone, country, city, plan, status, trialDays } */
export async function createBusiness(formData) {
  return request('/negocios', { method: 'POST', body: formData }); // { id, tempPassword }
}

/** Cambia la contraseña del admin del negocio. Vacía = genera una. -> { email, password } */
export async function setBusinessPassword(negocioId, password) {
  return request(`/negocios/${encodeURIComponent(negocioId)}/password`, { method: 'POST', body: { password: password || '' } });
}

/** Bloqueo con PIN: { lockedModules?: string[], pin?, clearPin? } (enabled? = viejo, solo Analítica) */
export async function setAnalyticsPin(negocioId, body) {
  return request(`/negocios/${encodeURIComponent(negocioId)}/analytics-pin`, { method: 'POST', body });
}

/**
 * Lo que el BACKEND considera permitido para el negocio (sin caché):
 * { status, isBlocked, planId, capabilities, period, usage, consumo }.
 * Sirve para confirmar que Railway aplica exactamente lo configurado.
 */
export async function getBusinessAccess(negocioId) {
  return request(`/negocios/${encodeURIComponent(negocioId)}/access`);
}

/** Número de WhatsApp de soporte (solo dígitos con código de país). -> { whatsapp } */
export async function getSupportConfig() {
  return request('/config/soporte');
}

export async function setSupportConfig(whatsapp) {
  return request('/config/soporte', { method: 'PUT', body: { whatsapp } });
}

/**
 * Avisos de vencimiento que el admin del negocio aceptó, por período.
 * Cada período: { tipo, fechaVencimiento, aviso7, aviso5 }; cada aviso es
 * { aceptadoAt, diasRestantes, email } o null.
 */
export async function getExpiryNotices(negocioId) {
  const data = await request(`/negocios/${encodeURIComponent(negocioId)}/avisos-vencimiento`);
  return Array.isArray(data) ? data : (data.periodos || data.avisos || data.items || []);
}

// ───────────── Asistente WhatsApp / Consumo ─────────────

/**
 * Informe de un mes: { estado, alcance, config, mensajes, conversaciones,
 * reservas, promedioEnviadosPorReserva, promedioDiarioEnviados, diario[] }.
 */
export async function getAssistantMetrics(negocioId, mes) {
  return request(`/negocios/${encodeURIComponent(negocioId)}/asistente-metricas?mes=${encodeURIComponent(mes)}`);
}

/** Últimos 12 meses con uso: { estado, config, meses[] }. */
export async function getAssistantMetricsHistory(negocioId) {
  return request(`/negocios/${encodeURIComponent(negocioId)}/asistente-metricas/historial`);
}

/** { startDate?: 'AAAA-MM-DD' | null, enabled?: boolean } -> { config, estado, antes } */
export async function setAssistantMetricsConfig(negocioId, body) {
  return request(`/negocios/${encodeURIComponent(negocioId)}/asistente-metricas/config`, { method: 'PUT', body });
}

// ───────────── Solicitudes de registro (formulario público /registro) ─────────────

/**
 * Solicitudes enviadas desde nexusbo.vercel.app/registro.
 * status: 'pendiente' | 'creada' | 'descartada' | 'todas'
 * -> { solicitudes: [{ id, status, createdAt, updatedAt, negocioId, note, data }] }
 */
export async function listSolicitudes(status = 'pendiente') {
  const data = await request(`/solicitudes?status=${encodeURIComponent(status)}`);
  return Array.isArray(data) ? data : (data.solicitudes || []);
}

/** Cambia el estado a mano: { status: 'pendiente' | 'descartada', note? } */
export async function updateSolicitud(id, body) {
  return request(`/solicitudes/${encodeURIComponent(id)}`, { method: 'PATCH', body });
}

/**
 * Crea el negocio completo a partir de la solicitud (Auth + negocio + sucursales
 * + horarios + servicios + profesionales sin contraseña). Siempre en prueba.
 * body: { planId, trialDays } -> { id, email, tempPassword, creados: { sucursales, servicios, profesionales },
 *   cupos: { profesionales, sucursales } con { limit, used, over } }
 */
export async function createFromSolicitud(id, body) {
  return request(`/solicitudes/${encodeURIComponent(id)}/crear`, { method: 'POST', body });
}

// ───────────── Eliminar negocio ─────────────

/**
 * days = 0: borra ya todo el negocio. 1..90: lo suspende y lo borra en esa fecha.
 * confirm = ID del negocio. Exige haber reingresado la contraseña hace poco
 * (reauthenticateWithCredential + getIdToken(true)).
 * -> { deleted: true, summary } | { deleted: false, deletion: { scheduledFor, … } }
 */
export async function deleteBusiness(negocioId, { days, confirm }) {
  return request(`/negocios/${encodeURIComponent(negocioId)}/eliminar`, { method: 'POST', body: { days, confirm } });
}

/** Cancela el borrado programado y devuelve el estado anterior. */
export async function cancelBusinessDeletion(negocioId) {
  return request(`/negocios/${encodeURIComponent(negocioId)}/eliminar`, { method: 'DELETE' });
}
