import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { PageHeader, Panel, Select, EmptyState, formatDateTime } from '../components/common';

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
      <PageHeader title="Actividad" description="Quién hizo qué y cuándo en el panel (últimas 200 acciones)" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="nx-input-group flex h-9 w-full items-center gap-2 rounded-md border border-line-strong bg-canvas px-3 sm:w-72">
          <Search size={15} className="shrink-0 text-subtle" aria-hidden="true" />
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en la actividad"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none"
          />
        </label>
        <div className="w-full sm:w-56">
          <Select size="sm" className="h-8" aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      </div>

      <Panel flush>
        {filtered.length === 0 ? (
          activity.length === 0
            ? <EmptyState title="Aún no hay actividad">Cada cambio que hagas en el panel quedará registrado aquí.</EmptyState>
            : <EmptyState title="Sin resultados">Ninguna acción coincide con la búsqueda o el tipo elegido.</EmptyState>
        ) : (
          <ol className="divide-y divide-line">
            {filtered.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-medium text-fg">{a.type}</p>
                  <time className="nx-num shrink-0 text-xs text-subtle">{formatDateTime(a.createdAt) || a.date}</time>
                </div>
                <p className="mt-1 text-sm text-muted">{a.description}</p>
                <p className="mt-1 text-xs text-subtle">
                  {a.actorEmail ? `por ${a.actorEmail}` : 'autor no registrado'}
                  {a.negocioId ? ` · negocio: ${nameById[a.negocioId] || a.negocioId}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
