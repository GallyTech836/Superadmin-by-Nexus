import { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2, Ban, RotateCcw, AlertTriangle, Pencil, X, Server, RefreshCw, Undo2, CalendarPlus, PlayCircle,
  KeyRound, Lock, Eye, EyeOff, Copy, Check,
} from 'lucide-react';
import {
  DetailPage, Field, SelectField, StatusBadge, Tabs, Toggle, LimitInput, CapStatusBadge, UsageBar, SOURCE_LABELS, STATUS_LABELS,
  daysRemaining, formatDateTime,
} from './common';
import {
  CAPABILITIES, CAPABILITY_MODULES, CAPABILITY_STATUS, resolveCapabilities, cleanOverrides, usageStatus, getCapability,
} from '../shared/capabilityModel';
import { computeSubscriptionEnd, todayISO, addDaysISO, DEFAULT_TRIAL_DAYS, formatPrice } from '../data/planFeatures';
import { useBusinessUsage } from '../data/useBusinessUsage';
import TerminologyEditor from './TerminologyEditor';
import { getBusinessAccess, setBusinessPassword, setAnalyticsPin } from '../data/superadminApi';
import { BUSINESS_TYPES, getBusinessProfile, getBusinessTypeLabel, resolveBusinessType } from '../shared/businessProfileModel';

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'capacidades', label: 'Capacidades' },
  { key: 'consumo', label: 'Consumo' },
  { key: 'prueba', label: 'Prueba gratuita' },
  { key: 'seguridad', label: 'Seguridad' },
  { key: 'actividad', label: 'Actividad' },
];

