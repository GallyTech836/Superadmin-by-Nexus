import { useState, useMemo } from 'react';
import { Plus, Search, CheckCircle2, Copy, Check, Sliders, Eye, EyeOff } from 'lucide-react';
import { StatusBadge, Modal, Field, SelectField, STATUS_LABELS } from '../components/common';
import BusinessDetail from '../components/BusinessDetail';
import { createBusiness } from '../data/superadminApi';
import { DEFAULT_TRIAL_DAYS } from '../data/planFeatures';
import { cleanOverrides } from '../shared/capabilityModel';
import { BUSINESS_TYPES, DEFAULT_BUSINESS_TYPE, getBusinessTypeLabel } from '../shared/businessProfileModel';

const emptyForm = {
  name: '', businessType: DEFAULT_BUSINESS_TYPE, ownerName: '', phone: '', country: 'Bolivia', city: '',
  ownerEmail: '', password: '', plan: '', status: 'trial', trialDays: DEFAULT_TRIAL_DAYS,
};

export default function NegociosPage({
  businesses, plans, activity, updateStatus, updatePlan, updateInfo, updateSubscriptionEnd, updateOverrides, updateTrial, updateTerminology, pushActivity,
}) {
  function planName(planId) {
    return plans.find((p) => p.id === planId)?.name || 'Sin plan';
  }

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [planFilter, setPlanFilter] = useState('todos');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdCreds, setCreatedCreds] = useState(null); // { email, tempPassword }
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // El detalle se lee siempre de la lista en vivo (onSnapshot), así cada
  // cambio guardado se refleja sin tener que sincronizar estado local.
  const detail = detailId ? businesses.find((b) => b.id === detailId) : null;
  const activePlans = plans.filter((p) => p.active !== false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return businesses.filter((b) => {
      const matchesSearch = b.name.toLowerCase().includes(q) || b.id.includes(q) || (b.ownerEmail || '').toLowerCase().includes(q);
      const matchesFilter = filter === 'todos' || b.status === filter;
      const matchesPlan = planFilter === 'todos' || (planFilter === 'none' ? !b.plan : b.plan === planFilter);
      return matchesSearch && matchesFilter && matchesPlan;
    });
  }, [businesses, search, filter, planFilter]);

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    const firstPlan = activePlans[0];
    setForm({ ...emptyForm, plan: firstPlan?.id || '', trialDays: firstPlan?.trialDays || DEFAULT_TRIAL_DAYS });
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!form.name || !form.ownerEmail) return;
    setCreating(true);
    setCreateError('');
    try {
      const { id, tempPassword } = await createBusiness(form);
      await pushActivity('Negocio creado', `${form.name} fue registrado con administrador ${form.ownerEmail} (${getBusinessTypeLabel(form.businessType)}, plan ${planName(form.plan)}, ${STATUS_LABELS[form.status]})`, {
        negocioId: id, planId: form.plan || null,
      });
      setCreatedCreds({ email: form.ownerEmail, tempPassword });
      setForm(emptyForm);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function closeCreateModal() {
    setShowCreate(false);
    setCreatedCreds(null);
    setCreateError('');
    setCopied(false);
  }

  function copyCreds() {
    navigator.clipboard.writeText(`Correo: ${createdCreds.email}\nContraseña: ${createdCreds.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Detalle del negocio: se muestra como página (con "Volver"), no como
  // modal, para que en tablet/celular nunca quede contenido inalcanzable.
  if (detail) {
    return (
      <BusinessDetail
        business={detail}
        plans={plans}
        activity={activity}
        onClose={() => setDetailId(null)}
        updateStatus={updateStatus}
        updatePlan={updatePlan}
        updateInfo={updateInfo}
        updateSubscriptionEnd={updateSubscriptionEnd}
        updateOverrides={updateOverrides}
        updateTrial={updateTrial}
        updateTerminology={updateTerminology}
        pushActivity={pushActivity}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Negocios</h1>
          <p className="mt-1 text-sm text-slate-500">{businesses.length} negocios registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
        >
          <Plus size={16} /> Nuevo negocio
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2">
          <Search size={15} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar negocio, slug o correo..."
            className="bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
          />
        </div>
        <div className="flex gap-1.5">
          {['todos', 'active', 'trial', 'suspended', 'expired'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                filter === f ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-900 text-slate-500 hover:text-white'
              }`}
            >
              {f === 'todos' ? 'Todos' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 outline-none"
        >
          <option value="todos">Todos los planes</option>
          <option value="none">Sin plan</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/5 bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Propietario</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Vence</th>
              <th className="px-4 py-3 font-medium">Excepciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const overrides = Object.keys(cleanOverrides(b.capabilityOverrides)).length;
              const vence = b.rawStatus === 'trial' && b.trialEnd ? `${b.trialEnd} (prueba)` : b.subscriptionEnd || '—';
              return (
                <tr
                  key={b.id}
                  onClick={() => setDetailId(b.id)}
                  className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/5"
                >
                  <td className="px-4 py-3 text-white">{b.name}</td>
                  <td className="px-4 py-3 text-slate-400">{b.ownerName || b.ownerEmail}</td>
                  <td className="px-4 py-3 text-slate-400">{planName(b.plan)}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3 text-slate-400">{vence}</td>
                  <td className="px-4 py-3">
                    {overrides > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-indigo-300"><Sliders size={12} /> {overrides}</span>
                    ) : <span className="text-xs text-slate-700">—</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-600">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nuevo negocio" onClose={closeCreateModal} wide>
          {createdCreds ? (
            /* Éxito: mostramos la contraseña generada UNA sola vez */
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="mx-auto text-emerald-400" size={40} />
              <p className="font-medium text-white">Negocio creado correctamente</p>
              <p className="text-xs text-slate-500">Copia estos datos y pásaselos al dueño — no se van a volver a mostrar.</p>
              <div className="space-y-1 rounded-lg border border-white/10 bg-slate-950 p-4 text-left text-sm">
                <p className="text-slate-400">Correo: <span className="text-white">{createdCreds.email}</span></p>
                <p className="text-slate-400">Contraseña: <span className="nx-num text-white">{createdCreds.tempPassword}</span></p>
              </div>
              <button
                onClick={copyCreds}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado' : 'Copiar datos'}
              </button>
              <button onClick={closeCreateModal} className="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-600">
                Cerrar
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Información del negocio</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre del negocio" value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
                  <SelectField label="Tipo de negocio" value={form.businessType} onChange={(e) => updateForm('businessType', e.target.value)}>
                    {BUSINESS_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </SelectField>
                  <Field label="Nombre del propietario" value={form.ownerName} onChange={(e) => updateForm('ownerName', e.target.value)} />
                  <Field label="Teléfono" value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} />
                  <Field label="Ciudad" value={form.city} onChange={(e) => updateForm('city', e.target.value)} />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Acceso del administrador</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email (con esto va a hacer login en AdminApp)" type="email" value={form.ownerEmail} onChange={(e) => updateForm('ownerEmail', e.target.value)} />
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Contraseña (opcional)</label>
                    <div className="flex items-center rounded-lg border border-white/10 bg-slate-950 focus-within:border-indigo-500">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => updateForm('password', e.target.value)}
                        placeholder="Vacía = se genera sola"
                        autoComplete="new-password"
                        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600"
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="px-2 text-slate-500 hover:text-white" aria-label="Mostrar contraseña">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-600">Mínimo 6 caracteres. Si la dejas vacía se genera una. Se muestra una sola vez al crear.</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Suscripción</p>
                <div className="grid grid-cols-3 gap-3">
                  <SelectField label="Plan" value={form.plan} onChange={(e) => {
                    const p = plans.find((x) => x.id === e.target.value);
                    setForm((f) => ({ ...f, plan: e.target.value, trialDays: p?.trialDays || f.trialDays }));
                  }}>
                    <option value="">Sin plan (por defecto)</option>
                    {activePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </SelectField>
                  <SelectField label="Estado" value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
                    <option value="trial">Prueba</option>
                    <option value="active">Activo</option>
                  </SelectField>
                  {form.status === 'trial' && (
                    <Field label="Días de prueba" type="number" min="1" value={form.trialDays} onChange={(e) => updateForm('trialDays', e.target.value)} />
                  )}
                </div>
                {plans.length === 0 && <p className="mt-1 text-xs text-amber-400">Todavía no creaste planes: el negocio usará las capacidades por defecto.</p>}
              </div>
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                {creating ? 'Creando…' : 'Crear negocio'}
              </button>
            </div>
          )}
        </Modal>
      )}

    </div>
  );
}
