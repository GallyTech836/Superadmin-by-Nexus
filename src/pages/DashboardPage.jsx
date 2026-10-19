import { RefreshCw, ArrowRight } from 'lucide-react';
import {
  Button, Panel, PageHeader, Notice, EmptyState, StatusBadge, Badge, Table, Th, Td, RowButton,
  daysRemaining, relativeDays, formatDate,
} from '../components/common';
import { monthlyPrice } from '../data/planFeatures';
import { computeMonthlyTotal } from '../shared/capabilityModel';

// Complementos contratados (profesionales extra, WhatsApp): siempre mensuales.
function addonsMonthly(plan, addons) {
  if (!plan) return 0;
  return computeMonthlyTotal(plan, addons).total - (Number(plan.price) || 0);
}

const NEW_DAYS = 30;
const EXPIRING_DAYS = 7; // ventana de "por vencer"
const TRIAL_WARN_DAYS = 3; // pruebas que terminan pronto
const ATTENTION_LIMIT = 8;

function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  return `Bs ${Math.round(n).toLocaleString('es-BO')}`;
}

const fmtCount = (n) => (n === null || n === undefined ? '…' : Number(n).toLocaleString('es-BO'));

/** Fecha que manda para el negocio: fin de prueba si está en prueba, si no la suscripción. */
function effectiveEnd(b) {
  return b.rawStatus === 'trial' ? b.trialEnd : b.subscriptionEnd;
}

/**
 * Lista de negocios que requieren una acción, con el motivo y el atajo.
 * Solo usa campos que ya existen (status, rawStatus, trialEnd, subscriptionEnd).
 */
function attentionItems(businesses) {
  const items = [];
  for (const b of businesses) {
    if (b.status === 'suspended') {
      items.push({ b, rank: 2, tone: 'bad', reason: 'Suspendido', action: 'Revisar', tab: 'resumen', days: 0 });
      continue;
    }
    if (b.rawStatus === 'trial' && b.trialEnd) {
      const d = daysRemaining(b.trialEnd);
      if (b.status === 'expired') {
        items.push({ b, rank: 0, tone: 'bad', reason: `Prueba vencida ${relativeDays(b.trialEnd)}`, action: 'Gestionar prueba', tab: 'prueba', days: d });
      } else if (d !== null && d <= TRIAL_WARN_DAYS) {
        items.push({ b, rank: 1, tone: 'warn', reason: `La prueba termina ${relativeDays(b.trialEnd)}`, action: 'Extender prueba', tab: 'prueba', days: d });
      }
      continue;
    }
    if (b.status === 'expired') {
      items.push({
        b, rank: 0, tone: 'bad',
        reason: b.subscriptionEnd ? `Suscripción vencida ${relativeDays(b.subscriptionEnd)}` : 'Suscripción vencida',
        action: 'Revisar', tab: 'resumen', days: daysRemaining(b.subscriptionEnd) ?? -9999,
      });
      continue;
    }
    if (b.status === 'active' && b.subscriptionEnd) {
      const d = daysRemaining(b.subscriptionEnd);
      if (d !== null && d <= EXPIRING_DAYS) {
        items.push({ b, rank: 1, tone: 'warn', reason: `Vence ${relativeDays(b.subscriptionEnd)}`, action: 'Revisar', tab: 'resumen', days: d });
      }
    }
  }
  return items.sort((x, y) => x.rank - y.rank || (x.days ?? 0) - (y.days ?? 0));
}

function Kpi({ label, value, detail }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="nx-num mt-2 truncate text-3xl font-semibold tracking-[-0.02em] text-fg">{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-subtle">{detail}</p>}
    </div>
  );
}

function StripItem({ label, value, title }) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="truncate text-xs text-subtle">{label}</dt>
      <dd className="nx-num mt-0.5 text-base font-medium text-fg">{value}</dd>
    </div>
  );
}

