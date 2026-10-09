import { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, Check, Minus, ChevronDown, ChevronRight, AlertTriangle, Link2 } from 'lucide-react';
import { Modal, Field, Toggle, LimitInput, CapStatusBadge } from '../components/common';
import { BILLING_CYCLES, BILLING_LABELS, DEFAULT_TRIAL_DAYS, formatPrice } from '../data/planFeatures';
import {
  CAPABILITIES,
  CAPABILITY_MODULES,
  CAPABILITY_STATUS,
  resolveCapabilities,
  buildPlanFeatures,
  getCapability,
  getDependents,
} from '../shared/capabilityModel';

// Capacidades vendibles de un módulo (las "Próximamente" van aparte).
function moduleCaps(moduleKey) {
  return CAPABILITIES.filter((c) => c.module === moduleKey && c.status !== 'soon');
}

// Leyenda de estados de implementación (detectados del catálogo, no inventados).
const STATUS_HELP = {
  implemented: 'Funciona con datos reales.',
  partial: 'Funciona, pero incompleta.',
  mock: 'Maqueta: la pantalla existe pero no guarda datos reales. No es operativa.',
  soon: 'Pendiente: solo para planificación, no se puede activar.',
};

const emptyForm = {
  name: '',
  description: '',
  price: '',
  currency: 'Bs',
  billingCycle: 'monthly',
  active: true,
  trialDays: '',
  features: {},
};

// Borrador editable: { key: { enabled, limit } } partiendo de lo que el plan
// resuelve HOY (así un plan viejo muestra exactamente lo que ya veían sus negocios).
function draftFromPlan(planFeatures) {
  const resolved = resolveCapabilities({ planFeatures: planFeatures || null });
  const draft = {};
  for (const cap of CAPABILITIES) {
    if (cap.status === 'soon' || cap.core) continue;
    draft[cap.key] = { enabled: resolved[cap.key].enabled, limit: resolved[cap.key].limit };
  }
  return draft;
}

function describeLimit(cap, limit) {
  if (limit === null || limit === undefined) return 'Ilimitado';
  return `${limit} ${cap.limit?.unit || ''}`.trim();
}

/** Lista de cambios de capacidades entre dos `features` (para la bitácora). */
function diffFeatures(beforeFeatures, afterFeatures) {
  const a = resolveCapabilities({ planFeatures: beforeFeatures || null });
  const b = resolveCapabilities({ planFeatures: afterFeatures || null });
  const changes = [];
  for (const cap of CAPABILITIES) {
    if (a[cap.key].enabled !== b[cap.key].enabled) changes.push(`${cap.label}: ${a[cap.key].enabled ? '✓' : '✗'} → ${b[cap.key].enabled ? '✓' : '✗'}`);
    if (cap.limit && a[cap.key].limit !== b[cap.key].limit) changes.push(`${cap.label} (límite): ${describeLimit(cap, a[cap.key].limit)} → ${describeLimit(cap, b[cap.key].limit)}`);
  }
  return changes;
}

