import { useState } from 'react';
import { StatusBadge, Modal, daysRemaining } from '../components/common';
import { computeSubscriptionEnd } from '../data/planFeatures';

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
      <h1 className="text-2xl font-semibold text-white">Suscripciones</h1>
      <p className="mt-1 text-sm text-slate-500">Estado de facturación por negocio</p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/5 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Vencimiento</th>
              <th className="px-4 py-3 font-medium">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => {
              const days = daysRemaining(b.subscriptionEnd);
              let alert = null;
              if (b.status === 'suspended') alert = <span className="text-red-400">Suspendido</span>;
              else if (b.status === 'expired') alert = <span className="text-slate-500">Vencido</span>;
              else if (days !== null && days <= 7) alert = <span className="text-amber-400">Vence pronto</span>;
              const trialDays = b.rawStatus === 'trial' ? daysRemaining(b.trialEnd) : null;
              if (!alert && trialDays !== null && trialDays <= 3) alert = <span className="text-amber-400">Prueba termina pronto</span>;
              return (
                <tr
                  key={b.id}
                  onClick={() => openEdit(b)}
                  className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/5"
                >
                  <td className="px-4 py-3 text-white">{b.name}</td>
                  <td className="px-4 py-3 text-slate-400">{planName(b.plan)}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3 text-slate-400">
                    {b.subscriptionEnd ? `${b.subscriptionEnd} (${days}d)` : 'Sin definir'}
                    {b.rawStatus === 'trial' && b.trialEnd && <span className="block text-xs text-amber-400/80">Prueba hasta {b.trialEnd}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">{alert}</td>
                </tr>
              );
            })}
            {businesses.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600">Sin negocios todavía</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.name} onClose={() => setEditing(null)}>
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Fecha de vencimiento</label>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
              <button onClick={saveDate} className="mt-2 w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white hover:bg-indigo-600">
                Guardar vencimiento
              </button>
            </div>
            <div>
              <p className="mb-2 text-xs text-slate-500">Plan</p>
              <div className="flex flex-wrap gap-2">
                {plans.length === 0 && <span className="text-xs text-slate-600">Sin planes creados todavía</span>}
                {plans.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => changePlan(p.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs ${
                      editing.plan === p.id ? 'bg-indigo-500/25 text-indigo-300' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}