import {
  LayoutDashboard, Building2, Users, CreditCard, Layers, Activity, Settings, LogOut, X,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: null,
    items: [{ key: 'dashboard', label: 'Resumen', icon: LayoutDashboard }],
  },
  {
    label: 'Operación',
    items: [
      { key: 'negocios', label: 'Negocios', icon: Building2 },
      { key: 'suscripciones', label: 'Suscripciones', icon: CreditCard },
      { key: 'planes', label: 'Planes', icon: Layers },
    ],
  },
  {
    label: 'Plataforma',
    items: [
      { key: 'administradores', label: 'Administradores', icon: Users },
      { key: 'actividad', label: 'Actividad', icon: Activity },
      { key: 'configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];

export function BrandMark({ size = 28 }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
    />
  );
}

/**
 * Menú lateral. Se cierra con la X y se vuelve a abrir con el botón de
 * 3 líneas (☰) que muestra App.jsx. En pantallas chicas (overlay) se
 * dibuja encima del contenido; en grandes empuja el contenido.
 */
export default function Sidebar({ page, setPage, onLogout, userEmail, onClose, overlay }) {
  return (
    <aside
      className="flex h-screen flex-shrink-0 flex-col border-r border-line bg-surface"
      style={{ width: 232, ...(overlay ? { position: 'fixed', top: 0, left: 0, zIndex: 40 } : {}) }}
      aria-label="Navegación principal"
    >
      <div className="flex h-14 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-fg">Nexus</p>
            <p className="text-2xs text-subtle">Control de plataforma</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="-mr-1.5 rounded-md p-1.5 text-muted hover:bg-raised hover:text-fg"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
            {group.label && (
              <p className="mb-1.5 px-2.5 text-2xs font-semibold tracking-[0.06em] text-subtle uppercase">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ key, label, icon: Icon }) => {
                const active = page === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setPage(key)}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors ${
                        active ? 'bg-raised font-medium text-fg' : 'text-muted hover:bg-raised hover:text-fg'
                      }`}
                    >
                      {active && (
                        <span aria-hidden="true" className="absolute top-1.5 bottom-1.5 -left-3 w-0.5 rounded-r-sm bg-brand" />
                      )}
                      <Icon size={16} aria-hidden="true" className={active ? 'text-brand-text' : ''} />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised text-xs font-semibold text-fg">
            {userEmail?.[0]?.toUpperCase() || 'G'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">Gally</p>
            <p className="truncate text-xs text-subtle">{userEmail}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="mt-1 flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-muted hover:bg-raised hover:text-fg"
        >
          <LogOut size={16} aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
