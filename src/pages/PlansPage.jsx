import { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, Check, Minus, ChevronDown, ChevronRight, Link2, ListPlus, Power } from 'lucide-react';
import {
  Modal, Field, SelectField, Toggle, LimitInput, CapStatusBadge, Button, Badge, PageHeader, Notice, EmptyState, Segmented, Label, Input,
} from '../components/common';
import { BILLING_CYCLES, BILLING_LABELS, DEFAULT_TRIAL_DAYS, formatPrice } from '../data/planFeatures';
import {
  CAPABILITIES,
  CAPABILITY_MODULES,
  CAPABILITY_STATUS,
  resolveCapabilities,
  buildPlanFeatures,
  getCapability,
  getDependents,
  ADDONS,
  PLAN_VERTICALS,
  LAUNCH_PLAN_PRESETS,
  getAddonOffer,
  sellableCapabilities,
  isCapabilityInVertical,
} from '../shared/capabilityModel';

// Capacidades vendibles de un módulo (las "Próximamente" van aparte).
// Con vertical, solo las de esa vertical (citas no muestra restaurante).
function moduleCaps(moduleKey, vertical = null) {
  return CAPABILITIES.filter((c) => c.module === moduleKey && c.status !== 'soon' && isCapabilityInVertical(c, vertical));
}

const VERTICAL_LABELS = Object.fromEntries(PLAN_VERTICALS.map((v) => [v.key, v.label]));

