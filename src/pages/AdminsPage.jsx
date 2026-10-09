import { StatusBadge } from '../components/common';

export default function AdminsPage({ businesses }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Administradores</h1>
      <p className="mt-1 text-sm text-slate-500">{businesses.length} administradores registrados</p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/5 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="px-4 py-3 text-white">{b.ownerName || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{b.ownerEmail}</td>
                <td className="px-4 py-3 text-slate-400">{b.name}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status === 'suspended' ? 'suspended' : 'active'} /></td>
                <td className="px-4 py-3 text-slate-400">{b.createdAt || '—'}</td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600">Sin administradores todavía</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Para suspender, reactivar o cambiar el plan de un administrador, hazlo desde su negocio en la sección "Negocios".
      </p>
    </div>
  );
}