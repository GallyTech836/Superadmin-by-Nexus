import { useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';

export const STATUS_STYLES = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  trial: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
  expired: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

export const STATUS_LABELS = { active: 'Activo', trial: 'Prueba', suspended: 'Suspendido', expired: 'Vencido' };

// Estado de implementación de una capacidad (ver CAPABILITY_STATUS).
export const CAP_STATUS_STYLES = {
  implemented: 'bg-emerald-500/10 text-emerald-400',
  partial: 'bg-sky-500/10 text-sky-400',
  mock: 'bg-amber-500/10 text-amber-400',
  soon: 'bg-slate-500/10 text-slate-400',
};

export const SOURCE_LABELS = {
  core: 'Base',
  override: 'Excepción',
  plan: 'Plan',
  profile: 'Tipo de negocio',
  default: 'Por defecto',
  soon: 'Próximamente',
  requires: 'Depende de otra',
};

export function daysRemaining(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function StatusBadge({ status }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLES[status] || STATUS_STYLES.active}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function CapStatusBadge({ status, label }) {
  return (
    <span className={`shrink-0 whitespace-nowrap rounded px-1.5 text-[10px] leading-4 font-medium ${CAP_STATUS_STYLES[status] || CAP_STATUS_STYLES.soon}`}>
      {label}
    </span>
  );
}

export function StatCard({ label, value, accent, icon: Icon, hint }) {
  const accents = {
    indigo: 'text-indigo-400 bg-indigo-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
    slate: 'text-slate-400 bg-slate-500/10',
  };
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-slate-400">{label}</p>
        {Icon && <span className={`shrink-0 rounded-md p-1.5 ${accents[accent]}`}><Icon size={14} /></span>}
      </div>
      <p className="mt-2 truncate text-xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}

const MODAL_WIDTHS = { md: 448, wide: 672, xl: 896 };

/**
 * Modal a prueba de pantallas chicas/tablets:
 *  - el fondo es el que hace scroll (nunca queda contenido inalcanzable)
 *  - la cabecera con la X queda fija arriba mientras haces scroll
 *  - se cierra con la X, tocando fuera del cuadro o con Escape
 * Los tamaños críticos van en `style` para no depender de que Tailwind
 * haya generado la clase.
 */
export function Modal({ title, onClose, children, wide, size, subtitle }) {
  const maxWidth = MODAL_WIDTHS[size] || (wide ? MODAL_WIDTHS.wide : MODAL_WIDTHS.md);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60"
      style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="mx-auto my-4 w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-slate-900"
        style={{ maxWidth }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-white/5 bg-slate-900 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-m-2 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Contenedor de página para vistas de detalle (en vez de un modal gigante). */
export function DetailPage({ title, subtitle, onBack, children }) {
  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={16} /> Volver
      </button>
      <div className="mb-5 min-w-0">
        <h1 className="truncate text-2xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
      />
    </div>
  );
}

export function SelectField({ label, children, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      <select
        {...props}
        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
      >
        {children}
      </select>
    </div>
  );
}

/**
 * Interruptor simple. `value` true/false.
 * Tamaño, posición y colores en `style` para que siempre se vea y se pueda
 * tocar, aunque Tailwind no haya generado alguna clase.
 */
export function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      style={{
        position: 'relative', width: 36, height: 20, flexShrink: 0, borderRadius: 9999,
        background: value ? '#6366f1' : '#334155', transition: 'background .15s',
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', border: 0, padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: 9999,
          background: '#fff', transition: 'left .15s',
        }}
      />
    </button>
  );
}

/**
 * Input de límite: vacío = ilimitado.
 * value: number | null
 */
export function LimitInput({ value, onChange, disabled, placeholder = 'Ilimitado' }) {
  return (
    <input
      type="number"
      min="0"
      disabled={disabled}
      value={value === null || value === undefined ? '' : value}
      onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      placeholder={placeholder}
      className="w-20 rounded-md border border-white/10 bg-slate-950 px-1.5 py-0.5 text-[11px] text-white outline-none focus:border-indigo-500 disabled:opacity-40"
    />
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-white/5 pb-3">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${value === t.key ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-white'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function UsageBar({ percent, exceeded }) {
  const p = Math.min(100, Math.max(0, percent || 0));
  const color = exceeded ? 'bg-red-500' : p >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full ${color}`} style={{ width: `${p}%` }} />
    </div>
  );
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
}
