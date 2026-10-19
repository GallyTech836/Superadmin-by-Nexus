import { useState } from 'react';
import {
  StatusBadge, Modal, Badge, Button, Field, PageHeader, Panel, EmptyState, SectionLabel, Table, Th, Td, RowButton,
  daysRemaining, relativeDays, formatDate,
} from '../components/common';
import { computeSubscriptionEnd } from '../data/planFeatures';
import { isPlanCompatible } from '../shared/capabilityModel';
import { getBusinessProfile } from '../shared/businessProfileModel';

export default function SubscriptionsPage({ businesses, plans, updatePlan, updateSubscriptionEnd, pushActivity }) {
  const [editing, setEditing] = useState(null);
  const [dateValue, setDateValue] = useState('');

  function planName(planId) {
    return plans.find((p) => p.id === planId)?.name || 'Sin plan';
  }

  function computeNewSubscriptionEnd(planId) {
    return computeSubscriptionEnd(plans.find((p) => p.id === planId));
  }

  function openEdit(b) {
    setEditing(b);
    setDateValue(b.subscriptionEnd || '');
  }

  async function saveDate() {
    await updateSubscriptionEnd(editing.id, dateValue);
    await pushActivity('Vencimiento actualizado', `${editing.name} ahora vence el ${dateValue || 'sin definir'}`, {
      negocioId: editing.id, before: { subscriptionEnd: editing.subscriptionEnd }, after: { subscriptionEnd: dateValue || null },
    });
    setEditing(null);
  }

  async function changePlan(planId) {
    await updatePlan(editing.id, planId);
    const newEnd = computeNewSubscriptionEnd(planId);
    await updateSubscriptionEnd(editing.id, newEnd);
    await pushActivity('Plan cambiado', `${editing.name} cambió de plan ${planName(editing.plan)} a ${planName(planId)}`, {
      negocioId: editing.id, planId, before: { plan: editing.plan }, after: { plan: planId, subscriptionEnd: newEnd },
    });
    setEditing((e) => (e ? { ...e, plan: planId, subscriptionEnd: newEnd } : e));
  }

  return (
    <div>
      <PageHeader title="Suscripciones" description="Vencimientos y alertas de cobro por negocio" />

      <Panel flush>
        <Table minWidth={720}>
          <thead>
            <tr>
              <Th>Negocio</Th>
              <Th>Plan</Th>
              <Th>Estado</Th>
              <Th>Vencimiento</Th>
              <Th>Alerta</Th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => {
              const days = daysRemaining(b.subscriptionEnd);
              let alert = null;
              if (b.status === 'suspended') alert = <Badge tone="bad">Suspendido</Badge>;
              else if (b.status === 'expired') alert = <Badge tone="neutral">Vencido</Badge>;
              else if (days !== null && days <= 7) alert = <Badge tone="warn">Vence pronto</Badge>;
              const trialDays = b.rawStatus === 'trial' ? daysRemaining(b.trialEnd) : null;
              if (!alert && trialDays !== null && trialDays <= 3) alert = <Badge tone="warn">Prueba termina pronto</Badge>;
              return (
                <RowButton key={b.id} onActivate={() => openEdit(b)} label={`Editar suscripción de ${b.name}`}>
                  <Td className="font-medium text-fg">{b.name}</Td>
                  <Td className="text-muted">{planName(b.plan)}</Td>
                  <Td><StatusBadge status={b.status} /></Td>
                  <Td className="text-muted">
                    {b.subscriptionEnd ? (
                      <>
                        <span className="nx-num">{formatDate(b.subscriptionEnd)}</span>
                        <span className="ml-1.5 text-xs text-subtle">{relativeDays(b.subscriptionEnd)}</span>
                      </>
                    ) : 'Sin definir'}
                    {b.rawStatus === 'trial' && b.trialEnd && (
                      <span className="block text-xs text-subtle">Prueba hasta {formatDate(b.trialEnd)}</span>
                    )}
                  </Td>
                  <Td>{alert || <span className="text-subtle">—</span>}</Td>
                </RowButton>
              );
            })}
          </tbody>
        </Table>
        {businesses.length === 0 && <EmptyState title="Aún no hay negocios">Las suscripciones aparecerán cuando registres negocios.</EmptyState>}
      </Panel>

      {editing && (
        <Modal title={editing.name} subtitle="Suscripción" onClose={() => setEditing(null)}>
          <div className="space-y-6">
            <section>
              <Field label="Fecha de vencimiento" type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
              <Button variant="primary" block onClick={saveDate} className="mt-3">Guardar vencimiento</Button>
            </section>
            <section className="border-t border-line pt-5">
              <SectionLabel>Plan</SectionLabel>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Plan">
                {plans.length === 0 && <span className="text-sm text-subtle">Aún no hay planes creados.</span>}
                {plans
                  // Solo planes activos y del mismo tipo de negocio (el actual siempre se muestra).
                  .filter((p) => p.id === editing.plan || (p.active !== false && isPlanCompatible(p, getBusinessProfile(editing.businessType).vertical)))
                  .map((p) => {
                    const current = editing.plan === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={current}
                        onClick={() => changePlan(p.id)}
                        className={`h-8 rounded-md border px-3 text-sm transition-colors ${
                          current ? 'border-brand bg-brand-wash font-medium text-fg' : 'border-line-strong bg-raised text-muted hover:text-fg'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
              </div>
              <p className="mt-2 text-xs text-subtle">Cambiar el plan recalcula el vencimiento según su ciclo de cobro.</p>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
