import { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2, Ban, RotateCcw, AlertTriangle, Pencil, X, Server, RefreshCw, Undo2, CalendarPlus, PlayCircle,
  KeyRound, Lock, Copy, Check, Minus,
} from 'lucide-react';
import {
  DetailPage, Field, SelectField, StatusBadge, Tabs, Toggle, LimitInput, CapStatusBadge, UsageBar, SOURCE_LABELS, STATUS_LABELS,
  Button, Badge, Info, Input, Select, Label, PasswordInput, Panel, Notice, SectionLabel, Segmented, EmptyState,
  daysRemaining, formatDateTime, formatDate, relativeDays,
} from './common';
import {
  CAPABILITIES, CAPABILITY_MODULES, CAPABILITY_STATUS, resolveCapabilities, cleanOverrides, usageStatus, getCapability,
  ADDONS, LEGACY_ADDONS, getAddonOffer, computeMonthlyTotal, isPlanCompatible, normalizeAddons, getAddonForCapability,
} from '../shared/capabilityModel';
import { computeSubscriptionEnd, todayISO, addDaysISO, DEFAULT_TRIAL_DAYS, formatPrice } from '../data/planFeatures';
import { useBusinessUsage } from '../data/useBusinessUsage';
import { useWhatsappClients, formatPhone } from '../data/useWhatsappClients';
import { useWhatsappBranches, NO_BRANCH_ID } from '../data/useWhatsappBranches';
import TerminologyEditor from './TerminologyEditor';
import ExpiryNoticesSection from './ExpiryNoticesSection';
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

const mark = (on) => (on
  ? <Check size={14} className="inline-block align-[-2px] text-ok" aria-label="Incluida" />
  : <Minus size={14} className="inline-block align-[-2px] text-subtle" aria-label="No incluida" />);
const limitText = (cap, n) => (n === null || n === undefined ? 'Ilimitado' : `${n}${cap.limit?.period === 'month' ? '/mes' : ''}${cap.limit?.perBranch ? ' por sucursal' : ''}`);

function previousPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Acciones del detalle: positiva → primary, destructiva → danger, resto → secondary.
const ACTION_VARIANTS = { emerald: 'primary', red: 'danger' };
function ActionButton({ onClick, tone = 'indigo', icon, children, disabled }) {
  return (
    <Button size="sm" variant={ACTION_VARIANTS[tone] || 'secondary'} icon={icon} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

export default function BusinessDetail({
  business, plans, activity = [], onClose, initialTab = 'resumen',
  updateStatus, updatePlan, updateInfo, updateSubscriptionEnd, updateOverrides, updateTrial, updateTerminology, updateAddons, pushActivity,
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
  const addons = business.addons || null;
  const resolvedSaved = useMemo(
    () => resolveCapabilities({ planFeatures: plan?.features || null, overrides: business.capabilityOverrides, profileDefaults, relevantModules, addons }),
    [plan, business.capabilityOverrides, profileDefaults, relevantModules, addons],
  );
  // Columna "Plan / tipo": solo lo que da el plan (y lo que restringe el tipo
  // de negocio), sin complementos. Lo que suman o activan los complementos se
  // ve en "Resultado".
  const resolvedPlan = useMemo(
    () => resolveCapabilities({ planFeatures: plan?.features || null, profileDefaults, relevantModules }),
    [plan, profileDefaults, relevantModules],
  );
  const resolvedDraft = useMemo(
    () => resolveCapabilities({ planFeatures: plan?.features || null, overrides: draft, profileDefaults, relevantModules, addons }),
    [plan, draft, profileDefaults, relevantModules, addons],
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

  // Si el plan nuevo permite menos de lo que el negocio ya tiene, NO se borra
  // nada: solo se bloquean altas nuevas hasta cumplir el límite.
  function exceededWith(nextPlan, counts = usage.counts) {
    const r = resolveCapabilities({
      planFeatures: nextPlan?.features || null, overrides: business.capabilityOverrides, profileDefaults, relevantModules, addons,
    });
    return ['profesionales', 'sucursales']
      .map((key) => ({ key, limit: r[key].limit, used: counts[key] }))
      .filter((x) => typeof x.limit === 'number' && typeof x.used === 'number' && x.used > x.limit);
  }

  async function changePlan(planId) {
    if (planId === (business.plan || '')) return;
    const next = plans.find((p) => p.id === planId) || null;
    // Conteo fresco del servidor (no el que se cargó al abrir el detalle).
    const fresh = await usage.refreshCounts();
    const exceeded = exceededWith(next, fresh || usage.counts);
    if (exceeded.length) {
      const detail = exceeded.map((x) => `${x.key}: tiene ${x.used}, el plan permite ${x.limit}`).join('\n');
      const ok = window.confirm(`${business.name} supera los límites de "${next?.name || 'Sin plan'}":\n${detail}\n\nNo se eliminará nada. No podrá registrar nuevos hasta cumplir el límite o ampliar su capacidad. ¿Cambiar de todos modos?`);
      if (!ok) return;
    }
    await run(async () => {
      await updatePlan(business.id, planId || null);
      const newEnd = computeSubscriptionEnd(next);
      await updateSubscriptionEnd(business.id, newEnd);
      const excedeTxt = exceeded.length ? ` (excede: ${exceeded.map((x) => `${x.key} ${x.used}/${x.limit}`).join(', ')}; se conservan los datos)` : '';
      await pushActivity('Plan cambiado', `${business.name} cambió de plan ${planName} a ${next?.name || 'Sin plan'}${excedeTxt}`, {
        negocioId: business.id, planId: planId || null,
        before: { plan: business.plan, subscriptionEnd: business.subscriptionEnd },
        after: { plan: planId || null, subscriptionEnd: newEnd },
      });
    });
  }

  // ── Complementos (aparte del plan) ──
  const [addonsForm, setAddonsForm] = useState(normalizeAddons(business.addons));
  const addonsKey = JSON.stringify(normalizeAddons(business.addons));
  useEffect(() => { setAddonsForm(JSON.parse(addonsKey)); }, [addonsKey]);
  const addonsDirty = JSON.stringify(normalizeAddons(addonsForm)) !== addonsKey;
  const monthly = computeMonthlyTotal(plan, business.addons);
  const monthlyDraft = computeMonthlyTotal(plan, addonsForm);

  async function saveAddons() {
    const before = normalizeAddons(business.addons);
    const after = normalizeAddons(addonsForm);
    await run(async () => {
      await updateAddons(business.id, after);
      const parts = [];
      if (before.profesionalesExtra !== after.profesionalesExtra) parts.push(`Profesionales adicionales: ${before.profesionalesExtra} → ${after.profesionalesExtra}`);
      if (before.sucursalesExtra !== after.sucursalesExtra) parts.push(`Sucursales adicionales: ${before.sucursalesExtra} → ${after.sucursalesExtra}`);
      if (before.asistenteWhatsapp !== after.asistenteWhatsapp) parts.push(`Asistente de WhatsApp (complemento antiguo): ${after.asistenteWhatsapp ? 'contratado' : 'quitado'}`);
      await pushActivity('Complementos actualizados', `${business.name}: ${parts.join('; ') || 'sin cambios'}`, { negocioId: business.id, before, after });
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
  // WhatsApp: el límite es POR SUCURSAL; el total del negocio y el top de clientes son solo informativos.
  const waUsage = usageStatus(whatsappCap.limit.perBranch ? null : resolvedSaved.asistenteWhatsapp.limit, usage.usedFor(whatsappCap));
  const waBranchLimit = resolvedSaved.asistenteWhatsapp.limit;
  const waBranches = useWhatsappBranches(business.id, usage.period, waBranchLimit, tab === 'consumo');
  const waClients = useWhatsappClients(business.id, usage.period, tab === 'consumo');
  const waTotal = waUsage.used;

  return (
    <DetailPage title={business.name} subtitle={`${business.id} · ${business.ownerEmail}`} onBack={onClose}>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {/* ─────────── RESUMEN ─────────── */}
      {tab === 'resumen' && (
        <div className="space-y-5">
          <SectionLabel
            className="!mb-0"
            action={!editingInfo ? (
              <Button size="sm" variant="ghost" icon={Pencil} onClick={startEditInfo}>Editar</Button>
            ) : (
              <Button size="sm" variant="ghost" icon={X} onClick={() => setEditingInfo(false)}>Cancelar</Button>
            )}
          >
            Información
          </SectionLabel>

          {editingInfo ? (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
              <Field label="Nombre del negocio" value={infoForm.name} onChange={(e) => setInfoForm((f) => ({ ...f, name: e.target.value }))} />
              <Field label="Propietario" value={infoForm.ownerName} onChange={(e) => setInfoForm((f) => ({ ...f, ownerName: e.target.value }))} />
              <Field label="Teléfono" value={infoForm.phone} onChange={(e) => setInfoForm((f) => ({ ...f, phone: e.target.value }))} />
              <Field label="Ciudad" value={infoForm.city} onChange={(e) => setInfoForm((f) => ({ ...f, city: e.target.value }))} />
              <Field label="País" value={infoForm.country} onChange={(e) => setInfoForm((f) => ({ ...f, country: e.target.value }))} />
              <SelectField label="Tipo de negocio" value={infoForm.businessType} onChange={(e) => setInfoForm((f) => ({ ...f, businessType: e.target.value }))}>
                {BUSINESS_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </SelectField>
              {Object.keys(business.terminologyOverrides || {}).length > 0 && infoForm.businessType !== resolveBusinessType(business.businessType) && (
                <p className="text-xs text-warn sm:col-span-2">Al cambiar el tipo, las personalizaciones de terminología de este negocio se conservan.</p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button onClick={() => setEditingInfo(false)}>Cancelar</Button>
                <Button variant="primary" onClick={saveInfo} disabled={busy}>Guardar cambios</Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-lg border border-line bg-surface p-4 md:grid-cols-4">
              <Info label="Propietario">{business.ownerName || '—'}</Info>
              <Info label="Teléfono">{business.phone || '—'}</Info>
              <Info label="Ciudad">{business.city || '—'}{business.country ? `, ${business.country}` : ''}</Info>
              <Info label="Alta">{formatDate(business.createdAt) || '—'}</Info>
              <Info label="Tipo de negocio">
                {getBusinessTypeLabel(business.businessType)}
                {!business.businessType && <span className="text-xs text-subtle"> (por defecto)</span>}
              </Info>
              <Info label="Plan">{planName} <span className="text-xs text-subtle">{plan ? formatPrice(plan) : ''}</span></Info>
              <Info label="Estado"><StatusBadge status={business.status} /></Info>
              <Info label="Vencimiento">
                {business.subscriptionEnd
                  ? <>{formatDate(business.subscriptionEnd)} <span className="text-xs text-subtle">{relativeDays(business.subscriptionEnd)}</span></>
                  : '—'}
              </Info>
              <Info label="Prueba">{business.trialEnd ? <>{trialState} <span className="text-xs text-subtle">· hasta {formatDate(business.trialEnd)}</span></> : trialState}</Info>
              {['profesionales', 'sucursales'].map((key) => {
                const lim = resolvedSaved[key].limit;
                const used = usage.counts[key];
                const over = typeof lim === 'number' && typeof used === 'number' && used > lim;
                const full = typeof lim === 'number' && typeof used === 'number' && used >= lim;
                return (
                  <Info key={key} label={key === 'profesionales' ? 'Profesionales' : 'Sucursales'}>
                    {used ?? '…'} <span className="text-xs text-subtle">/ {limitText(getCapability(key), lim)}</span>
                    {over && <span className="block text-xs text-warn">Excede el límite: no puede registrar más (datos conservados)</span>}
                    {!over && full && <span className="block text-xs text-subtle">Cupo completo</span>}
                  </Info>
                );
              })}
              <Info label="Total mensual"><span className="nx-num">{monthly.currency} {monthly.total.toLocaleString('es-BO')}</span></Info>
              <Info label="Capacidades activas">{activeCount} <span className="text-xs text-subtle">· {overrideCount} excepciones</span></Info>
              <Info label="WhatsApp este mes">
                {resolvedSaved.asistenteWhatsapp.enabled
                  ? <>{waUsage.used} respuestas <span className="text-xs text-subtle">· máx. {limitText(whatsappCap, resolvedSaved.asistenteWhatsapp.limit)}</span></>
                  : <span className="text-subtle">No incluido</span>}
              </Info>
            </dl>
          )}

          {updateTerminology && <TerminologyEditor business={business} onSave={saveTerminology} busy={busy} />}

          <ExpiryNoticesSection negocioId={business.id} />

          <div className="border-t border-line pt-5">
            <SectionLabel>Acciones</SectionLabel>
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
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Label htmlFor={`plan-${business.id}`}>Cambiar plan</Label>
              <Select
                id={`plan-${business.id}`}
                size="sm"
                className="!w-auto max-w-full"
                value={business.plan || ''}
                disabled={busy}
                onChange={(e) => changePlan(e.target.value)}
              >
                <option value="">Sin plan (mínimo: 2 profesionales, 1 sucursal)</option>
                {plans.map((p) => {
                  const compatible = isPlanCompatible(p, businessProfile.vertical);
                  return (
                    <option key={p.id} value={p.id} disabled={(p.active === false || !compatible) && p.id !== business.plan}>
                      {p.name}{p.active === false ? ' (inactivo)' : ''}{!compatible ? ' (otro tipo de negocio)' : ''}
                    </option>
                  );
                })}
              </Select>
              <span className="text-xs text-subtle">Recalcula el vencimiento según el ciclo del plan. No reinicia la prueba gratuita.</span>
            </div>
          </div>

          {/* Complementos: se contratan aparte del plan (cobro manual) */}
          {updateAddons && (
            <div className="border-t border-line pt-5">
              <SectionLabel>Complementos</SectionLabel>
              <div className="space-y-3">
                {ADDONS.map((a) => {
                  const offer = getAddonOffer(plan, a.key);
                  const current = a.kind === 'quantity' ? addonsForm[a.businessField] > 0 : addonsForm[a.businessField] === true;
                  const unavailable = !plan || !offer.available;
                  return (
                    <div key={a.key} className="flex flex-wrap items-center gap-3">
                      {a.kind === 'quantity' ? (
                        <Input
                          size="sm"
                          type="number"
                          min="0"
                          max={a.max}
                          aria-label={a.label}
                          disabled={busy || (unavailable && !current)}
                          value={addonsForm[a.businessField]}
                          onChange={(e) => setAddonsForm((f) => ({ ...f, [a.businessField]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                          className="nx-num !w-16"
                        />
                      ) : (
                        <Toggle label={a.label} value={!!addonsForm[a.businessField]} onChange={(on) => { if (!unavailable || !on) setAddonsForm((f) => ({ ...f, [a.businessField]: on })); }} />
                      )}
                      <span className="min-w-0 flex-1 text-sm text-fg">
                        {a.label}
                        <span className="ml-1.5 text-xs text-subtle">
                          {plan ? `${plan.currency || 'Bs'} ${offer.price}/mes${a.kind === 'quantity' ? ` por ${a.unit}` : ''}` : ''}
                          {a.kind === 'toggle' && plan && getCapability(a.capability)?.limit ? ` · ${limitText(getCapability(a.capability), resolvedSaved[a.capability]?.limit)}` : ''}
                          {unavailable ? ' · no disponible en este plan' : ''}
                        </span>
                        {a.description && <span className="block text-xs text-subtle">{a.description}</span>}
                      </span>
                    </div>
                  );
                })}
                {/* Complementos antiguos: ya no se ofrecen. Solo se muestran si el
                    negocio los tiene contratados, y solo se pueden quitar. */}
                {LEGACY_ADDONS.filter((a) => normalizeAddons(business.addons)[a.businessField] === true).map((a) => {
                  const offer = getAddonOffer(plan, a.key);
                  const includedInPlan = !!resolveCapabilities({ planFeatures: plan?.features || null, profileDefaults, relevantModules })[a.capability]?.enabled;
                  return (
                    <div key={a.key} className="flex flex-wrap items-center gap-3">
                      <Toggle label={a.label} value={!!addonsForm[a.businessField]} onChange={(on) => { if (!on) setAddonsForm((f) => ({ ...f, [a.businessField]: false })); }} />
                      <span className="min-w-0 flex-1 text-sm text-fg">
                        {a.label}
                        <span className="ml-1.5 text-xs text-subtle">{plan ? `${plan.currency || 'Bs'} ${offer.price}/mes` : ''}</span>
                        <span className="block text-xs text-warn">
                          Ya no se ofrece como complemento: el asistente ahora lo incluye el plan.
                          {includedInPlan ? ' Este plan ya lo incluye: quítalo para no cobrarlo dos veces.' : ' Si lo quitas, el negocio pierde el asistente salvo que su plan lo incluya.'}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted">
                  Total mensual estimado: <b className="nx-num font-semibold text-fg">{monthlyDraft.currency} {monthlyDraft.total.toLocaleString('es-BO')}</b>
                  {addonsDirty && <span className="text-subtle"> (antes {monthly.currency} {monthly.total.toLocaleString('es-BO')})</span>}
                  <span className="text-subtle"> · cobro manual</span>
                </p>
                {addonsDirty && (
                  <Button size="sm" variant="primary" onClick={saveAddons} disabled={busy} className="ml-auto">
                    Guardar complementos
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────── CAPACIDADES ─────────── */}
      {tab === 'capacidades' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Prioridad: <b className="text-fg">Excepción del negocio</b> &gt; tipo de negocio (solo restringe) &gt; <b className="text-fg">Plan ({planName}) + complementos</b> &gt; valor por defecto.
            Las excepciones no cambian el plan.
          </p>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[640px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[12%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-2xs tracking-[0.06em] text-subtle uppercase">
                  <th className="px-3 py-2 font-semibold">Capacidad</th>
                  <th className="px-2 py-2 text-center font-semibold">Plan / tipo</th>
                  <th className="px-2 py-2 font-semibold">Excepción</th>
                  <th className="px-2 py-2 font-semibold">Límite</th>
                  <th className="px-2 py-2 text-center font-semibold">Resultado</th>
                </tr>
              </thead>
              {CAPABILITY_MODULES.map((mod) => {
                const caps = CAPABILITIES.filter((c) => c.module === mod.key && c.status !== 'soon' && !c.core);
                if (!caps.length) return null;
                const moduleHidden = Array.isArray(relevantModules) && !relevantModules.includes(mod.key);
                return (
                  <tbody key={mod.key} className="divide-y divide-line">
                    <tr className="bg-canvas">
                      <td colSpan={5} className="px-3 py-2 text-2xs font-semibold tracking-[0.06em] text-subtle uppercase">
                        {mod.label}
                        {moduleHidden && <span className="ml-2 font-normal normal-case tracking-normal text-warn">No relevante para {businessProfile.label}</span>}
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
                        <tr key={cap.key} className={isOverridden ? 'bg-brand-wash' : ''}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-fg">{cap.label}</span>
                              {cap.status !== 'implemented' && <CapStatusBadge status={cap.status} label={CAPABILITY_STATUS[cap.status].label} />}
                            </div>
                            {r.blockedBy && <p className="text-xs text-subtle">Requiere "{getCapability(r.blockedBy).label}"</p>}
                            {r.source === 'profile' && <p className="text-xs text-warn">Restringida por el tipo de negocio</p>}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {cap.kind === 'quota' ? <span className="text-muted">{limitText(cap, planVal.limit)}</span> : (
                              <>
                                {mark(planVal.enabled)}
                                {cap.limit && planVal.enabled && <span className="ml-1 text-subtle">{limitText(cap, planVal.limit)}</span>}
                                {r.source === 'addon' && getAddonForCapability(cap.key)?.legacy && (
                                  <Badge tone="warn" outline className="ml-1.5 align-middle">complemento antiguo</Badge>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {cap.kind !== 'quota' && (
                              <Select
                                size="sm"
                                aria-label={`Excepción para ${cap.label}`}
                                value={enabledMode}
                                onChange={(e) => setOverride(cap.key, { enabled: e.target.value === 'inherit' ? undefined : e.target.value === 'on' })}
                                className={enabledMode === 'inherit' ? '!text-muted' : '!border-brand'}
                              >
                                <option value="inherit">Heredar</option>
                                <option value="on">Activar</option>
                                <option value="off">Desactivar</option>
                              </Select>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {cap.limit && (
                              <div className="flex items-center gap-1.5">
                                <Toggle label={`Límite propio para ${cap.label}`} value={hasLimitOverride} onChange={(on) => setOverride(cap.key, { limit: on ? (planVal.limit ?? null) : undefined })} />
                                {hasLimitOverride ? (
                                  <LimitInput label={`Límite de ${cap.label}`} value={o.limit ?? null} onChange={(n) => setOverride(cap.key, { limit: n })} />
                                ) : (
                                  <span className="text-xs text-subtle">Del plan</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center" title={SOURCE_LABELS[cap.kind === 'quota' ? r.limitSource : r.source]}>
                            {cap.kind === 'quota' ? <span className="text-fg">{limitText(cap, r.limit)}</span> : (
                              <>
                                {mark(r.enabled)}
                                {cap.limit && r.enabled && <span className="ml-1 text-fg">{limitText(cap, r.limit)}</span>}
                              </>
                            )}
                            {isOverridden && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" aria-label="Modificada con excepción" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-subtle">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" /> Modificada con excepción. Pasa el cursor sobre el resultado para ver de dónde viene.
          </p>
          <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 border-t border-line bg-canvas px-1 py-3">
            <Button variant="primary" onClick={saveOverrides} disabled={busy || !draftDirty}>
              Guardar excepciones
            </Button>
            {draftDirty && (
              <Button icon={Undo2} onClick={() => { setDraftDirty(false); setDraft(business.capabilityOverrides || {}); }}>
                Descartar
              </Button>
            )}
            {Object.keys(draft).length > 0 && (
              <Button variant="ghost" className="!text-bad" onClick={() => { setDraftDirty(true); setDraft({}); }}>
                Quitar todas las excepciones
              </Button>
            )}
            <span className="text-xs text-subtle">Nexus se actualiza al instante; el backend en máx. 60 s.</span>
          </div>
        </div>
      )}

      {/* ─────────── CONSUMO ─────────── */}
      {tab === 'consumo' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-muted">Período</span>
            <Segmented
              label="Período"
              value={usage.period}
              onChange={setPeriod}
              options={[usage.period, previousPeriod(usage.period)].filter((v, i, arr) => arr.indexOf(v) === i).map((p) => ({ value: p, label: p }))}
            />
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={usage.refreshCounts} className="ml-auto">Actualizar</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-2xs tracking-[0.06em] text-subtle uppercase">
                  <th className="px-3 py-2 font-semibold">Capacidad</th>
                  <th className="px-3 py-2 font-semibold">Límite</th>
                  <th className="px-3 py-2 font-semibold">Consumo</th>
                  <th className="w-40 px-3 py-2 font-semibold">% usado</th>
                  <th className="px-3 py-2 font-semibold">Excedente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {limitedCaps.map((cap) => {
                  const r = resolvedSaved[cap.key];
                  const used = usage.usedFor(cap);
                  const perBranch = !!cap.limit.perBranch;
                  const st = usageStatus(perBranch ? null : r.limit, used);
                  const sucursalesAlLimite = perBranch ? waBranches.atLimit : 0;
                  return (
                    <tr key={cap.key}>
                      <td className="px-3 py-2 text-fg">
                        {cap.label}
                        <p className="text-xs text-subtle">{cap.limit.period === 'month' ? 'Mensual' : 'Cantidad actual'}{!r.enabled ? ' · no incluido' : ''}</p>
                      </td>
                      <td className="px-3 py-2 text-fg">{limitText(cap, r.limit)}</td>
                      <td className="px-3 py-2 text-fg">{used ?? '…'}</td>
                      <td className="px-3 py-2">
                        {st.percent === null || used === null ? <span className="text-subtle">—</span> : (
                          <div className="space-y-1">
                            <UsageBar percent={st.percent} exceeded={st.exceeded} />
                            <span className={st.exceeded ? 'text-bad' : 'text-muted'}>{st.percent}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {perBranch ? (
                          // WhatsApp (límite por sucursal): solo se muestra lo que no está en 0.
                          sucursalesAlLimite > 0 ? (
                            <span className="text-warn">{sucursalesAlLimite} {sucursalesAlLimite === 1 ? 'sucursal' : 'sucursales'} en el límite</span>
                          ) : <span className="text-subtle">—</span>
                        ) : (
                          st.overage > 0 ? <span className="text-bad">+{st.overage}</span> : <span className="text-subtle">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Consumo del Asistente de WhatsApp por sucursal (aquí se aplica el límite) */}
          {resolvedSaved.asistenteWhatsapp.enabled && (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <p className="border-b border-line px-3 py-2.5 text-sm font-medium text-fg">
                WhatsApp por sucursal ({usage.period})
                {usage.rejectedFor(whatsappCap) > 0 && (
                  <span className="ml-2 text-xs font-normal text-subtle">· {usage.rejectedFor(whatsappCap)} mensajes sin respuesta por límite este mes</span>
                )}
              </p>
              {waBranches.error ? (
                <p role="alert" className="px-3 py-3 text-sm text-bad">No se pudo leer: {waBranches.error}</p>
              ) : waBranches.rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-subtle">Este negocio no tiene sucursales ni respuestas registradas en este período.</p>
              ) : (
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-2xs tracking-[0.06em] text-subtle uppercase">
                      <th className="px-3 py-2 font-semibold">Sucursal</th>
                      <th className="px-3 py-2 font-semibold">Respuestas</th>
                      <th className="w-40 px-3 py-2 font-semibold">Del límite</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {waBranches.rows.map((b) => {
                      const unlinked = b.id === NO_BRANCH_ID;
                      const st = usageStatus(waBranchLimit, b.enviados);
                      return (
                        <tr key={b.id}>
                          <td className="px-3 py-2 text-fg">
                            {b.name}
                            {unlinked && <p className="text-xs text-subtle">Números sin sucursal vinculada (el negocio tiene varias). Vincúlalos en Automatización.</p>}
                          </td>
                          <td className="nx-num px-3 py-2 text-fg">{b.enviados}{typeof waBranchLimit === 'number' ? ` / ${waBranchLimit}` : ''}</td>
                          <td className="px-3 py-2">
                            {st.percent === null ? <span className="text-subtle">Sin límite</span> : (
                              <div className="space-y-1">
                                <UsageBar percent={st.percent} exceeded={st.exceeded} />
                                <span className={st.exceeded ? 'text-bad' : 'text-muted'}>{st.exceeded ? 'En el límite' : `${st.percent}%`}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Top 3 clientes del Asistente de WhatsApp en el período (informativo) */}
          {resolvedSaved.asistenteWhatsapp.enabled && (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <p className="border-b border-line px-3 py-2.5 text-sm font-medium text-fg">
                WhatsApp: clientes con más respuestas ({usage.period})
              </p>
              {waClients.error ? (
                <p role="alert" className="px-3 py-3 text-sm text-bad">No se pudo leer: {waClients.error}</p>
              ) : waClients.top.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-subtle">Sin respuestas registradas por cliente en este período.</p>
              ) : (
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-2xs tracking-[0.06em] text-subtle uppercase">
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Cliente (celular)</th>
                      <th className="px-3 py-2 font-semibold">Respuestas</th>
                      <th className="w-40 px-3 py-2 font-semibold">% del mes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {waClients.top.map((c, i) => {
                      const share = waTotal > 0 ? Math.min(100, Math.round((c.enviados / waTotal) * 100)) : null;
                      return (
                        <tr key={c.phone}>
                          <td className="px-3 py-2 text-subtle">{i + 1}</td>
                          <td className="px-3 py-2 text-fg">{formatPhone(c.phone)}</td>
                          <td className="nx-num px-3 py-2 text-fg">{c.enviados}</td>
                          <td className="px-3 py-2">
                            {share === null ? <span className="text-subtle">—</span> : (
                              <div className="space-y-1">
                                <UsageBar percent={share} />
                                <span className="text-muted">{share}%</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <p className="text-xs text-subtle">
            WhatsApp: el límite es por sucursal (el número de WhatsApp de cada sucursal). Cuando una sucursal llega a su límite del mes, el bot deja
            de responder solo en ese número; las demás sucursales siguen normales. Consumo = total de respuestas del bot en el mes. La tabla de
            clientes es solo informativa. Excedente (profesionales/sucursales) = cantidad por encima del límite.
          </p>
          {usage.error && <Notice tone="bad">{usage.error}</Notice>}

          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-fg">Verificar en el servidor</p>
                <p className="text-xs text-subtle">Pregunta a Railway qué permite realmente para este negocio (sin caché).</p>
              </div>
              <ActionButton icon={Server} onClick={verifyServer}>Verificar</ActionButton>
            </div>
            {serverError && <p role="alert" className="mt-2 text-xs text-bad">{serverError}</p>}
            {serverAccess && (
              <div className="mt-3 space-y-1 text-xs">
                <p className="text-muted">Estado en servidor: <StatusBadge status={serverAccess.status} /> · plan: {serverAccess.planName || 'Sin plan'}</p>
                {serverMismatches.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-ok"><Check size={14} aria-hidden="true" /> El backend aplica exactamente las mismas capacidades y límites.</p>
                ) : (
                  <p className="text-warn">
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
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-lg border border-line bg-surface p-4 md:grid-cols-4">
            <Info label="Estado de la prueba">{trialState}</Info>
            <Info label="Inicio">{formatDate(business.trialStart) || '—'}</Info>
            <Info label="Vencimiento">{formatDate(business.trialEnd) || '—'}</Info>
            <Info label="Días restantes"><span className="nx-num">{business.rawStatus === 'trial' && business.trialEnd ? Math.max(0, daysRemaining(business.trialEnd)) : '—'}</span></Info>
          </dl>

          <div className="flex flex-wrap items-end gap-2">
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

          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="mb-3 text-sm font-medium text-fg">Editar fechas manualmente</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Fecha de inicio" type="date" value={trialForm.trialStart} onChange={(e) => setTrialForm((f) => ({ ...f, trialStart: e.target.value }))} />
              <Field label="Fecha de vencimiento" type="date" value={trialForm.trialEnd} onChange={(e) => setTrialForm((f) => ({ ...f, trialEnd: e.target.value }))} />
              <div className="flex items-end">
                <Button variant="primary" block onClick={saveTrialDates} disabled={busy}>Guardar fechas</Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-subtle">Con estado "Prueba", al pasar la fecha de vencimiento el negocio queda Vencido automáticamente (Nexus y backend).</p>
          </div>
        </div>
      )}

      {/* ─────────── SEGURIDAD ─────────── */}
      {tab === 'seguridad' && (
        <div className="space-y-4">
          {secMsg.text && (
            <Notice tone={secMsg.type === 'error' ? 'bad' : 'ok'}>{secMsg.text}</Notice>
          )}

          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound size={16} className="text-brand-text" />
              <p className="text-sm font-medium text-fg">Contraseña del administrador</p>
            </div>
            <p className="mb-3 text-xs text-subtle">
              Cuenta: <span className="text-fg">{business.ownerEmail || '—'}</span>. Por seguridad la contraseña actual no se puede ver
              (Firebase solo guarda una versión cifrada). Aquí puedes poner una nueva: se muestra una sola vez para que se la pases al dueño.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <Label htmlFor={`pw-${business.id}`}>Nueva contraseña</Label>
                <PasswordInput
                  id={`pw-${business.id}`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Vacía: se genera una"
                  autoComplete="new-password"
                  visible={showPw}
                  onToggleVisible={() => setShowPw((v) => !v)}
                />
              </div>
              <ActionButton icon={KeyRound} disabled={busy} onClick={changePassword}>Cambiar contraseña</ActionButton>
            </div>
            {pwResult && (
              <Notice
                tone="ok"
                className="mt-3"
                title="Contraseña cambiada. Se muestra una sola vez."
                action={<Button size="sm" icon={pwCopied ? Check : Copy} onClick={copyPassword}>{pwCopied ? 'Copiado' : 'Copiar'}</Button>}
              >
                <p>{pwResult.email}: <span className="font-mono text-fg">{pwResult.password}</span></p>
              </Notice>
            )}
          </div>

          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-brand-text" />
                <p className="text-sm font-medium text-fg">Bloqueo de Analítica con PIN</p>
              </div>
              <Toggle
                label="Bloqueo de Analítica con PIN"
                value={business.analyticsPinEnabled}
                disabled={busy}
                onChange={(on) => updatePin({ enabled: on }, on ? 'PIN de Analítica activado' : 'PIN de Analítica desactivado', on ? 'bloqueo de Analítica activado' : 'bloqueo de Analítica desactivado')}
              />
            </div>
            <p className="mb-3 text-xs text-subtle">
              Si está activo, en Nexus la sección Analítica pide el PIN antes de mostrar ingresos y comisiones (también lo valida el backend).
              PIN actual: <Badge tone={business.hasFinancePin ? 'ok' : 'warn'}>{business.hasFinancePin ? 'configurado' : 'sin configurar (el dueño lo crea al entrar)'}</Badge>
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
        <Panel flush>
          {bizActivity.length === 0 ? (
            <EmptyState title="Sin actividad">Aún no hay acciones registradas para este negocio.</EmptyState>
          ) : (
            <ol className="divide-y divide-line">
              {bizActivity.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-fg">{a.type}</p>
                    <time className="nx-num text-xs text-subtle">{formatDateTime(a.createdAt) || a.date}</time>
                  </div>
                  <p className="mt-1 text-sm text-muted">{a.description}</p>
                  {a.actorEmail && <p className="mt-1 text-xs text-subtle">por {a.actorEmail}</p>}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}
    </DetailPage>
  );
}