const mark = (on) => (on ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">✗</span>);
const limitText = (cap, n) => (n === null || n === undefined ? 'Ilimitado' : `${n}${cap.limit?.period === 'month' ? '/mes' : ''}`);

function previousPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Info({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="text-sm text-white">{children}</div>
    </div>
  );
}

function ActionButton({ onClick, tone = 'indigo', icon: Icon, children, disabled }) {
  const tones = {
    emerald: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25',
    red: 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
    indigo: 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25',
    slate: 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25',
    amber: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-40 ${tones[tone]}`}>
      {Icon && <Icon size={14} />} {children}
    </button>
  );
}

export default function BusinessDetail({
  business, plans, activity = [], onClose, initialTab = 'resumen',
  updateStatus, updatePlan, updateInfo, updateSubscriptionEnd, updateOverrides, updateTrial, updateTerminology, pushActivity,
}) {
  const [tab, setTab] = useState(initialTab);
  const plan = plans.find((p) => p.id === business.plan) || null;
  const planName = plan?.name || 'Sin plan';

  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  // ── Uso / consumo ──
  const [period, setPeriod] = useState(null);
  const usage = useBusinessUsage(business.id, period || undefined);

  // ── Capacidades (borrador de overrides) ──
  const [draft, setDraft] = useState(business.capabilityOverrides || {});
  const [draftDirty, setDraftDirty] = useState(false);
  useEffect(() => {
    if (!draftDirty) setDraft(business.capabilityOverrides || {});
  }, [business.capabilityOverrides, draftDirty]);

  // Restricciones del tipo de negocio (mismo criterio que Nexus y backend):
  // solo puede apagar (módulos no relevantes / defaults en false), nunca habilitar.
  const businessProfile = getBusinessProfile(business.businessType);
  const profileDefaults = businessProfile.capabilityDefaults || null;
  const relevantModules = businessProfile.modules || null;
  const resolvedSaved = useMemo(
    () => resolveCapabilities({ planFeatures: plan?.features || null, overrides: business.capabilityOverrides, profileDefaults, relevantModules }),
    [plan, business.capabilityOverrides, profileDefaults, relevantModules],
  );
  const resolvedPlan = useMemo(
    () => resolveCapabilities({ planFeatures: plan?.features || null, profileDefaults, relevantModules }),
    [plan, profileDefaults, relevantModules],
  );
  const resolvedDraft = useMemo(
    () => resolveCapabilities({ planFeatures: plan?.features || null, overrides: draft, profileDefaults, relevantModules }),
    [plan, draft, profileDefaults, relevantModules],
  );
  const overrideCount = Object.keys(cleanOverrides(business.capabilityOverrides)).length;
  const activeCount = CAPABILITIES.filter((c) => c.status !== 'soon' && resolvedSaved[c.key].enabled).length;

  function setOverride(key, patch) {
    setDraftDirty(true);
    setDraft((d) => {
      const cur = { ...(d[key] || {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete cur[k];
        else cur[k] = v;
      }
      const next = { ...d };
      if (Object.keys(cur).length) next[key] = cur; else delete next[key];
      return next;
    });
  }

  async function saveOverrides() {
    const before = cleanOverrides(business.capabilityOverrides);
    const after = cleanOverrides(draft);
    const changes = [];
    for (const cap of CAPABILITIES) {
      const a = resolvedSaved[cap.key];
      const b = resolvedDraft[cap.key];
      if (a.enabled !== b.enabled) changes.push(`${cap.label}: ${a.enabled ? '✓' : '✗'} → ${b.enabled ? '✓' : '✗'}`);
      if (cap.limit && a.limit !== b.limit) changes.push(`${cap.label} (límite): ${limitText(cap, a.limit)} → ${limitText(cap, b.limit)}`);
    }
    await run(async () => {
      await updateOverrides(business.id, after);
      await pushActivity(
        'Capacidades modificadas',
        `${business.name}: ${changes.length ? changes.join('; ') : 'excepciones actualizadas sin cambio en el resultado'}`,
        { negocioId: business.id, before, after },
      );
      setDraftDirty(false);
    });
  }

  // ── Estado / plan ──
  async function changeStatus(status, label) {
    await run(async () => {
      const before = { status: business.rawStatus, subscriptionEnd: business.subscriptionEnd };
      await updateStatus(business.id, status);
      let newEnd = null;
      if (status === 'active') {
        newEnd = computeSubscriptionEnd(plan);
        await updateSubscriptionEnd(business.id, newEnd);
      } else if (status === 'expired') {
        newEnd = todayISO();
        await updateSubscriptionEnd(business.id, newEnd);
      }
      await pushActivity(label, `${business.name} cambió su estado a ${STATUS_LABELS[status]}`, {
        negocioId: business.id, before, after: { status, subscriptionEnd: newEnd ?? business.subscriptionEnd },
      });
    });
  }

  async function changePlan(planId) {
    if (planId === (business.plan || '')) return;
    const next = plans.find((p) => p.id === planId) || null;
    await run(async () => {
      await updatePlan(business.id, planId || null);
      const newEnd = computeSubscriptionEnd(next);
      await updateSubscriptionEnd(business.id, newEnd);
      await pushActivity('Plan cambiado', `${business.name} cambió de plan ${planName} a ${next?.name || 'Sin plan'}`, {
        negocioId: business.id, planId: planId || null,
        before: { plan: business.plan, subscriptionEnd: business.subscriptionEnd },
        after: { plan: planId || null, subscriptionEnd: newEnd },
      });
    });
  }

  // ── Información ──
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState(null);
  function startEditInfo() {
    setInfoForm({
      name: business.name, ownerName: business.ownerName, phone: business.phone, country: business.country, city: business.city,
      businessType: resolveBusinessType(business.businessType),
    });
    setEditingInfo(true);
  }
  async function saveInfo() {
    await run(async () => {
      await updateInfo(business.id, infoForm);
      await pushActivity('Datos actualizados', `Se editó la información de ${business.name}`, { negocioId: business.id });
      setEditingInfo(false);
    });
  }

  // ── Terminología (solo textos) ──
  async function saveTerminology(overrides, { concept, value }) {
    await run(async () => {
      await updateTerminology(business.id, overrides);
      const what = value ? `${value.singular} / ${value.plural}` : 'predeterminado del tipo';
      await pushActivity('Terminología actualizada', `${business.name}: término "${concept}" → ${what}`, { negocioId: business.id });
    });
  }

  // ── Prueba gratuita ──
  const [trialForm, setTrialForm] = useState({
    trialStart: business.trialStart || '', trialEnd: business.trialEnd || '', trialDays: business.trialDays || plan?.trialDays || DEFAULT_TRIAL_DAYS,
  });
  useEffect(() => {
    setTrialForm({ trialStart: business.trialStart || '', trialEnd: business.trialEnd || '', trialDays: business.trialDays || plan?.trialDays || DEFAULT_TRIAL_DAYS });
  }, [business.trialStart, business.trialEnd, business.trialDays, plan?.trialDays]);

  const trialState = business.rawStatus !== 'trial'
    ? (business.trialEnd ? 'Finalizada' : 'Sin prueba')
    : (business.status === 'expired' ? 'Vencida' : 'En curso');

  async function startTrial() {
    const days = Number(trialForm.trialDays) || DEFAULT_TRIAL_DAYS;
    const start = todayISO();
    const end = addDaysISO(start, days);
    await run(async () => {
      await updateTrial(business.id, { trialStart: start, trialEnd: end, trialDays: days, status: 'trial' });
      await pushActivity('Prueba iniciada', `${business.name}: prueba de ${days} días (hasta ${end})`, {
        negocioId: business.id, before: { status: business.rawStatus, trialEnd: business.trialEnd }, after: { status: 'trial', trialStart: start, trialEnd: end },
      });
    });
  }

  async function extendTrial(days) {
    const base = business.trialEnd && business.trialEnd > todayISO() ? business.trialEnd : todayISO();
    const end = addDaysISO(base, days);
    await run(async () => {
      await updateTrial(business.id, {
        trialStart: business.trialStart || todayISO(), trialEnd: end,
        trialDays: (Number(business.trialDays) || 0) + days, status: 'trial',
      });
      await pushActivity('Prueba extendida', `${business.name}: +${days} días (ahora vence ${end})`, {
        negocioId: business.id, before: { trialEnd: business.trialEnd }, after: { trialEnd: end },
      });
    });
  }

  async function saveTrialDates() {
    await run(async () => {
      await updateTrial(business.id, { trialStart: trialForm.trialStart, trialEnd: trialForm.trialEnd, trialDays: trialForm.trialDays });
      await pushActivity('Prueba editada', `${business.name}: prueba ${trialForm.trialStart || '—'} → ${trialForm.trialEnd || '—'}`, {
        negocioId: business.id, before: { trialStart: business.trialStart, trialEnd: business.trialEnd }, after: { trialStart: trialForm.trialStart, trialEnd: trialForm.trialEnd },
      });
    });
  }

  // ── Seguridad: contraseña del admin y PIN de Analítica ──
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwResult, setPwResult] = useState(null); // { email, password }
  const [pwCopied, setPwCopied] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [secMsg, setSecMsg] = useState({ type: '', text: '' });

  async function changePassword() {
    setSecMsg({ type: '', text: '' });
    await run(async () => {
      try {
        const r = await setBusinessPassword(business.id, newPassword);
        setPwResult(r);
        setNewPassword('');
        await pushActivity('Contraseña cambiada', `Se cambió la contraseña del administrador de ${business.name}`, { negocioId: business.id });
      } catch (err) {
        setSecMsg({ type: 'error', text: err.message });
      }
    });
  }

  function copyPassword() {
    navigator.clipboard.writeText(`Correo: ${pwResult.email}\nContraseña: ${pwResult.password}`);
    setPwCopied(true);
    setTimeout(() => setPwCopied(false), 2000);
  }

  async function updatePin(body, label, okText) {
    setSecMsg({ type: '', text: '' });
    await run(async () => {
      try {
        await setAnalyticsPin(business.id, body);
        setNewPin('');
        setSecMsg({ type: 'ok', text: okText });
        await pushActivity(label, `${business.name}: ${okText}`, { negocioId: business.id });
      } catch (err) {
        setSecMsg({ type: 'error', text: err.message });
      }
    });
  }

  // ── Verificación del backend ──
  const [serverAccess, setServerAccess] = useState(null);
  const [serverError, setServerError] = useState('');
  async function verifyServer() {
    setServerError('');
    try {
      setServerAccess(await getBusinessAccess(business.id));
    } catch (err) {
      setServerError(err.message);
    }
  }
  const serverMismatches = serverAccess
    ? CAPABILITIES.filter((c) => c.status !== 'soon' && (serverAccess.capabilities?.[c.key]?.enabled !== resolvedSaved[c.key].enabled
      || (c.limit && serverAccess.capabilities?.[c.key]?.limit !== resolvedSaved[c.key].limit)))
    : [];

  const bizActivity = activity.filter((a) => a.negocioId === business.id || (!a.negocioId && a.description?.includes(business.name))).slice(0, 50);
  const limitedCaps = CAPABILITIES.filter((c) => c.limit && c.status !== 'soon');
  const whatsappCap = getCapability('asistenteWhatsapp');
  const waUsage = usageStatus(resolvedSaved.asistenteWhatsapp.limit, usage.usedFor(whatsappCap));

  return (
    <DetailPage title={business.name} subtitle={`${business.id} · ${business.ownerEmail}`} onBack={onClose}>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {/* ─────────── RESUMEN ─────────── */}
      {tab === 'resumen' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Información</p>
            {!editingInfo ? (
              <button onClick={startEditInfo} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"><Pencil size={12} /> Editar</button>
            ) : (
              <button onClick={() => setEditingInfo(false)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white"><X size={12} /> Cancelar</button>
            )}
          </div>

          {editingInfo ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre del negocio" value={infoForm.name} onChange={(e) => setInfoForm((f) => ({ ...f, name: e.target.value }))} />
              <Field label="Propietario" value={infoForm.ownerName} onChange={(e) => setInfoForm((f) => ({ ...f, ownerName: e.target.value }))} />
              <Field label="Teléfono" value={infoForm.phone} onChange={(e) => setInfoForm((f) => ({ ...f, phone: e.target.value }))} />
              <Field label="Ciudad" value={infoForm.city} onChange={(e) => setInfoForm((f) => ({ ...f, city: e.target.value }))} />
              <Field label="País" value={infoForm.country} onChange={(e) => setInfoForm((f) => ({ ...f, country: e.target.value }))} />
              <SelectField label="Tipo de negocio" value={infoForm.businessType} onChange={(e) => setInfoForm((f) => ({ ...f, businessType: e.target.value }))}>
                {BUSINESS_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </SelectField>
              {Object.keys(business.terminologyOverrides || {}).length > 0 && infoForm.businessType !== resolveBusinessType(business.businessType) && (
                <p className="col-span-2 text-[11px] text-amber-400/80">Cambias el tipo: las personalizaciones de terminología de este negocio se conservan.</p>
              )}
              <button onClick={saveInfo} disabled={busy} className="col-span-2 rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white hover:bg-indigo-600">Guardar cambios</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Info label="Propietario">{business.ownerName || '—'}</Info>
              <Info label="Teléfono">{business.phone || '—'}</Info>
              <Info label="Ciudad">{business.city || '—'}{business.country ? `, ${business.country}` : ''}</Info>
              <Info label="Creado">{business.createdAt || '—'}</Info>
              <Info label="Tipo de negocio">
                {getBusinessTypeLabel(business.businessType)}
                {!business.businessType && <span className="text-xs text-slate-500"> (por defecto)</span>}
              </Info>
              <Info label="Plan">{planName} <span className="text-xs text-slate-500">{plan ? formatPrice(plan) : ''}</span></Info>
              <Info label="Estado"><StatusBadge status={business.status} /></Info>
              <Info label="Vencimiento">{business.subscriptionEnd ? `${business.subscriptionEnd} (${daysRemaining(business.subscriptionEnd)} d)` : '—'}</Info>
              <Info label="Prueba">{business.trialEnd ? `${trialState} · hasta ${business.trialEnd}` : trialState}</Info>
              <Info label="Profesionales">{usage.counts.profesionales ?? '…'} <span className="text-xs text-slate-500">/ {limitText(getCapability('profesionales'), resolvedSaved.profesionales.limit)}</span></Info>
              <Info label="Sucursales">{usage.counts.sucursales ?? '…'} <span className="text-xs text-slate-500">/ {limitText(getCapability('sucursales'), resolvedSaved.sucursales.limit)}</span></Info>
              <Info label="Capacidades activas">{activeCount} <span className="text-xs text-slate-500">· {overrideCount} excepciones</span></Info>
              <Info label="WhatsApp este mes">
                {resolvedSaved.asistenteWhatsapp.enabled ? `${waUsage.used} / ${limitText(whatsappCap, waUsage.limit)}` : <span className="text-slate-500">No incluido</span>}
              </Info>
            </div>
          )}

          {updateTerminology && <TerminologyEditor business={business} onSave={saveTerminology} busy={busy} />}

          <div className="border-t border-white/5 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Acciones</p>
            <div className="flex flex-wrap gap-2">
              {business.status !== 'active' && business.status !== 'suspended' && (
                <ActionButton tone="emerald" icon={CheckCircle2} disabled={busy} onClick={() => changeStatus('active', 'Negocio activado')}>Activar</ActionButton>
              )}
              {business.status !== 'suspended' && (
                <ActionButton tone="red" icon={Ban} disabled={busy} onClick={() => changeStatus('suspended', 'Negocio suspendido')}>Suspender</ActionButton>
              )}
              {business.status === 'suspended' && (
                <ActionButton tone="indigo" icon={RotateCcw} disabled={busy} onClick={() => changeStatus('active', 'Negocio reactivado')}>Reactivar</ActionButton>
              )}
              {business.status !== 'expired' && (
                <ActionButton tone="slate" icon={AlertTriangle} disabled={busy} onClick={() => changeStatus('expired', 'Negocio marcado como vencido')}>Marcar vencido</ActionButton>
              )}
              <ActionButton tone="amber" icon={CalendarPlus} disabled={busy} onClick={() => setTab('prueba')}>Prueba gratuita</ActionButton>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Cambiar plan:</span>
              <select
                value={business.plan || ''}
                disabled={busy}
                onChange={(e) => changePlan(e.target.value)}
                className="rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
              >
                <option value="">Sin plan (valores por defecto)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.active === false && p.id !== business.plan}>
                    {p.name}{p.active === false ? ' (inactivo)' : ''}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-600">Recalcula el vencimiento según el ciclo del plan.</span>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── CAPACIDADES ─────────── */}
      {tab === 'capacidades' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Prioridad: <b className="text-slate-300">Excepción del negocio</b> &gt; <b className="text-slate-300">Plan ({planName})</b> &gt; valor por defecto.
            Las excepciones no cambian el plan.
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full min-w-[600px] table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[12%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Capacidad</th>
                  <th className="px-2 py-2 text-center font-medium">Plan / tipo</th>
                  <th className="px-2 py-2 font-medium">Excepción</th>
                  <th className="px-2 py-2 font-medium">Límite</th>
                  <th className="px-2 py-2 text-center font-medium">Resultado</th>
                </tr>
              </thead>
              {CAPABILITY_MODULES.map((mod) => {
                const caps = CAPABILITIES.filter((c) => c.module === mod.key && c.status !== 'soon' && !c.core);
                if (!caps.length) return null;
                const moduleHidden = Array.isArray(relevantModules) && !relevantModules.includes(mod.key);
                return (
                  <tbody key={mod.key} className="divide-y divide-white/5">
                    <tr className="bg-slate-950/60">
                      <td colSpan={5} className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {mod.label}
                        {moduleHidden && <span className="ml-2 normal-case tracking-normal text-amber-400/80">No relevante para {businessProfile.label}</span>}
                      </td>
                    </tr>
                    {caps.map((cap) => {
                      const r = resolvedDraft[cap.key];
                      const o = draft[cap.key] || {};
                      const planVal = resolvedPlan[cap.key];
                      const enabledMode = typeof o.enabled === 'boolean' ? (o.enabled ? 'on' : 'off') : 'inherit';
                      const hasLimitOverride = Object.prototype.hasOwnProperty.call(o, 'limit');
                      const isOverridden = enabledMode !== 'inherit' || hasLimitOverride;
                      return (
                        <tr key={cap.key} className={isOverridden ? 'bg-indigo-500/5' : ''}>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-slate-200">{cap.label}</span>
                              {cap.status !== 'implemented' && <CapStatusBadge status={cap.status} label={CAPABILITY_STATUS[cap.status].label} />}
                            </div>
                            {r.blockedBy && <p className="text-[10px] text-slate-500">Requiere "{getCapability(r.blockedBy).label}"</p>}
                            {r.source === 'profile' && <p className="text-[10px] text-amber-400/80">Restringida por el tipo de negocio</p>}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {cap.kind === 'quota' ? <span className="text-slate-400">{limitText(cap, planVal.limit)}</span> : (
                              <>
                                {mark(planVal.enabled)}
                                {cap.limit && planVal.enabled && <span className="ml-1 text-slate-500">{limitText(cap, planVal.limit)}</span>}
                              </>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {cap.kind !== 'quota' && (
                              <select
                                value={enabledMode}
                                onChange={(e) => setOverride(cap.key, { enabled: e.target.value === 'inherit' ? undefined : e.target.value === 'on' })}
                                className={`w-full rounded-md border bg-slate-950 px-1.5 py-0.5 text-[11px] outline-none ${enabledMode === 'inherit' ? 'border-white/10 text-slate-400' : 'border-indigo-500/50 text-indigo-300'}`}
                              >
                                <option value="inherit">Heredar</option>
                                <option value="on">Activar</option>
                                <option value="off">Desactivar</option>
                              </select>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {cap.limit && (
                              <div className="flex items-center gap-1.5">
                                <Toggle value={hasLimitOverride} onChange={(on) => setOverride(cap.key, { limit: on ? (planVal.limit ?? null) : undefined })} />
                                {hasLimitOverride ? (
                                  <LimitInput value={o.limit ?? null} onChange={(n) => setOverride(cap.key, { limit: n })} />
                                ) : (
                                  <span className="text-[11px] text-slate-500">Del plan</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center" title={SOURCE_LABELS[cap.kind === 'quota' ? r.limitSource : r.source]}>
                            {cap.kind === 'quota' ? <span className="text-white">{limitText(cap, r.limit)}</span> : (
                              <>
                                {mark(r.enabled)}
                                {cap.limit && r.enabled && <span className="ml-1 text-slate-300">{limitText(cap, r.limit)}</span>}
                              </>
                            )}
                            {isOverridden && <span className="ml-1 text-[10px] text-indigo-400">●</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
          <p className="text-[11px] text-slate-600"><span className="text-indigo-400">●</span> = modificado con excepción. Pasa el cursor sobre el resultado para ver de dónde viene.</p>
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-white/5 bg-slate-900 pt-3">
            <button onClick={saveOverrides} disabled={busy || !draftDirty} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40">
              Guardar excepciones
            </button>
            {draftDirty && (
              <button onClick={() => { setDraftDirty(false); setDraft(business.capabilityOverrides || {}); }} className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700">
                <Undo2 size={14} /> Descartar
              </button>
            )}
            {Object.keys(draft).length > 0 && (
              <button onClick={() => { setDraftDirty(true); setDraft({}); }} className="rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10">
                Quitar todas las excepciones
              </button>
            )}
            <span className="text-[11px] text-slate-600">Nexus se actualiza al instante; el backend en máx. 60 s.</span>
          </div>
        </div>
      )}

      {/* ─────────── CONSUMO ─────────── */}
      {tab === 'consumo' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Período:</span>
            {[usage.period, previousPeriod(usage.period)].filter((v, i, arr) => arr.indexOf(v) === i).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-2.5 py-1 text-xs ${usage.period === p ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{p}</button>
            ))}
            <button onClick={usage.refreshCounts} className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-white"><RefreshCw size={12} /> Actualizar</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/5">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Capacidad</th>
                  <th className="px-3 py-2 font-medium">Límite</th>
                  <th className="px-3 py-2 font-medium">Consumo</th>
                  <th className="w-40 px-3 py-2 font-medium">% usado</th>
                  <th className="px-3 py-2 font-medium">Excedente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {limitedCaps.map((cap) => {
                  const r = resolvedSaved[cap.key];
                  const used = usage.usedFor(cap);
                  const st = usageStatus(r.limit, used);
                  const rejected = usage.rejectedFor(cap);
                  return (
                    <tr key={cap.key}>
                      <td className="px-3 py-2 text-white">
                        {cap.label}
                        <p className="text-[10px] text-slate-600">{cap.limit.period === 'month' ? 'Mensual' : 'Cantidad actual'}{!r.enabled ? ' · no incluido' : ''}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{limitText(cap, r.limit)}</td>
                      <td className="px-3 py-2 text-slate-300">{used ?? '…'}</td>
                      <td className="px-3 py-2">
                        {st.percent === null || used === null ? <span className="text-slate-600">—</span> : (
                          <div className="space-y-1">
                            <UsageBar percent={st.percent} exceeded={st.exceeded} />
                            <span className={st.exceeded ? 'text-red-400' : 'text-slate-400'}>{st.percent}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {st.overage > 0 ? <span className="text-red-400">+{st.overage}</span> : <span className="text-slate-600">0</span>}
                        {rejected > 0 && <p className="text-[10px] text-amber-400">{rejected} bloqueados por límite</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-600">
            WhatsApp: cuenta cada mensaje enviado por el bot (negocios/{business.id}/uso/{usage.period}). Al llegar al límite el bot deja de responder y los
            mensajes entrantes se cuentan como "bloqueados por límite". Excedente = consumo por encima del límite (ej. si bajaste el límite a mitad de mes).
          </p>
          {usage.error && <p className="text-xs text-red-400">{usage.error}</p>}

          <div className="rounded-xl border border-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-white">Verificar en el servidor</p>
                <p className="text-[11px] text-slate-500">Pregunta a Railway qué permite realmente para este negocio (sin caché).</p>
              </div>
              <ActionButton icon={Server} onClick={verifyServer}>Verificar</ActionButton>
            </div>
            {serverError && <p className="mt-2 text-xs text-red-400">{serverError}</p>}
            {serverAccess && (
              <div className="mt-3 space-y-1 text-xs">
                <p className="text-slate-400">Estado en servidor: <StatusBadge status={serverAccess.status} /> · plan: {serverAccess.planName || 'Sin plan'}</p>
                {serverMismatches.length === 0 ? (
                  <p className="text-emerald-400">✓ El backend aplica exactamente las mismas capacidades y límites.</p>
                ) : (
                  <p className="text-amber-400">
                    Diferencias ({serverMismatches.map((c) => c.label).join(', ')}). Si acabas de cambiar algo, espera unos segundos y vuelve a verificar.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────── PRUEBA GRATUITA ─────────── */}
      {tab === 'prueba' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Info label="Estado de la prueba">{trialState}</Info>
            <Info label="Inicio">{business.trialStart || '—'}</Info>
            <Info label="Vencimiento">{business.trialEnd || '—'}</Info>
            <Info label="Días restantes">{business.rawStatus === 'trial' && business.trialEnd ? Math.max(0, daysRemaining(business.trialEnd)) : '—'}</Info>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-white/5 pt-4">
            <div className="w-32">
              <Field label="Duración (días)" type="number" min="1" value={trialForm.trialDays} onChange={(e) => setTrialForm((f) => ({ ...f, trialDays: e.target.value }))} />
            </div>
            <ActionButton tone="amber" icon={PlayCircle} disabled={busy} onClick={startTrial}>
              {business.rawStatus === 'trial' ? 'Reiniciar prueba desde hoy' : 'Iniciar prueba'}
            </ActionButton>
            {[7, 14, 30].map((d) => (
              <ActionButton key={d} tone="indigo" icon={CalendarPlus} disabled={busy} onClick={() => extendTrial(d)}>+{d} días</ActionButton>
            ))}
            {business.rawStatus === 'trial' && (
              <ActionButton tone="emerald" icon={CheckCircle2} disabled={busy} onClick={() => changeStatus('active', 'Prueba convertida a activo')}>Terminar prueba y activar</ActionButton>
            )}
          </div>

          <div className="rounded-xl border border-white/5 p-4">
            <p className="mb-3 text-xs text-slate-500">Editar fechas manualmente</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Fecha de inicio" type="date" value={trialForm.trialStart} onChange={(e) => setTrialForm((f) => ({ ...f, trialStart: e.target.value }))} />
              <Field label="Fecha de vencimiento" type="date" value={trialForm.trialEnd} onChange={(e) => setTrialForm((f) => ({ ...f, trialEnd: e.target.value }))} />
              <div className="flex items-end">
                <button onClick={saveTrialDates} disabled={busy} className="w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50">Guardar fechas</button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">Con estado "Prueba", al pasar la fecha de vencimiento el negocio queda Vencido automáticamente (Nexus y backend).</p>
          </div>
        </div>
      )}

      {/* ─────────── SEGURIDAD ─────────── */}
      {tab === 'seguridad' && (
        <div className="space-y-4">
          {secMsg.text && (
            <p className={`rounded-lg px-3 py-2 text-xs ${secMsg.type === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{secMsg.text}</p>
          )}

          <div className="rounded-xl border border-white/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound size={16} className="text-indigo-400" />
              <p className="text-sm font-medium text-white">Contraseña del administrador</p>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              Cuenta: <span className="text-slate-300">{business.ownerEmail || '—'}</span>. Por seguridad la contraseña actual no se puede ver
              (Firebase solo guarda una versión cifrada). Aquí puedes poner una nueva: se muestra una sola vez para que se la pases al dueño.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-slate-400">Nueva contraseña</label>
                <div className="flex items-center rounded-lg border border-white/10 bg-slate-950 focus-within:border-indigo-500">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Vacía = se genera una"
                    autoComplete="new-password"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="px-2 text-slate-500 hover:text-white" aria-label="Mostrar contraseña">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <ActionButton icon={KeyRound} disabled={busy} onClick={changePassword}>Cambiar contraseña</ActionButton>
            </div>
            {pwResult && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                <span className="text-emerald-200">
                  Nueva contraseña de {pwResult.email}: <span className="font-mono text-white">{pwResult.password}</span>
                </span>
                <button onClick={copyPassword} className="flex items-center gap-1 text-emerald-300 hover:text-white">
                  {pwCopied ? <Check size={14} /> : <Copy size={14} />} {pwCopied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-indigo-400" />
                <p className="text-sm font-medium text-white">Bloqueo de Analítica con PIN</p>
              </div>
              <Toggle
                value={business.analyticsPinEnabled}
                disabled={busy}
                onChange={(on) => updatePin({ enabled: on }, on ? 'PIN de Analítica activado' : 'PIN de Analítica desactivado', on ? 'bloqueo de Analítica activado' : 'bloqueo de Analítica desactivado')}
              />
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              Si está activo, en GallyFlow la sección Analítica pide el PIN antes de mostrar ingresos y comisiones (también lo valida el backend).
              PIN actual: <span className={business.hasFinancePin ? 'text-emerald-400' : 'text-amber-400'}>{business.hasFinancePin ? 'configurado' : 'sin configurar (el dueño lo crea al entrar)'}</span>.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-40">
                <Field
                  label="Nuevo PIN (4 a 8 dígitos)"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                />
              </div>
              <ActionButton
                icon={Lock}
                disabled={busy || newPin.length < 4}
                onClick={() => updatePin({ pin: newPin, enabled: true }, 'PIN de Analítica cambiado', 'PIN de Analítica actualizado y bloqueo activado')}
              >
                Guardar PIN
              </ActionButton>
              {business.hasFinancePin && (
                <ActionButton tone="red" disabled={busy} onClick={() => updatePin({ clearPin: true }, 'PIN de Analítica borrado', 'PIN borrado; el dueño creará uno nuevo al entrar')}>
                  Borrar PIN
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────── ACTIVIDAD ─────────── */}
      {tab === 'actividad' && (
        <div className="space-y-2">
          {bizActivity.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/5 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{a.type}</p>
                <p className="text-xs text-slate-500">{formatDateTime(a.createdAt) || a.date}</p>
              </div>
              <p className="mt-1 text-xs text-slate-400">{a.description}</p>
              {a.actorEmail && <p className="mt-1 text-[10px] text-slate-600">por {a.actorEmail}</p>}
            </div>
          ))}
          {bizActivity.length === 0 && <p className="py-8 text-center text-sm text-slate-600">Sin actividad registrada para este negocio.</p>}
        </div>
      )}
    </DetailPage>
  );
}
