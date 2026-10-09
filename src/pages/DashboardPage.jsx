import {
  Building2, CheckCircle2, PauseCircle, Clock, Scissors, UserRound, Calendar, AlertTriangle, Sparkles, MapPin, Wallet, TrendingUp, RefreshCw,
} from 'lucide-react';
import { StatCard, StatusBadge } from '../components/common';
import { monthlyPrice } from '../data/planFeatures';

const NEW_DAYS = 30;

function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  return `Bs ${Math.round(n).toLocaleString('es-BO')}`;
}

export default function DashboardPage({ businesses, plans, platformStats }) {
  const planById = Object.fromEntries(plans.map((p) => [p.id, p]));
  const planName = (planId) => planById[planId]?.name || 'Sin plan';

  // Estado efectivo ya viene calculado en useBusinesses (computeEffectiveStatus).
  // "En prueba" = estado trial (o, por compatibilidad, un plan con ciclo Gratis).
  const isTrial = (b) => b.status === 'trial' || (b.status === 'active' && planById[b.plan]?.billingCycle === 'free');
  const total = businesses.length;
  const suspended = businesses.filter((b) => b.status === 'suspended').length;
  const expired = businesses.filter((b) => b.status === 'expired').length;
  const trial = businesses.filter(isTrial).length;
  const active = businesses.filter((b) => b.status === 'active' && !isTrial(b)).length;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NEW_DAYS);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const newOnes = businesses.filter((b) => b.createdAt && b.createdAt >= cutoffISO).length;

  // MRR estimado: precio mensual equivalente de los planes de negocios
  // activos que pagan (no prueba, no bloqueados).
  const mrr = businesses
    .filter((b) => b.status === 'active' && !isTrial(b))
    .reduce((acc, b) => acc + monthlyPrice(planById[b.plan]), 0);

  const byPlan = {};
  for (const b of businesses) {
    const key = b.plan && planById[b.plan] ? b.plan : 'none';
    byPlan[key] = byPlan[key] || { total: 0, active: 0 };
    byPlan[key].total += 1;
    if (b.status === 'active' || b.status === 'trial') byPlan[key].active += 1;
  }
  const planRows = Object.entries(byPlan).sort((a, b) => b[1].total - a[1].total);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Resumen general de la plataforma · período {platformStats.period}</p>
        </div>
        <button onClick={platformStats.refresh} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-400 hover:text-white">
          <RefreshCw size={14} className={platformStats.loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Negocios totales" value={total} icon={Building2} accent="indigo" />
        <StatCard label="Activos" value={active} icon={CheckCircle2} accent="emerald" />
        <StatCard label="En prueba" value={trial} icon={Clock} accent="amber" />
        <StatCard label="Vencidos" value={expired} icon={AlertTriangle} accent="slate" />
        <StatCard label="Suspendidos" value={suspended} icon={PauseCircle} accent="red" />
        <StatCard label={`Nuevos (${NEW_DAYS} días)`} value={newOnes} icon={Sparkles} accent="indigo" />
        <StatCard label="Profesionales" value={platformStats.professionals ?? '…'} icon={Scissors} accent="indigo" />
        <StatCard label="Sucursales" value={platformStats.branches ?? '…'} icon={MapPin} accent="indigo" />
        <StatCard label="Clientes" value={platformStats.clients ?? '…'} icon={UserRound} accent="indigo" />
        <StatCard label="Citas del mes" value={platformStats.periodAppointments ?? '…'} icon={Calendar} accent="indigo" hint={`Total histórico: ${platformStats.appointments ?? '…'}`} />
        <StatCard label="MRR estimado" value={fmtMoney(mrr)} icon={TrendingUp} accent="emerald" hint="Según precio de los planes de negocios activos" />
        <StatCard label="Facturación de negocios (mes)" value={fmtMoney(platformStats.periodRevenue)} icon={Wallet} accent="emerald" hint="Suma de citas completadas" />
      </div>

      {platformStats.error && (
        <div className="mt-4 break-words rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
          Algunas métricas no se pudieron calcular: {platformStats.error}
          <p className="mt-1 text-amber-400/70">Si el error menciona un índice, abre el link que da Firestore para crearlo (una sola vez).</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-slate-900 p-6">
          <p className="mb-4 text-sm text-slate-400">Negocios por plan</p>
          <div className="space-y-2">
            {planRows.map(([planId, row]) => (
              <div key={planId} className="flex items-center gap-3">
                <span className="w-32 truncate text-sm text-white">{planId === 'none' ? 'Sin plan' : planName(planId)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-indigo-500" style={{ width: `${total ? (row.total / total) * 100 : 0}%` }} />
                </div>
                <span className="w-16 text-right text-xs text-slate-400">{row.total} <span className="text-slate-600">({row.active} vig.)</span></span>
              </div>
            ))}
            {planRows.length === 0 && <p className="py-6 text-center text-sm text-slate-600">Sin datos.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900 p-6">
          <p className="mb-4 text-sm text-slate-400">Negocios recientes</p>
          <div className="space-y-2">
            {businesses.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{b.name}</p>
                  <p className="truncate text-xs text-slate-500">{b.ownerName || b.ownerEmail} · {planName(b.plan)} · {b.createdAt}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
            {businesses.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-600">Todavía no hay negocios registrados.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
