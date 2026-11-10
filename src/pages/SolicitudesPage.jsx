import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Copy, Check, ExternalLink, MessageCircle } from 'lucide-react';
import {
  Badge, Button, DetailPage, EmptyState, Field, Info, Modal, Notice, PageHeader, Panel,
  RowButton, Segmented, SelectField, Table, Td, Th, formatDateTime,
} from '../components/common';
import { listSolicitudes, updateSolicitud, createFromSolicitud } from '../data/superadminApi';
import { DEFAULT_TRIAL_DAYS } from '../data/planFeatures';
import { getBusinessTypeLabel } from '../shared/businessProfileModel';

// Solicitudes que llegan desde el formulario público nexusbo.vercel.app/registro.
// El backend las guarda en `solicitudesRegistro`; desde aquí se revisan y, con
// un botón, se crea el negocio completo (siempre en prueba).

const STATUS = {
  pendiente: { label: 'Pendiente', tone: 'warn' },
  creada: { label: 'Negocio creado', tone: 'ok' },
  descartada: { label: 'Descartada', tone: 'neutral' },
};
const FILTERS = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'creada', label: 'Creadas' },
  { value: 'descartada', label: 'Descartadas' },
  { value: 'todas', label: 'Todas' },
];
const DAYS_S = { Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié', Jueves: 'Jue', Viernes: 'Vie', Sábado: 'Sáb', Domingo: 'Dom' };

const digits = (v) => String(v || '').replace(/\D/g, '');
function waLink(phone) {
  const d = digits(phone);
  if (!d) return null;
  return `https://wa.me/${d.length === 8 ? `591${d}` : d}`;
}
// schedule / availability: [{ day, status: 'Disponible' | 'Cerrado' | 'Descanso', start, end }]
function schedText(schedule = [], closed = 'Cerrado') {
  const groups = [];
  schedule.forEach((d) => {
    const key = d?.status === 'Disponible' ? `${d.start}–${d.end}` : closed;
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.to = d.day; else groups.push({ key, from: d.day, to: d.day });
  });
  return groups.map((g) => `${DAYS_S[g.from] || g.from}${g.to !== g.from ? '–' + (DAYS_S[g.to] || g.to) : ''}: ${g.key}`).join(' · ');
}
const bs = (n) => `Bs ${Number(n || 0).toLocaleString('es-BO')}`;
const typeLabel = (key) => getBusinessTypeLabel(key || 'otro');

export default function SolicitudesPage({ plans, pushActivity, onOpenBusiness }) {
  const [filter, setFilter] = useState('pendiente');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems(await listSolicitudes(filter));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = items.find((s) => s.id === openId);
  if (open) {
    return (
      <SolicitudDetail
        solicitud={open}
        plans={plans}
        pushActivity={pushActivity}
        onOpenBusiness={onOpenBusiness}
        onBack={() => setOpenId(null)}
        onChanged={async () => { await load(); }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Solicitudes"
        description="Negocios que se registraron desde el enlace público"
        actions={<Button icon={RefreshCw} onClick={load} disabled={loading}>Actualizar</Button>}
      />
      <div className="mb-4">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Filtrar solicitudes" />
      </div>
      {error && <Notice tone="bad" title="No se pudieron cargar las solicitudes" className="mb-4">{error}</Notice>}
      <Panel flush>
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted" role="status">Cargando…</p>
        ) : items.length === 0 ? (
          <EmptyState title="Sin solicitudes">
            Comparte el enlace nexusbo.vercel.app/registro por WhatsApp. Lo que llenen aparecerá aquí.
          </EmptyState>
        ) : (
          <Table minWidth={760}>
            <thead>
              <tr><Th>Negocio</Th><Th>Tipo</Th><Th>Propietario</Th><Th>WhatsApp</Th><Th>Recibida</Th><Th>Estado</Th></tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const d = s.data || {};
                const st = STATUS[s.status] || STATUS.pendiente;
                return (
                  <RowButton key={s.id} onActivate={() => setOpenId(s.id)} label={`Abrir solicitud de ${d.negocio?.name || 'negocio'}`}>
                    <Td className="font-medium text-fg">{d.negocio?.name || '—'}</Td>
                    <Td className="text-muted">{typeLabel(d.negocio?.businessType)}</Td>
                    <Td className="text-muted">{d.negocio?.ownerName || '—'}</Td>
                    <Td className="nx-num text-muted">{d.negocio?.phone || '—'}</Td>
                    <Td className="nx-num text-muted">{formatDateTime(s.createdAt)}</Td>
                    <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                  </RowButton>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

function SolicitudDetail({ solicitud, plans, pushActivity, onOpenBusiness, onBack, onChanged }) {
  const d = solicitud.data || {};
  const neg = d.negocio || {};
  const hero = d.heroConfig || {};
  const settings = d.businessSettings || {};
  const branches = d.sucursales || [];
  const services = d.servicios || [];
  const pros = d.profesionales || [];
  const st = STATUS[solicitud.status] || STATUS.pendiente;

  const activePlans = useMemo(() => (plans || []).filter((p) => p.active !== false), [plans]);
  const defaultPlan = activePlans.find((p) => /esencial/i.test(p.name || '')) || activePlans[0];
  const [planId, setPlanId] = useState(defaultPlan?.id || '');
  const [trialDays, setTrialDays] = useState(String(defaultPlan?.trialDays || DEFAULT_TRIAL_DAYS));
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null); // { id, email, tempPassword, creados }
  const [copied, setCopied] = useState(false);

  const svcName = (id) => services.find((s) => s.tempId === id)?.name;
  const plan = activePlans.find((p) => p.id === planId);
  const wa = waLink(neg.phone);
  const days = Math.max(1, Math.min(365, Number(trialDays) || DEFAULT_TRIAL_DAYS));

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const res = await createFromSolicitud(solicitud.id, { planId, trialDays: days });
      await pushActivity?.('Negocio creado desde solicitud', `${neg.name} (${neg.ownerEmail}) · plan ${plan?.name || '—'} en prueba ${days} días`, {
        negocioId: res.id, planId: planId || null,
      });
      setCreated(res);
      setConfirming(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    setBusy(true);
    setError('');
    try {
      await updateSolicitud(solicitud.id, { status: 'descartada', note: note.trim() });
      setDiscarding(false);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    setBusy(true);
    setError('');
    try {
      await updateSolicitud(solicitud.id, { status: 'pendiente' });
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function copyCreds() {
    const text = `Nexus · ${neg.name}\nEnlace: https://nexusbo.vercel.app\nCorreo: ${created.email || neg.ownerEmail}\nContraseña temporal: ${created.tempPassword}`;
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  return (
    <DetailPage title={neg.name || 'Solicitud'} subtitle={`${typeLabel(neg.businessType)} · recibida ${formatDateTime(solicitud.createdAt)}`} onBack={onBack}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone={st.tone}>{st.label}</Badge>
        {solicitud.note && <span className="text-xs text-subtle">Nota: {solicitud.note}</span>}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <MessageCircle size={16} aria-hidden="true" /> Escribir por WhatsApp
          </a>
        )}
      </div>

      {error && <Notice tone="bad" title="No se pudo completar la acción" className="mb-4">{error}</Notice>}

      {solicitud.status === 'pendiente' && (
        <Panel title="Crear negocio" description="Se crea con todo lo que llenó el dueño, en período de prueba." className="mb-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_160px_auto] sm:items-end">
            <SelectField label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {activePlans.length === 0 && <option value="">Sin planes activos</option>}
              {activePlans.map((p) => <option key={p.id} value={p.id}>{p.name} · {bs(p.price)}</option>)}
            </SelectField>
            <Field label="Días de prueba" type="number" min="1" max="365" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setConfirming(true)} disabled={!planId || busy}>Crear negocio</Button>
              <Button variant="ghost" onClick={() => setDiscarding(true)} disabled={busy}>Descartar</Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-subtle">
            La cuenta del administrador se crea con el correo {neg.ownerEmail || '—'} y una contraseña temporal que verás una sola vez.
            Los profesionales quedan sin acceso hasta que el negocio les genere usuario y contraseña.
          </p>
        </Panel>
      )}

      {solicitud.status === 'creada' && solicitud.negocioId && (
        <Notice tone="ok" title="Negocio creado" className="mb-4" action={<Button size="sm" icon={ExternalLink} onClick={() => onOpenBusiness?.(solicitud.negocioId)}>Abrir negocio</Button>}>
          ID del negocio: {solicitud.negocioId}
        </Notice>
      )}

      {solicitud.status === 'descartada' && (
        <Notice tone="warn" title="Solicitud descartada" className="mb-4" action={<Button size="sm" onClick={handleReopen} disabled={busy}>Volver a pendiente</Button>} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Negocio">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Info label="Nombre del negocio">{neg.name || '—'}</Info>
            <Info label="Tipo de negocio">{typeLabel(neg.businessType)}</Info>
            <Info label="Nombre del propietario">{neg.ownerName || '—'}</Info>
            <Info label="Teléfono"><span className="nx-num">{neg.phone || '—'}</span></Info>
            <Info label="Ciudad">{[neg.city, neg.country].filter(Boolean).join(', ') || '—'}</Info>
            <Info label="Correo del administrador">{neg.ownerEmail || '—'}</Info>
            {hero.slogan && <div className="sm:col-span-2"><Info label="Eslogan">{hero.slogan}</Info></div>}
            {(hero.logo || hero.cover) && (
              <div className="sm:col-span-2"><Info label="Imágenes">
                <span className="mt-1 flex gap-2">
                  {hero.logo && <img src={hero.logo} alt="Logo" className="h-14 w-14 rounded-md border border-line object-cover" />}
                  {hero.cover && <img src={hero.cover} alt="Portada" className="h-14 w-28 rounded-md border border-line object-cover" />}
                </span>
              </Info></div>
            )}
          </dl>
        </Panel>
        <Panel title="Horario y pagos">
          <dl className="grid gap-3">
            <Info label="Horario">{schedText(settings.schedule)}</Info>
            <Info label="Anticipación mínima">{Number(settings.minAdvanceMinutes) ? `${settings.minAdvanceMinutes} minutos` : 'Sin anticipación'}</Info>
            <Info label="Métodos de pago">{(settings.paymentMethods || []).join(', ') || '—'}</Info>
          </dl>
        </Panel>
      </div>

      <Panel title={`Sucursales · ${branches.length}`} flush className="mt-4">
        <Table minWidth={640}>
          <thead><tr><Th>Sucursal</Th><Th>Dirección</Th><Th>Teléfono</Th><Th>Horario de atención</Th></tr></thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.tempId} className="border-b border-line last:border-0">
                <Td className="text-fg">{b.name}{b.mapsUrl && <a href={b.mapsUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-muted underline">Mapa</a>}</Td>
                <Td className="text-muted">{b.address || '—'}</Td>
                <Td className="nx-num text-muted">{b.phone || '—'}</Td>
                <Td className="text-xs text-muted">{b.schedule || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel title={`Servicios · ${services.length}`} flush className="mt-4">
        <Table minWidth={620}>
          <thead><tr><Th>Servicio</Th><Th align="right">Precio</Th><Th align="right">Duración</Th><Th>Días</Th></tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.tempId} className="border-b border-line last:border-0">
                <Td className="text-fg">{s.name}{s.featured && <span className="ml-2 text-xs text-subtle">(destacado)</span>}</Td>
                <Td align="right">{s.priceVariable ? 'Desde ' : ''}{bs(s.price)}</Td>
                <Td align="right">{s.duration} min</Td>
                <Td className="text-xs text-muted">{(s.availableDays || []).length === 7 ? 'Todos' : (s.availableDays || []).map((x) => DAYS_S[x] || x).join(' ')}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel title={`Profesionales · ${pros.length}`} flush className="mt-4">
        <Table minWidth={680}>
          <thead><tr><Th>Nombre</Th><Th>Sucursal</Th><Th>Servicios</Th><Th>Horario</Th></tr></thead>
          <tbody>
            {pros.map((p) => (
              <tr key={p.tempId} className="border-b border-line last:border-0">
                <Td className="text-fg">{`${p.firstName} ${p.lastName}`.trim()}{p.active === false && <span className="ml-2 text-xs text-subtle">(inactivo)</span>}</Td>
                <Td className="text-muted">{p.branch || '—'}</Td>
                <Td className="text-xs text-muted">
                  {(p.services || []).map((a) => {
                    const n = svcName(a.serviceId);
                    if (!n) return null;
                    const extra = [a.customPrice != null && `${bs(a.customPrice)}`, a.commissionEnabled && `comisión ${a.value}${a.type === '%' ? '%' : ' Bs'}`].filter(Boolean).join(', ');
                    return extra ? `${n} (${extra})` : n;
                  }).filter(Boolean).join(' · ') || '—'}
                </Td>
                <Td className="text-xs text-muted">{schedText(p.availability, 'Descanso')}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      {confirming && (
        <Modal title="Crear negocio" onClose={() => !busy && setConfirming(false)}>
          <p className="text-sm text-muted">
            Se creará <span className="text-fg">{neg.name}</span> con {branches.length} {branches.length === 1 ? 'sucursal' : 'sucursales'}, {pros.length} profesionales y {services.length} servicios,
            en el plan <span className="text-fg">{plan?.name || '—'}</span> con {days} días de prueba.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setConfirming(false)} disabled={busy}>Cancelar</Button>
            <Button variant="primary" onClick={handleCreate} disabled={busy}>{busy ? 'Creando…' : 'Crear negocio'}</Button>
          </div>
        </Modal>
      )}

      {discarding && (
        <Modal title="Descartar solicitud" onClose={() => !busy && setDiscarding(false)}>
          <Field label="Motivo (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. duplicada, datos de prueba" />
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setDiscarding(false)} disabled={busy}>Cancelar</Button>
            <Button variant="danger" onClick={handleDiscard} disabled={busy}>Descartar</Button>
          </div>
        </Modal>
      )}

      {created && (
        <Modal title="Negocio creado" onClose={async () => { setCreated(null); await onChanged(); }}>
          <Notice tone="warn" title="Guarda estos datos ahora">La contraseña temporal no se vuelve a mostrar.</Notice>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-subtle">Negocio</dt><dd className="text-fg">{created.id}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-subtle">Correo</dt><dd className="text-fg">{created.email || neg.ownerEmail}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-subtle">Contraseña</dt><dd className="font-mono text-fg">{created.tempPassword}</dd></div>
            {created.creados && (
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-subtle">Cargado</dt>
                <dd className="text-fg">{created.creados.sucursales} sucursales · {created.creados.profesionales} profesionales · {created.creados.servicios} servicios</dd></div>
            )}
          </dl>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button icon={copied ? Check : Copy} onClick={copyCreds}>{copied ? 'Copiado' : 'Copiar acceso'}</Button>
            <Button variant="primary" icon={ExternalLink} onClick={() => onOpenBusiness?.(created.id)}>Abrir negocio</Button>
          </div>
        </Modal>
      )}
    </DetailPage>
  );
}