function addonsDraft(plan) {
  const out = {};
  for (const a of ADDONS) {
    const offer = getAddonOffer(plan, a.key);
    out[a.key] = { available: offer.available, price: offer.price };
  }
  return out;
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
  vertical: 'citas',
  order: '',
  setupFee: 0,
  addons: addonsDraft(null),
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

export default function PlansPage({ plans, businesses = [], createPlan, updatePlan, deletePlan, setPlanActive, seedLaunchPlans, pushActivity }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showSoon, setShowSoon] = useState(false);
  const [collapsed, setCollapsed] = useState({}); // { [moduleKey]: true }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const missingLaunch = LAUNCH_PLAN_PRESETS.filter(
    (p) => !plans.some((x) => x.id === p.id || (x.name || '').trim().toLowerCase() === p.name.toLowerCase()),
  );

  async function handleSeed() {
    setSeeding(true);
    try {
      const r = await seedLaunchPlans();
      setSeedResult(r);
      if (r.created.length) {
        await pushActivity('Planes de lanzamiento creados', `Se crearon: ${r.created.join(', ')}${r.skipped.length ? ` (ya existían: ${r.skipped.join(', ')})` : ''}`, {
          after: { created: r.created },
        });
      }
    } catch (err) {
      setSeedResult({ error: err.message });
    } finally {
      setSeeding(false);
    }
  }

  async function toggleActive(plan) {
    const next = plan.active === false;
    await setPlanActive(plan.id, next);
    await pushActivity(next ? 'Plan activado' : 'Plan desactivado', `"${plan.name}" ${next ? 'vuelve a estar disponible para asignar' : 'ya no se puede asignar a negocios nuevos'} (los ${usageByPlan[plan.id] || 0} negocios que lo usan lo conservan)`, {
      planId: plan.id, before: { active: !next }, after: { active: next },
    });
  }

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
    const toggles = CAPABILITIES.filter((c) => c.status !== 'soon' && !c.core && c.kind !== 'quota' && isCapabilityInVertical(c, form.vertical || null));
    const enabled = toggles.filter((c) => draftResolved[c.key]?.enabled);
    const blocked = toggles.filter((c) => form.features[c.key]?.enabled && draftResolved[c.key]?.blockedBy);
    return {
      enabled: enabled.length,
      disabled: toggles.length - enabled.length,
      nonOperational: enabled.filter((c) => c.status === 'mock'),
      blocked,
    };
  }, [draftResolved, form.features, form.vertical]);

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
      vertical: plan.vertical || '',
      order: plan.order ?? '',
      setupFee: plan.setupFee ?? 0,
      addons: addonsDraft(plan),
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
        const changes = diffFeatures(before?.features, buildPlanFeatures(form.features, { vertical: form.vertical || null }));
        const meta = [];
        if (before && Number(before.price || 0) !== Number(form.price || 0)) meta.push(`Precio: ${before.price ?? 0} → ${form.price || 0}`);
        if (before && (before.active !== false) !== form.active) meta.push(`Estado: ${form.active ? 'activo' : 'inactivo'}`);
        for (const a of ADDONS) {
          const was = getAddonOffer(before, a.key);
          const now = form.addons?.[a.key] || {};
          if (was && Number(was.price) !== Number(now.price)) meta.push(`${a.label}: ${was.price} → ${now.price}`);
          if (was && was.available !== (now.available !== false)) meta.push(`${a.label}: ${now.available !== false ? 'disponible' : 'no disponible'}`);
        }
        await pushActivity('Plan editado', `Se actualizó el plan "${form.name}"${[...meta, ...changes].length ? ` — ${[...meta, ...changes].join('; ')}` : ''}`, {
          planId: editingId,
          before: before ? { price: before.price ?? null, active: before.active !== false, features: before.features || {} } : null,
          after: { price: Number(form.price) || 0, active: form.active, features: buildPlanFeatures(form.features, { vertical: form.vertical || null }) },
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
      <PageHeader
        title="Planes"
        description={`${plans.length} ${plans.length === 1 ? 'plan' : 'planes'} · cada plan es un conjunto de capacidades`}
        actions={(
          <>
            {missingLaunch.length > 0 && (
              <Button
                icon={ListPlus}
                onClick={handleSeed}
                disabled={seeding}
                title={`Crea solo los que faltan (${missingLaunch.map((p) => p.name).join(', ')}). Nunca reemplaza planes existentes.`}
              >
                {seeding ? 'Creando…' : `Crear planes de lanzamiento (${missingLaunch.length})`}
              </Button>
            )}
            <Button variant="primary" icon={Plus} onClick={openCreate}>Crear plan</Button>
          </>
        )}
      />

      {seedResult && (
        <Notice tone={seedResult.error ? 'bad' : 'ok'} className="mb-4">
          {seedResult.error
            ? `No se pudieron crear los planes: ${seedResult.error}`
            : <>
                {seedResult.created.length ? `Creados: ${seedResult.created.join(', ')}.` : 'No se creó ningún plan.'}
                {seedResult.skipped.length > 0 && ` Ya existían (no se tocaron): ${seedResult.skipped.join(', ')}.`}
              </>}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const resolved = resolveCapabilities({ planFeatures: plan.features || null });
          return (
            <article key={plan.id} className={`flex flex-col rounded-lg border border-line bg-surface p-5 ${plan.active === false ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-fg">{plan.name}</h2>
                    {plan.active === false && <Badge tone="neutral" outline>Inactivo</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-fg">
                    <span className="nx-num text-xl font-semibold tracking-[-0.01em]">{formatPrice(plan)}</span>
                    <span className="ml-1.5 text-subtle">{BILLING_LABELS[plan.billingCycle] || plan.billingCycle}</span>
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    {usageByPlan[plan.id] || 0} negocios con este plan
                    {plan.vertical ? ` · ${VERTICAL_LABELS[plan.vertical] || plan.vertical}` : ''}
                  </p>
                </div>
                <div className="-mt-1 -mr-1.5 flex shrink-0 gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleActive(plan)}
                    aria-label={plan.active === false ? `Activar ${plan.name}` : `Desactivar ${plan.name}`}
                    title={plan.active === false ? 'Activar (se podrá asignar)' : 'Desactivar (los negocios que lo usan lo conservan)'}
                    className={plan.active === false ? '' : '!text-ok'}
                  >
                    <Power size={15} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(plan)} aria-label={`Editar ${plan.name}`} title="Editar">
                    <Pencil size={15} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(plan)} aria-label={`Eliminar ${plan.name}`} title="Eliminar" className="hover:!text-bad">
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
              {plan.description && <p className="mt-3 text-sm text-muted">{plan.description}</p>}

              {/* Límites y condiciones comerciales */}
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-3 text-sm">
                <div>
                  <dt className="text-xs text-subtle">Profesionales</dt>
                  <dd className="mt-0.5 font-medium text-fg">{describeLimit(getCapability('profesionales'), resolved.profesionales.limit)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Sucursales</dt>
                  <dd className="mt-0.5 font-medium text-fg">{describeLimit(getCapability('sucursales'), resolved.sucursales.limit)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Prueba</dt>
                  <dd className="mt-0.5 text-fg">{plan.trialDays || DEFAULT_TRIAL_DAYS} días</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Activación</dt>
                  <dd className="mt-0.5 text-fg">{Number(plan.setupFee) > 0 ? `${plan.currency || 'Bs'} ${plan.setupFee}` : 'Gratis'}</dd>
                </div>
              </dl>

              {/* Lo que se puede promocionar: solo funciones operativas */}
              <div className="mt-4">
                <p className="mb-2 text-2xs font-semibold tracking-[0.06em] text-subtle uppercase">Incluye</p>
                <ul className="flex flex-wrap gap-1.5">
                  {sellableCapabilities(resolved).map((c) => (
                    <li key={c.key} className="rounded-sm border border-line px-1.5 text-xs leading-5 text-fg">{c.label}</li>
                  ))}
                </ul>
              </div>

              {/* Complementos: se contratan aparte, nunca incluidos */}
              <div className="mt-4">
                <p className="mb-1.5 text-2xs font-semibold tracking-[0.06em] text-subtle uppercase">Complementos (aparte)</p>
                {ADDONS.map((a) => {
                  const o = getAddonOffer(plan, a.key);
                  return (
                    <p key={a.key} className={`text-xs leading-5 ${o.available ? 'text-muted' : 'text-subtle line-through'}`}>
                      {a.label}: {plan.currency || 'Bs'} {o.price}/mes{a.kind === 'quantity' ? ` por ${a.unit}` : ''}
                    </p>
                  );
                })}
              </div>

              <details className="mt-auto pt-4">
                <summary className="w-fit cursor-pointer rounded-sm text-xs font-medium text-brand-text hover:text-fg">Ver todas las capacidades</summary>
              <div className="mt-3 space-y-3 text-sm">
                {CAPABILITY_MODULES.map((mod) => {
                  const caps = moduleCaps(mod.key, plan.vertical || null);
                  if (!caps.length) return null;
                  return (
                    <div key={mod.key}>
                      <p className="mb-1 text-2xs font-semibold tracking-[0.06em] text-subtle uppercase">{mod.label}</p>
                      {caps.map((cap) => {
                        const v = resolved[cap.key];
                        return (
                          <div key={cap.key} className="flex items-center justify-between py-0.5">
                            <span className={`text-xs ${v.enabled ? 'text-fg' : 'text-subtle'}`}>
                              {cap.label}
                              {cap.status === 'mock' && <span className="ml-1 text-warn">(maqueta, no operativa)</span>}
                              {cap.status === 'partial' && <span className="ml-1 text-brand-text">(parcial)</span>}
                            </span>
                            {v.enabled ? (
                              <span className="flex items-center gap-1 text-xs text-ok">
                                {cap.limit ? <span className="text-muted">{describeLimit(cap, v.limit)}</span> : <Check size={12} />}
                              </span>
                            ) : (
                              <Minus size={12} className="text-subtle" aria-label="No incluida" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              </details>
            </article>
          );
        })}
      </div>
      {plans.length === 0 && (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState title="Aún no hay planes" action={<Button variant="primary" size="sm" icon={Plus} onClick={openCreate}>Crear plan</Button>}>
            Un plan define qué capacidades y límites tiene cada negocio.
          </EmptyState>
        </div>
      )}

      {confirmDelete && (
        <Modal title="Eliminar plan" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            {(usageByPlan[confirmDelete.id] || 0) > 0 ? (
              <Notice tone="warn" title="Este plan está en uso y no se puede eliminar">
                <p>
                  {usageByPlan[confirmDelete.id]} negocios usan "{confirmDelete.name}". Desactívalo: dejará de poder asignarse,
                  y esos negocios conservan el plan, sus capacidades y sus datos.
                </p>
              </Notice>
            ) : (
              <p className="text-sm text-muted">¿Eliminar el plan "{confirmDelete.name}"? Ningún negocio lo usa. Esta acción no se puede deshacer.</p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              {(usageByPlan[confirmDelete.id] || 0) > 0 ? (
                confirmDelete.active !== false && (
                  <Button variant="primary" icon={Power} onClick={async () => { await toggleActive(confirmDelete); setConfirmDelete(null); }}>Desactivar plan</Button>
                )
              ) : (
                <Button variant="danger" icon={Trash2} onClick={() => handleDelete(confirmDelete)}>Eliminar plan</Button>
              )}
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
              <Field label="Precio mensual" type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              <Field label="Moneda" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
              <div className="md:col-span-4">
                <Field label="Descripción" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <SelectField
                  label="Tipo de negocio del plan"
                  value={form.vertical || ''}
                  onChange={(e) => setForm((f) => ({ ...f, vertical: e.target.value }))}
                >
                  {PLAN_VERTICALS.map((v) => (
                    <option key={v.key} value={v.key} disabled={!v.sellable && form.vertical !== v.key}>{v.label}</option>
                  ))}
                  {!form.vertical && <option value="">General (plan anterior)</option>}
                </SelectField>
              </div>
              <Field label={`Activación (${form.currency || 'Bs'})`} type="number" min="0" value={form.setupFee} onChange={(e) => setForm((f) => ({ ...f, setupFee: e.target.value }))} />
              <Field label="Orden" type="number" min="1" placeholder="1, 2, 3…" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Complementos (se contratan aparte; el plan nunca los incluye)</p>
              <div className="divide-y divide-line rounded-lg border border-line">
                {ADDONS.map((a) => {
                  const v = form.addons?.[a.key] || {};
                  return (
                    <div key={a.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <Toggle
                        label={`${a.label} disponible`}
                        value={v.available !== false}
                        onChange={(on) => setForm((f) => ({ ...f, addons: { ...f.addons, [a.key]: { ...v, available: on } } }))}
                      />
                      <span className={`min-w-0 flex-1 text-sm ${v.available !== false ? 'text-fg' : 'text-subtle'}`}>
                        {a.label}{a.description ? <span className="block text-xs text-subtle">{a.description}</span> : null}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-subtle">{form.currency || 'Bs'}</span>
                        <Input
                          size="sm"
                          type="number"
                          min="0"
                          aria-label={`Precio de ${a.label}`}
                          value={v.price ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, addons: { ...f.addons, [a.key]: { ...v, price: e.target.value } } }))}
                          className="nx-num !w-20"
                        />
                        <span className="text-xs text-subtle">/mes{a.kind === 'quantity' ? ` por ${a.unit}` : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-5">
              <div>
                <Label>Ciclo de cobro</Label>
                <Segmented
                  label="Ciclo de cobro"
                  value={form.billingCycle}
                  onChange={(key) => setForm((f) => ({ ...f, billingCycle: key }))}
                  options={BILLING_CYCLES.map((c) => ({ value: c.key, label: c.label }))}
                />
              </div>
              <div className="w-48">
                <Field
                  label="Días de prueba (opcional)"
                  type="number"
                  min="0"
                  placeholder={String(DEFAULT_TRIAL_DAYS)}
                  value={form.trialDays}
                  onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-fg">
                <Toggle label="Plan activo" value={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} />
                {form.active ? 'Activo (se puede asignar)' : 'Inactivo'}
              </label>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted">Capacidades incluidas, por módulo de Nexus</p>
                <p className="text-xs text-subtle">
                  <span className="text-ok">{draftSummary.enabled} habilitadas</span>
                  {' · '}<span>{draftSummary.disabled} deshabilitadas</span>
                  {draftSummary.nonOperational.length > 0 && (
                    <>{' · '}<span className="text-warn">{draftSummary.nonOperational.length} no operativas (maqueta)</span></>
                  )}
                </p>
              </div>

              {/* Leyenda de estados */}
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(CAPABILITY_STATUS).map(([key, st]) => (
                  <span key={key} className="flex items-center gap-1.5 text-xs text-subtle" title={STATUS_HELP[key]}>
                    <CapStatusBadge status={key} label={st.label} />
                    <span className="hidden sm:inline">{STATUS_HELP[key]}</span>
                  </span>
                ))}
              </div>

              {/* Aviso: capacidades marcadas cuyo requisito no está incluido */}
              {draftSummary.blocked.length > 0 && (
                <Notice tone="warn" className="mb-3" title="Estas capacidades están marcadas pero no quedarán habilitadas">
                  {draftSummary.blocked.map((cap) => {
                    const req = getCapability(draftResolved[cap.key].blockedBy);
                    return (
                      <div key={cap.key} className="flex flex-wrap items-center gap-2">
                        <span>"{cap.label}" necesita "{req.label}".</span>
                        <Button size="sm" onClick={() => includeRequirement(req.key)}>
                          Incluir "{req.label}"
                        </Button>
                      </div>
                    );
                  })}
                </Notice>
              )}

              <div className="space-y-3">
                {CAPABILITY_MODULES.map((mod) => {
                  const caps = moduleCaps(mod.key, form.vertical || null);
                  if (!caps.length) return null;
                  const isCollapsed = !!collapsed[mod.key];
                  const enabledHere = caps.filter((c) => draftResolved[c.key]?.enabled).length;
                  return (
                    <div key={mod.key} className="rounded-lg border border-line">
                      <button
                        type="button"
                        onClick={() => setCollapsed((c) => ({ ...c, [mod.key]: !c[mod.key] }))}
                        aria-expanded={!isCollapsed}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-raised ${isCollapsed ? '' : 'rounded-b-none border-b border-line'}`}
                      >
                        {isCollapsed ? <ChevronRight size={14} className="text-subtle" /> : <ChevronDown size={14} className="text-subtle" />}
                        <span className="flex-1 text-sm font-medium text-fg">{mod.label}</span>
                        <span className="nx-num text-xs text-subtle">{enabledHere}/{caps.length}</span>
                      </button>
                      {!isCollapsed && (
                      <div className="divide-y divide-line">
                        {caps.map((cap) => {
                          if (cap.core) {
                            return (
                              <div key={cap.key} className="flex items-center justify-between px-3 py-2">
                                <span className="text-sm text-fg">{cap.label}</span>
                                <span className="text-xs text-subtle">Siempre incluida</span>
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
                            <div key={cap.key} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${parentMissing && v.enabled ? 'border-l-2 border-l-warn' : ''}`}>
                              {!isQuota && (
                                <Toggle label={cap.label} value={!!v.enabled} onChange={(on) => setCap(cap.key, { enabled: on })} />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-sm ${isQuota || r.enabled ? 'text-fg' : 'text-muted'}`}>{cap.label}</span>
                                  {cap.status !== 'implemented' && <CapStatusBadge status={cap.status} label={CAPABILITY_STATUS[cap.status].label} />}
                                  {!isQuota && (
                                    <span className={`text-xs ${r.enabled ? 'text-ok' : 'text-subtle'}`}>
                                      {r.enabled ? 'Habilitada' : 'Deshabilitada'}
                                    </span>
                                  )}
                                </div>
                                {cap.status === 'mock' && (
                                  <p className="text-xs text-warn">Maqueta: la pantalla existe pero todavía no guarda datos reales.</p>
                                )}
                                {parent && (
                                  <p className={`flex items-center gap-1 text-xs ${parentMissing && v.enabled ? 'text-warn' : 'text-subtle'}`}>
                                    <Link2 size={11} /> Requiere "{parent.label}"{parentMissing && v.enabled ? ' — no está incluida' : ''}
                                  </p>
                                )}
                                {dependents.length > 0 && (
                                  <p className={`text-xs ${lostDependents.length ? 'text-warn' : 'text-subtle'}`}>
                                    {lostDependents.length
                                      ? `Al no incluirla se desactivan: ${lostDependents.map((d) => d.label).join(', ')}`
                                      : `Necesaria para: ${dependents.map((d) => d.label).join(', ')}`}
                                  </p>
                                )}
                              </div>
                              {cap.limit && (isQuota || v.enabled) && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-subtle">Límite {cap.limit.unit}</span>
                                  <LimitInput label={`Límite de ${cap.label}`} value={v.limit} onChange={(n) => setCap(cap.key, { limit: n })} />
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

                <div className="rounded-lg border border-dashed border-line-strong">
                  <button type="button" aria-expanded={showSoon} onClick={() => setShowSoon((s) => !s)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-muted hover:text-fg">
                    {showSoon ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Pendientes ({soonCaps.length}) — solo planificación, no se pueden activar
                  </button>
                  {showSoon && (
                    <div className="flex flex-wrap gap-2 px-3 pb-3">
                      {soonCaps.map((cap) => (
                        <span key={cap.key} className="rounded-sm border border-line px-1.5 text-xs leading-5 text-muted">
                          {cap.label} <span className="text-subtle">· {CAPABILITY_MODULES.find((m) => m.key === cap.module)?.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-subtle">Límite vacío = ilimitado. Los cambios se aplican en tiempo real a todos los negocios con este plan (backend: máx. 60 s).</p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <Button onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear plan'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