export default function DashboardPage({ businesses, plans, platformStats, onOpenBusiness, onGoTo }) {
  const planById = Object.fromEntries(plans.map((p) => [p.id, p]));
  const planName = (planId) => planById[planId]?.name || 'Sin plan';
  const open = (id, tab) => onOpenBusiness?.(id, tab);

  // Estado efectivo ya viene calculado en useBusinesses (computeEffectiveStatus).
  // "En prueba" = estado trial (o, por compatibilidad, un plan con ciclo Gratis).
  const isTrial = (b) => b.status === 'trial' || (b.status === 'active' && planById[b.plan]?.billingCycle === 'free');
  const total = businesses.length;
  const suspended = businesses.filter((b) => b.status === 'suspended').length;
  const expired = businesses.filter((b) => b.status === 'expired').length;
  const trialList = businesses.filter(isTrial);
  const trial = trialList.length;
  const active = businesses.filter((b) => b.status === 'active' && !isTrial(b)).length;
  const trialEndingSoon = trialList.filter((b) => {
    const d = b.rawStatus === 'trial' ? daysRemaining(b.trialEnd) : null;
    return d !== null && d >= 0 && d <= TRIAL_WARN_DAYS;
  }).length;

  // Por vencer: negocios vigentes cuya fecha (prueba o suscripción) cae en los próximos días.
  const expiringSoon = businesses.filter((b) => {
    if (b.status !== 'active' && b.status !== 'trial') return false;
    const d = daysRemaining(effectiveEnd(b));
    return d !== null && d >= 0 && d <= EXPIRING_DAYS;
  }).length;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NEW_DAYS);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const newOnes = businesses.filter((b) => b.createdAt && b.createdAt >= cutoffISO).length;

  // MRR estimado: precio mensual equivalente de los planes de negocios
  // activos que pagan (no prueba, no bloqueados).
  const mrr = businesses
    .filter((b) => b.status === 'active' && !isTrial(b))
    .reduce((acc, b) => acc + monthlyPrice(planById[b.plan]) + addonsMonthly(planById[b.plan], b.addons), 0);

  const byPlan = {};
  for (const b of businesses) {
    const key = b.plan && planById[b.plan] ? b.plan : 'none';
    byPlan[key] = byPlan[key] || { total: 0, active: 0 };
    byPlan[key].total += 1;
    if (b.status === 'active' || b.status === 'trial') byPlan[key].active += 1;
  }
  const planRows = Object.entries(byPlan).sort((a, b) => b[1].total - a[1].total);

  const attention = attentionItems(businesses);
  const recent = businesses.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumen"
        description={`Estado de la plataforma · período ${platformStats.period}`}
        actions={(
          <Button
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            onClick={platformStats.refresh}
            disabled={platformStats.loading}
          >
            {platformStats.loading ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
      />

      {/* Indicadores principales: una sola superficie dividida, sin tarjetas sueltas */}
      <section aria-label="Indicadores principales" className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="MRR estimado" value={fmtMoney(mrr)} detail="Planes y complementos de negocios activos" />
        <Kpi label="Negocios activos" value={fmtCount(active)} detail={`de ${fmtCount(total)} registrados`} />
        <Kpi label="En prueba" value={fmtCount(trial)} detail={trialEndingSoon ? `${trialEndingSoon} ${trialEndingSoon === 1 ? 'termina' : 'terminan'} en ${TRIAL_WARN_DAYS} días o menos` : `Ninguna termina en ${TRIAL_WARN_DAYS} días`} />
        <Kpi label="Por vencer" value={fmtCount(expiringSoon)} detail={`Pruebas y suscripciones, próximos ${EXPIRING_DAYS} días`} />
      </section>

      {/* Métricas secundarias: franja compacta */}
      <section aria-label="Métricas de uso" className="rounded-lg border border-line bg-surface px-5 py-4">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:flex-wrap">
          <StripItem label={`Nuevos (${NEW_DAYS} días)`} value={fmtCount(newOnes)} />
          <StripItem label="Vencidos" value={fmtCount(expired)} />
          <StripItem label="Suspendidos" value={fmtCount(suspended)} />
          <StripItem label="Profesionales" value={fmtCount(platformStats.professionals)} />
          <StripItem label="Sucursales" value={fmtCount(platformStats.branches)} />
          <StripItem label="Clientes" value={fmtCount(platformStats.clients)} />
          <StripItem label="Citas del mes" value={fmtCount(platformStats.periodAppointments)} />
          <StripItem label="Citas históricas" value={fmtCount(platformStats.appointments)} />
          <StripItem label="Facturación de negocios" value={fmtMoney(platformStats.periodRevenue)} title="Suma de citas completadas en el mes" />
        </dl>
      </section>

      {platformStats.error && (
        <Notice
          tone="warn"
          title="Algunas métricas no se pudieron calcular"
          action={<Button size="sm" icon={RefreshCw} onClick={platformStats.refresh} disabled={platformStats.loading}>Reintentar</Button>}
        >
          <p>{platformStats.error}</p>
          <p>Si el error menciona un índice, abre el enlace que da Firestore para crearlo (una sola vez).</p>
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Requiere atención"
          description="Pruebas por terminar, suscripciones por vencer o vencidas y negocios suspendidos"
          actions={attention.length > ATTENTION_LIMIT && (
            <Button size="sm" variant="ghost" onClick={() => onGoTo?.('suscripciones')}>
              Ver los {attention.length}
            </Button>
          )}
          flush
        >
          {attention.length === 0 ? (
            <EmptyState title="Todo en orden">No hay pruebas por terminar ni suscripciones por vencer en los próximos {EXPIRING_DAYS} días.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {attention.slice(0, ATTENTION_LIMIT).map(({ b, tone, reason, action, tab }) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{b.name}</p>
                    <p className="mt-0.5 truncate text-xs text-subtle">
                      {planName(b.plan)}
                      {effectiveEnd(b) ? ` · ${formatDate(effectiveEnd(b))}` : ''}
                    </p>
                  </div>
                  <Badge tone={tone}>{reason}</Badge>
                  <Button size="sm" onClick={() => open(b.id, tab)} aria-label={`${action}: ${b.name}`}>
                    {action}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Negocios por plan" description="Total y vigentes (activos o en prueba)">
          {planRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-subtle">Aún no hay negocios.</p>
          ) : (
            <ul className="space-y-3.5">
              {planRows.map(([planId, row]) => (
                <li key={planId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-fg">{planId === 'none' ? 'Sin plan' : planName(planId)}</span>
                    <span className="nx-num shrink-0 text-muted">
                      {row.total} <span className="text-xs text-subtle">· {row.active} vigentes</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-raised-hover">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${total ? (row.total / total) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Negocios recientes"
        actions={total > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onGoTo?.('negocios')}>
            Ver todos <ArrowRight size={14} aria-hidden="true" />
          </Button>
        )}
        flush
      >
        {recent.length === 0 ? (
          <EmptyState title="Aún no hay negocios" action={<Button size="sm" variant="primary" onClick={() => onGoTo?.('negocios')}>Ir a Negocios</Button>}>
            Cuando registres el primero aparecerá aquí.
          </EmptyState>
        ) : (
          <Table minWidth={560}>
            <thead>
              <tr>
                <Th>Negocio</Th>
                <Th>Propietario</Th>
                <Th>Plan</Th>
                <Th>Estado</Th>
                <Th align="right">Alta</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => (
                <RowButton key={b.id} onActivate={() => open(b.id)} label={`Abrir ${b.name}`}>
                  <Td className="font-medium text-fg">{b.name}</Td>
                  <Td className="text-muted">{b.ownerName || b.ownerEmail}</Td>
                  <Td className="text-muted">{planName(b.plan)}</Td>
                  <Td><StatusBadge status={b.status} /></Td>
                  <Td align="right" className="text-muted">{formatDate(b.createdAt) || '—'}</Td>
                </RowButton>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
