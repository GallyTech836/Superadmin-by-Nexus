import { useState, useMemo } from 'react';
import { Plus, Search, CheckCircle2, Copy, Check, Sliders } from 'lucide-react';
import {
  StatusBadge, Modal, Field, SelectField, Label, PasswordInput, Button, PageHeader, Panel, Notice, EmptyState,
  Segmented, Select, SectionLabel, Table, Th, Td, RowButton, STATUS_LABELS, formatDate, relativeDays,
} from '../components/common';
import BusinessDetail from '../components/BusinessDetail';
import { createBusiness } from '../data/superadminApi';
import { DEFAULT_TRIAL_DAYS } from '../data/planFeatures';
import { cleanOverrides, isPlanCompatible } from '../shared/capabilityModel';
import { BUSINESS_TYPES, DEFAULT_BUSINESS_TYPE, getBusinessTypeLabel, getBusinessProfile } from '../shared/businessProfileModel';

const emptyForm = {
  name: '', businessType: DEFAULT_BUSINESS_TYPE, ownerName: '', phone: '', country: 'Bolivia', city: '',
  ownerEmail: '', password: '', plan: '', status: 'trial', trialDays: DEFAULT_TRIAL_DAYS,
};

export default function NegociosPage({
  focus, onFocusDone, businesses, plans, activity, updateStatus, updatePlan, updateInfo, updateSubscriptionEnd, updateOverrides, updateTrial, updateTerminology, updateAddons, pushActivity,
}) {
  function planName(planId) {
    return plans.find((p) => p.id === planId)?.name || 'Sin plan';
  }

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [planFilter, setPlanFilter] = useState('todos');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState(focus?.id ?? null);
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
        initialTab={focus?.id === detail.id ? focus.tab : undefined}
        onClose={() => { setDetailId(null); onFocusDone?.(); }}
        updateStatus={updateStatus}
        updatePlan={updatePlan}
        updateInfo={updateInfo}
        updateSubscriptionEnd={updateSubscriptionEnd}
        updateOverrides={updateOverrides}
        updateTrial={updateTrial}
        updateTerminology={updateTerminology}
        updateAddons={updateAddons}
        pushActivity={pushActivity}
      />
    );
  }

  const statusOptions = [
    { value: 'todos', label: 'Todos' },
    ...['active', 'trial', 'suspended', 'expired'].map((f) => ({ value: f, label: STATUS_LABELS[f] })),
  ];

  return (
    <div>
      <PageHeader
        title="Negocios"
        description={`${businesses.length} ${businesses.length === 1 ? 'negocio registrado' : 'negocios registrados'}`}
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>Nuevo negocio</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="nx-input-group flex h-9 w-full items-center gap-2 rounded-md border border-line-strong bg-canvas px-3 sm:w-72">
          <Search size={15} className="shrink-0 text-subtle" aria-hidden="true" />
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, slug o correo"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none"
          />
        </label>
        <Segmented label="Filtrar por estado" options={statusOptions} value={filter} onChange={setFilter} />
        <div className="w-full sm:w-48">
          <Select size="sm" aria-label="Filtrar por plan" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="h-8">
            <option value="todos">Todos los planes</option>
            <option value="none">Sin plan</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
      </div>

      <Panel flush>
        <Table minWidth={760}>
          <thead>
            <tr>
              <Th>Negocio</Th>
              <Th>Propietario</Th>
              <Th>Plan</Th>
              <Th>Estado</Th>
              <Th>Vence</Th>
              <Th align="right">Excepciones</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const overrides = Object.keys(cleanOverrides(b.capabilityOverrides)).length;
              const isTrialEnd = b.rawStatus === 'trial' && b.trialEnd;
              const endDate = isTrialEnd ? b.trialEnd : b.subscriptionEnd;
              return (
                <RowButton key={b.id} onActivate={() => setDetailId(b.id)} label={`Abrir ${b.name}`}>
                  <Td className="font-medium text-fg">{b.name}</Td>
                  <Td className="text-muted">{b.ownerName || b.ownerEmail}</Td>
                  <Td className="text-muted">{planName(b.plan)}</Td>
                  <Td><StatusBadge status={b.status} /></Td>
                  <Td className="text-muted">
                    {endDate ? (
                      <>
                        <span className="nx-num">{formatDate(endDate)}</span>
                        <span className="ml-1.5 text-xs text-subtle">{isTrialEnd ? 'prueba · ' : ''}{relativeDays(endDate)}</span>
                      </>
                    ) : '—'}
                  </Td>
                  <Td align="right">
                    {overrides > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-brand-text" title={`${overrides} excepciones de capacidades`}>
                        <Sliders size={12} aria-hidden="true" /> {overrides}
                      </span>
                    ) : <span className="text-subtle">—</span>}
                  </Td>
                </RowButton>
              );
            })}
          </tbody>
        </Table>
        {filtered.length === 0 && (
          businesses.length === 0 ? (
            <EmptyState title="Aún no hay negocios" action={<Button variant="primary" size="sm" icon={Plus} onClick={openCreate}>Crear el primero</Button>}>
              Registra un negocio para darle acceso a Nexus.
            </EmptyState>
          ) : (
            <EmptyState title="Sin resultados">Ningún negocio coincide con la búsqueda o los filtros.</EmptyState>
          )
        )}
      </Panel>

      {showCreate && (
        <Modal title="Nuevo negocio" onClose={closeCreateModal} wide>
          {createdCreds ? (
            /* Éxito: mostramos la contraseña generada UNA sola vez */
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-ok" size={20} aria-hidden="true" />
                <div>
                  <p className="font-medium text-fg">Negocio creado</p>
                  <p className="mt-0.5 text-sm text-muted">Copia estos datos y entrégaselos al dueño. No se volverán a mostrar.</p>
                </div>
              </div>
              <dl className="space-y-2 rounded-md border border-line bg-canvas p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><dt className="text-subtle">Correo</dt><dd className="text-fg">{createdCreds.email}</dd></div>
                <div className="flex flex-wrap justify-between gap-2"><dt className="text-subtle">Contraseña</dt><dd className="font-mono text-fg">{createdCreds.tempPassword}</dd></div>
              </dl>
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button variant="primary" onClick={closeCreateModal} className="sm:flex-1" block>Listo</Button>
                <Button icon={copied ? Check : Copy} onClick={copyCreds} className="sm:flex-1" block>
                  {copied ? 'Copiado' : 'Copiar datos'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <SectionLabel>Información del negocio</SectionLabel>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Nombre del negocio" value={form.name} onChange={(e) => updateForm('name', e.target.value)} required />
                  <SelectField label="Tipo de negocio" value={form.businessType} onChange={(e) => updateForm('businessType', e.target.value)}>
                    {BUSINESS_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </SelectField>
                  <Field label="Nombre del propietario" value={form.ownerName} onChange={(e) => updateForm('ownerName', e.target.value)} />
                  <Field label="Teléfono" type="tel" value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} />
                  <Field label="Ciudad" value={form.city} onChange={(e) => updateForm('city', e.target.value)} />
                </div>
              </section>
              <section>
                <SectionLabel>Acceso del administrador</SectionLabel>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="Correo del administrador"
                    hint="Con este correo inicia sesión en el panel del negocio."
                    type="email"
                    autoComplete="off"
                    value={form.ownerEmail}
                    onChange={(e) => updateForm('ownerEmail', e.target.value)}
                    required
                  />
                  <div>
                    <Label htmlFor="new-biz-password">Contraseña (opcional)</Label>
                    <PasswordInput
                      id="new-biz-password"
                      value={form.password}
                      onChange={(e) => updateForm('password', e.target.value)}
                      placeholder="Vacía: se genera automáticamente"
                      autoComplete="new-password"
                      aria-describedby="new-biz-password-hint"
                      visible={showPassword}
                      onToggleVisible={() => setShowPassword((v) => !v)}
                    />
                    <p id="new-biz-password-hint" className="mt-1 text-xs text-subtle">Mínimo 6 caracteres. Se muestra una sola vez al crear.</p>
                  </div>
                </div>
              </section>
              <section>
                <SectionLabel>Suscripción</SectionLabel>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SelectField label="Plan" value={form.plan} onChange={(e) => {
                    const p = plans.find((x) => x.id === e.target.value);
                    setForm((f) => ({ ...f, plan: e.target.value, trialDays: p?.trialDays || f.trialDays }));
                  }}>
                    <option value="">Sin plan (mínimo: 2 profesionales, 1 sucursal)</option>
                    {activePlans
                      .filter((p) => isPlanCompatible(p, getBusinessProfile(form.businessType).vertical))
                      .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </SelectField>
                  <SelectField label="Estado inicial" value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
                    <option value="trial">Prueba</option>
                    <option value="active">Activo</option>
                  </SelectField>
                  {form.status === 'trial' && (
                    <Field label="Días de prueba" type="number" min="1" value={form.trialDays} onChange={(e) => updateForm('trialDays', e.target.value)} />
                  )}
                </div>
                {plans.length === 0 && (
                  <Notice tone="warn" className="mt-3">Aún no hay planes: el negocio usará las capacidades por defecto.</Notice>
                )}
              </section>
              {createError && <Notice tone="bad">{createError}</Notice>}
              <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
                <Button onClick={closeCreateModal}>Cancelar</Button>
                <Button variant="primary" onClick={handleCreate} disabled={creating || !form.name || !form.ownerEmail}>
                  {creating ? 'Creando…' : 'Crear negocio'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
