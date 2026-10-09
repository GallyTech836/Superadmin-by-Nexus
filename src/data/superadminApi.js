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

/** Crea Auth + negocio. formData: { name, ownerName, ownerEmail, phone, country, city, plan, status, trialDays } */
export async function createBusiness(formData) {
  return request('/negocios', { method: 'POST', body: formData }); // { id, tempPassword }
}

/** Cambia la contraseña del admin del negocio. Vacía = genera una. -> { email, password } */
export async function setBusinessPassword(negocioId, password) {
  return request(`/negocios/${encodeURIComponent(negocioId)}/password`, { method: 'POST', body: { password: password || '' } });
}

/** Bloqueo de Analítica: { enabled?, pin?, clearPin? } */
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
