import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { formatDateTime } from '../components/common';

export default function ActivityPage({ activity, businesses = [] }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('todos');
  const nameById = Object.fromEntries(businesses.map((b) => [b.id, b.name]));

  const types = useMemo(() => [...new Set(activity.map((a) => a.type).filter(Boolean))].sort(), [activity]);
  const filtered = activity.filter((a) => {
    const q = search.toLowerCase();
    const matches = !q || `${a.type} ${a.description} ${a.actorEmail || ''} ${a.negocioId || ''}`.toLowerCase().includes(q);
    return matches && (type === 'todos' || a.type === type);
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Actividad</h1>
      <p className="mt-1 text-sm text-slate-500">Quién hizo qué y cuándo en el panel (últimas 200 acciones)</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2">
          <Search size={15} className="text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none">
          <option value="todos">Todos los tipos</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="mt-5 space-y-3">
        {filtered.map((a) => (
          <div key={a.id} className="rounded-xl border border-white/5 bg-slate-900 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">{a.type}</p>
              <p className="shrink-0 text-xs text-slate-500">{formatDateTime(a.createdAt) || a.date}</p>
            </div>
            <p className="mt-1 text-sm text-slate-400">{a.description}</p>
            <p className="mt-1 text-[11px] text-slate-600">
              {a.actorEmail ? `por ${a.actorEmail}` : 'autor no registrado'}
              {a.negocioId ? ` · negocio: ${nameById[a.negocioId] || a.negocioId}` : ''}
            </p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-600">Todavía no hay actividad registrada.</p>
        )}
      </div>
    </div>
  );
}
