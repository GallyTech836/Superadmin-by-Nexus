import {
  LayoutDashboard, Building2, Users, CreditCard, Layers, Activity, Settings, LogOut, X,
} from 'lucide-react';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'negocios', label: 'Negocios', icon: Building2 },
  { key: 'administradores', label: 'Administradores', icon: Users },
  { key: 'suscripciones', label: 'Suscripciones', icon: CreditCard },
  { key: 'planes', label: 'Planes', icon: Layers },
  { key: 'actividad', label: 'Actividad', icon: Activity },
  { key: 'configuracion', label: 'Configuración', icon: Settings },
];

/**
 * Menú lateral. Se cierra con la X y se vuelve a abrir con el botón de
 * 3 líneas (☰) que muestra App.jsx. En pantallas chicas (overlay) se
 * dibuja encima del contenido; en grandes empuja el contenido.
 */
export default function Sidebar({ page, setPage, onLogout, userEmail, onClose, overlay }) {
  return (
    <aside
      className="flex h-screen flex-shrink-0 flex-col border-r border-white/5 bg-slate-950"
      style={{ width: 224, ...(overlay ? { position: 'fixed', top: 0, left: 0, zIndex: 40, boxShadow: '0 0 40px rgba(0,0,0,.6)' } : {}) }}
    >
      <div className="flex items-start justify-between px-5 py-6">
        <div>
          <span className="text-xl font-bold tracking-tight text-white">NEXUS<span className="text-indigo-400">.</span></span>
          <p className="mt-0.5 text-xs text-slate-500">Super Admin</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="-mr-2 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setPage(key)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
              page === key ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      <div className="border-t border-white/5 px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
            {userEmail?.[0]?.toUpperCase() || 'G'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">Gally</p>
            <p className="truncate text-xs text-slate-500">{userEmail}</p>
          </div>
        </div>
        <button onClick={onLogout} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-red-400">
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}