export default function PlansPage({ plans, businesses = [], createPlan, updatePlan, deletePlan, pushActivity }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showSoon, setShowSoon] = useState(false);
  const [collapsed, setCollapsed] = useState({}); // { [moduleKey]: true }
  const [confirmDelete, setConfirmDelete] = useState(null);

  const usageByPlan = useMemo(() => {
    const m = {};
    for (const b of businesses) if (b.plan) m[b.plan] = (m[b.plan] || 0) + 1;
    return m;
  }, [businesses]);

  const soonCaps = CAPABILITIES.filter((c) => c.status === 'soon');
  const draftResolved = useMemo(() => resolveCapabilities({ planFeatures: form.features }), [form.features]);

  // Resumen del borrador: qué queda habilitado / deshabilitado / no operativo,
  // y qué capacidades marcadas no funcionarán porque falta su requisito.
  const draftSummary = useMemo(() => {
    const toggles = CAPABILITIES.filter((c) => c.status !== 'soon' && !c.core && c.kind !== 'quota');
    const enabled = toggles.filter((c) => draftResolved[c.key]?.enabled);
    const blocked = toggles.filter((c) => form.features[c.key]?.enabled && draftResolved[c.key]?.blockedBy);
    return {
      enabled: enabled.length,
      disabled: toggles.length - enabled.length,
      nonOperational: enabled.filter((c) => c.status === 'mock'),
      blocked,
    };
  }, [draftResolved, form.features]);

  function openCreate() {
    setForm({ ...emptyForm, features: draftFromPlan(null) });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(plan) {
    setForm({
      name: plan.name || '',
      description: plan.description || '',
      price: plan.price ?? '',
      currency: plan.currency || 'Bs',
      billingCycle: plan.billingCycle || 'monthly',
      active: plan.active !== false,
      trialDays: plan.trialDays ?? '',
      features: draftFromPlan(plan.features),
    });
    setEditingId(plan.id);
    setShowForm(true);
  }

  function setCap(key, patch) {
    setForm((f) => ({ ...f, features: { ...f.features, [key]: { ...f.features[key], ...patch } } }));
  }

  /** Activa la capacidad que falta (y, en cadena, las que ella requiera). */
  function includeRequirement(key) {
    setForm((f) => {
      const features = { ...f.features };
      let k = key;
      while (k) {
        const cap = getCapability(k);
        if (!cap || cap.core || cap.kind === 'quota') break;
        features[k] = { ...features[k], enabled: true };
        k = cap.requires;
      }
      return { ...f, features };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const before = plans.find((p) => p.id === editingId);
        await updatePlan(editingId, form);
        const changes = diffFeatures(before?.features, buildPlanFeatures(form.features));
        const meta = [];
        if (before && Number(before.price || 0) !== Number(form.price || 0)) meta.push(`Precio: ${before.price ?? 0} → ${form.price || 0}`);
        if (before && (before.active !== false) !== form.active) meta.push(`Estado: ${form.active ? 'activo' : 'inactivo'}`);
        await pushActivity('Plan editado', `Se actualizó el plan "${form.name}"${[...meta, ...changes].length ? ` — ${[...meta, ...changes].join('; ')}` : ''}`, {
          planId: editingId,
          before: before ? { price: before.price ?? null, active: before.active !== false, features: before.features || {} } : null,
          after: { price: Number(form.price) || 0, active: form.active, features: buildPlanFeatures(form.features) },
        });
      } else {
        const id = await createPlan(form);
        await pushActivity('Plan creado', `Se creó el plan "${form.name}"`, { planId: id });
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plan) {
    await deletePlan(plan.id);
    await pushActivity('Plan eliminado', `Se eliminó el plan "${plan.name}"`, { planId: plan.id, before: { name: plan.name } });
    setConfirmDelete(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Planes</h1>
          <p className="mt-1 text-sm text-slate-500">{plans.length} planes · cada plan es un conjunto de capacidades</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600">
          <Plus size={16} /> Crear plan
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const resolved = resolveCapabilities({ planFeatures: plan.features || null });
          return (
            <div key={plan.id} className={`rounded-2xl border bg-slate-900 p-5 ${plan.active === false ? 'border-white/5 opacity-60' : 'border-white/5'}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-lg font-semibold text-white">{plan.name}</p>
                    {plan.active === false && <span className="rounded-md bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400">Inactivo</span>}
                  </div>
                  <p className="text-sm text-slate-400">
                    {formatPrice(plan)} <span className="text-slate-600">· {BILLING_LABELS[plan.billingCycle] || plan.billingCycle}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">{usageByPlan[plan.id] || 0} negocios con este plan</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(plan)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setConfirmDelete(plan)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {plan.description && <p className="mt-2 text-xs text-slate-500">{plan.description}</p>}

              <div className="mt-4 space-y-3 text-sm">
                {CAPABILITY_MODULES.map((mod) => {
                  const caps = moduleCaps(mod.key);
                  if (!caps.length) return null;
                  return (
                    <div key={mod.key}>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">{mod.label}</p>
                      {caps.map((cap) => {
                        const v = resolved[cap.key];
                        return (
                          <div key={cap.key} className="flex items-center justify-between py-0.5">
                            <span className={`text-xs ${v.enabled ? 'text-slate-300' : 'text-slate-600'}`}>
                              {cap.label}
                              {cap.status === 'mock' && <span className="ml-1 text-[10px] text-amber-500/80">(maqueta, no operativa)</span>}
                              {cap.status === 'partial' && <span className="ml-1 text-[10px] text-sky-400/80">(parcial)</span>}
                            </span>
                            {v.enabled ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-400">
                                {cap.limit ? <span className="text-slate-400">{describeLimit(cap, v.limit)}</span> : <Check size={12} />}
                              </span>
                            ) : (
                              <Minus size={12} className="text-slate-700" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {plans.length === 0 && (
          <p className="col-span-3 py-8 text-center text-sm text-slate-600">Todavía no hay planes creados.</p>
        )}
      </div>

      {confirmDelete && (
        <Modal title="Eliminar plan" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            {(usageByPlan[confirmDelete.id] || 0) > 0 ? (
              <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <AlertTriangle size={16} className="shrink-0" />
                <span>
                  {usageByPlan[confirmDelete.id]} negocios usan "{confirmDelete.name}". Si lo eliminas quedarán sin plan y usarán
                  las capacidades por defecto. Mejor márcalo como <b>inactivo</b> para que no se pueda asignar a negocios nuevos.
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400">¿Eliminar el plan "{confirmDelete.name}"? Ningún negocio lo usa.</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg bg-slate-800 py-2 text-sm text-white hover:bg-slate-700">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 rounded-lg bg-red-500/80 py-2 text-sm font-medium text-white hover:bg-red-500">Eliminar</button>
            </div>
          </div>
        </Modal>
      )}

      {showForm && (
        <Modal title={editingId ? 'Editar plan' : 'Crear plan'} onClose={() => setShowForm(false)} size="xl">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <Field label="Nombre del plan" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <Field label="Precio" type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              <Field label="Moneda" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
              <div className="md:col-span-4">
                <Field label="Descripción" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-5">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Ciclo de cobro</label>
                <div className="flex flex-wrap gap-2">
                  {BILLING_CYCLES.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setForm((f) => ({ ...f, billingCycle: c.key }))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        form.billingCycle === c.key ? 'bg-indigo-500/25 text-indigo-300' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-40">
                <Field
                  label="Días de prueba (opcional)"
                  type="number"
                  min="0"
                  placeholder={String(DEFAULT_TRIAL_DAYS)}
                  value={form.trialDays}
                  onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-white">
                <Toggle value={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} />
                {form.active ? 'Activo (se puede asignar)' : 'Inactivo'}
              </label>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">Capacidades incluidas, por módulo de Nexus</p>
                <p className="text-[11px] text-slate-500">
                  <span className="text-emerald-400">{draftSummary.enabled} habilitadas</span>
                  {' · '}<span>{draftSummary.disabled} deshabilitadas</span>
                  {draftSummary.nonOperational.length > 0 && (
                    <>{' · '}<span className="text-amber-400">{draftSummary.nonOperational.length} no operativas (maqueta)</span></>
                  )}
                </p>
              </div>

              {/* Leyenda de estados */}
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(CAPABILITY_STATUS).map(([key, st]) => (
                  <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-500" title={STATUS_HELP[key]}>
                    <CapStatusBadge status={key} label={st.label} />
                    <span className="hidden sm:inline">{STATUS_HELP[key]}</span>
                  </span>
                ))}
              </div>

              {/* Aviso: capacidades marcadas cuyo requisito no está incluido */}
              {draftSummary.blocked.length > 0 && (
                <div className="mb-3 space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <p className="flex items-center gap-1.5 font-medium"><AlertTriangle size={14} /> Estas capacidades están marcadas pero NO quedarán habilitadas:</p>
                  {draftSummary.blocked.map((cap) => {
                    const req = getCapability(draftResolved[cap.key].blockedBy);
                    return (
                      <div key={cap.key} className="flex flex-wrap items-center gap-2 pl-5">
                        <span>"{cap.label}" necesita "{req.label}".</span>
                        <button onClick={() => includeRequirement(req.key)} className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] text-amber-200 hover:bg-amber-500/30">
                          Incluir "{req.label}"
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-3">
                {CAPABILITY_MODULES.map((mod) => {
                  const caps = moduleCaps(mod.key);
                  if (!caps.length) return null;
                  const isCollapsed = !!collapsed[mod.key];
                  const enabledHere = caps.filter((c) => draftResolved[c.key]?.enabled).length;
                  return (
                    <div key={mod.key} className="rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setCollapsed((c) => ({ ...c, [mod.key]: !c[mod.key] }))}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left ${isCollapsed ? '' : 'border-b border-white/5'}`}
                      >
                        {isCollapsed ? <ChevronRight size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                        <span className="flex-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{mod.label}</span>
                        <span className="text-[11px] text-slate-500">{enabledHere}/{caps.length}</span>
                      </button>
                      {!isCollapsed && (
                      <div className="divide-y divide-white/5">
                        {caps.map((cap) => {
                          if (cap.core) {
                            return (
                              <div key={cap.key} className="flex items-center justify-between px-3 py-1.5">
                                <span className="text-xs text-slate-300">{cap.label}</span>
                                <span className="text-[11px] text-slate-500">Siempre incluida</span>
                              </div>
                            );
                          }
                          const v = form.features[cap.key] || { enabled: false, limit: null };
                          const r = draftResolved[cap.key] || {};
                          // Dependencias en cadena (ej. Historial → Ficha → Clientes).
                          const parent = cap.requires ? getCapability(cap.requires) : null;
                          const parentMissing = !!r.blockedBy;
                          const dependents = getDependents(cap.key);
                          const lostDependents = !r.enabled ? dependents.filter((d) => form.features[d.key]?.enabled) : [];
                          const isQuota = cap.kind === 'quota';
                          return (
                            <div key={cap.key} className={`flex flex-wrap items-center gap-3 px-3 py-1.5 ${parentMissing && v.enabled ? 'bg-amber-500/5' : ''}`}>
                              {!isQuota && (
                                <Toggle value={!!v.enabled} onChange={(on) => setCap(cap.key, { enabled: on })} />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-xs ${isQuota || r.enabled ? 'text-slate-200' : 'text-slate-500'}`}>{cap.label}</span>
                                  {cap.status !== 'implemented' && <CapStatusBadge status={cap.status} label={CAPABILITY_STATUS[cap.status].label} />}
                                  {!isQuota && (
                                    <span className={`text-[10px] ${r.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                                      {r.enabled ? 'Habilitada' : 'Deshabilitada'}
                                    </span>
                                  )}
                                </div>
                                {cap.status === 'mock' && (
                                  <p className="text-[11px] text-amber-500/80">Maqueta: la pantalla existe pero todavía no guarda datos reales.</p>
                                )}
                                {parent && (
                                  <p className={`flex items-center gap-1 text-[11px] ${parentMissing && v.enabled ? 'text-amber-400' : 'text-slate-500'}`}>
                                    <Link2 size={11} /> Requiere "{parent.label}"{parentMissing && v.enabled ? ' — no está incluida' : ''}
                                  </p>
                                )}
                                {dependents.length > 0 && (
                                  <p className={`text-[11px] ${lostDependents.length ? 'text-amber-400' : 'text-slate-600'}`}>
                                    {lostDependents.length
                                      ? `Al no incluirla se desactivan: ${lostDependents.map((d) => d.label).join(', ')}`
                                      : `Necesaria para: ${dependents.map((d) => d.label).join(', ')}`}
                                  </p>
                                )}
                              </div>
                              {cap.limit && (isQuota || v.enabled) && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500">Límite {cap.limit.unit}</span>
                                  <LimitInput value={v.limit} onChange={(n) => setCap(cap.key, { limit: n })} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  );
                })}

                <div className="rounded-xl border border-dashed border-white/10">
                  <button onClick={() => setShowSoon((s) => !s)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {showSoon ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Pendientes ({soonCaps.length}) — solo planificación, no se pueden activar
                  </button>
                  {showSoon && (
                    <div className="flex flex-wrap gap-2 px-3 pb-3">
                      {soonCaps.map((cap) => (
                        <span key={cap.key} className="rounded-md bg-slate-800/60 px-2 py-1 text-xs text-slate-500">
                          {cap.label} <span className="text-slate-600">· {CAPABILITY_MODULES.find((m) => m.key === cap.module)?.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-600">Límite vacío = ilimitado. Los cambios se aplican en tiempo real a todos los negocios con este plan (backend: máx. 60 s).</p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear plan'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
