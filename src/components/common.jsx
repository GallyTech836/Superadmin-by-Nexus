import { useEffect, useId } from 'react';
import { X, ArrowLeft } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Constantes de estado
   ───────────────────────────────────────────────────────────── */

export const STATUS_LABELS = { active: 'Activo', trial: 'Prueba', suspended: 'Suspendido', expired: 'Vencido' };

// Estado del negocio → tono del Badge.
const STATUS_TONES = { active: 'ok', trial: 'warn', suspended: 'bad', expired: 'neutral' };

// Estado de implementación de una capacidad (ver CAPABILITY_STATUS).
const CAP_STATUS_TONES = { implemented: 'ok', partial: 'brand', mock: 'warn', soon: 'neutral' };

export const SOURCE_LABELS = {
  core: 'Base',
  override: 'Excepción',
  plan: 'Plan',
  addon: 'Complemento',
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

/** "hoy", "en 5 días", "hace 3 días" — para leer de un vistazo. */
export function relativeDays(dateStr) {
  const d = daysRemaining(dateStr);
  if (d === null || Number.isNaN(d)) return '';
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d === -1) return 'ayer';
  return d > 0 ? `en ${d} días` : `hace ${-d} días`;
}

/** 2026-10-16 → 16 oct 2026 (deja el texto tal cual si no es una fecha). */
export function formatDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
}

const cx = (...c) => c.filter(Boolean).join(' ');

/* ─────────────────────────────────────────────────────────────
   Button
   ───────────────────────────────────────────────────────────── */

const BUTTON_VARIANTS = {
  primary: 'bg-brand-strong text-white hover:bg-brand-press',
  secondary: 'border border-line-strong bg-raised text-fg hover:bg-raised-hover',
  ghost: 'text-muted hover:bg-raised hover:text-fg',
  danger: 'bg-bad-strong text-white hover:bg-bad-press',
};
const BUTTON_SIZES = {
  sm: 'h-7 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm',
  icon: 'h-8 w-8 justify-center',
};

export function Button({
  variant = 'secondary', size = 'md', icon: Icon, block, className, children, type = 'button', ...props
}) {
  const iconSize = size === 'md' ? 16 : 14;
  return (
    <button
      type={type}
      {...props}
      className={cx(
        'inline-flex shrink-0 items-center rounded-md font-medium whitespace-nowrap transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && 'w-full justify-center',
        className,
      )}
    >
      {Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Badge: punto de color + texto. Sin relleno, sin borde.
   `outline` lo enmarca para etiquetas dentro de listas densas.
   ───────────────────────────────────────────────────────────── */

const DOT_TONES = {
  ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', brand: 'bg-brand', neutral: 'bg-subtle',
};

export function Badge({ tone = 'neutral', outline, children, className }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-fg',
        outline && 'rounded-sm border border-line px-1.5 leading-[18px] text-muted',
        className,
      )}
    >
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONES[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] || 'neutral'}>{STATUS_LABELS[status] || status}</Badge>;
}

export function CapStatusBadge({ status, label }) {
  return <Badge outline tone={CAP_STATUS_TONES[status] || 'neutral'}>{label}</Badge>;
}

/* ─────────────────────────────────────────────────────────────
   Superficies y encabezados
   ───────────────────────────────────────────────────────────── */

/** Superficie con un solo borde. Adentro se separa con divisores, no con más paneles. */
export function Panel({ title, description, actions, children, className, bodyClassName, flush }) {
  const hasHeader = title || actions;
  return (
    <section className={cx('rounded-lg border border-line bg-surface', className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(!flush && 'p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Título de sección dentro de una página o panel. */
export function SectionLabel({ children, className, action }) {
  return (
    <div className={cx('mb-3 flex items-center justify-between gap-3', className)}>
      <h3 className="text-2xs font-semibold tracking-[0.06em] text-subtle uppercase">{children}</h3>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, onBack }) {
  return (
    <header className="mb-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 mb-3 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Volver
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.01em] text-fg">{title}</h1>
          {description && <p className="mt-1 truncate text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Contenedor de página para vistas de detalle (en vez de un modal gigante). */
export function DetailPage({ title, subtitle, onBack, children }) {
  return (
    <div>
      <PageHeader title={title} description={subtitle} onBack={onBack} />
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Mensajes
   ───────────────────────────────────────────────────────────── */

const NOTICE_BAR = { info: 'border-l-brand', ok: 'border-l-ok', warn: 'border-l-warn', bad: 'border-l-bad' };
const NOTICE_TITLE = { info: 'text-fg', ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' };

/** Aviso: superficie neutra con una barra de color a la izquierda. */
export function Notice({ tone = 'info', title, children, action, className }) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={cx(
        'flex flex-wrap items-start justify-between gap-3 rounded-md border border-l-2 border-line bg-surface px-3 py-2.5 text-xs text-muted',
        NOTICE_BAR[tone],
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1 break-words">
        {title && <p className={cx('font-medium', NOTICE_TITLE[tone])}>{title}</p>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="px-4 py-10 text-center">
      {title && <p className="text-sm font-medium text-fg">{title}</p>}
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-subtle">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Tablas
   ───────────────────────────────────────────────────────────── */

export function Table({ children, minWidth, className, fixed }) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cx('w-full border-collapse text-left text-sm', fixed && 'table-fixed', className)}
        style={minWidth ? { minWidth } : undefined}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, align }) {
  return (
    <th
      scope="col"
      className={cx(
        'h-9 border-b border-line px-4 text-2xs font-semibold tracking-[0.06em] whitespace-nowrap text-subtle uppercase',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, align, ...props }) {
  return (
    <td
      {...props}
      className={cx(
        'h-10 px-4 py-2 align-middle',
        align === 'right' && 'nx-num text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Fila clicable accesible por teclado (Enter / Espacio). */
export function RowButton({ onActivate, children, className, label }) {
  return (
    <tr
      tabIndex={0}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
      }}
      className={cx('cursor-pointer border-b border-line last:border-0 hover:bg-raised', className)}
    >
      {children}
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────────
   Modal
   ───────────────────────────────────────────────────────────── */

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
  const titleId = useId();

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
      className="fixed inset-0 z-50"
      style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'rgba(5, 6, 8, 0.72)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto my-6 w-[calc(100%-2rem)] rounded-xl border border-line-strong bg-surface"
        style={{ maxWidth }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-xl border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="truncate text-lg font-semibold text-fg">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-xs text-subtle">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-m-1.5 shrink-0 rounded-md p-1.5 text-muted hover:bg-raised hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Formularios
   ───────────────────────────────────────────────────────────── */

const CONTROL = 'rounded-md border border-line-strong bg-canvas text-fg transition-colors hover:border-subtle disabled:cursor-not-allowed disabled:opacity-50';
const CONTROL_SIZES = { md: 'h-9 px-3 text-sm', sm: 'h-7 px-2 text-xs' };

export function Label({ htmlFor, children }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-muted">{children}</label>;
}

export function Input({ size = 'md', className, ...props }) {
  return <input {...props} className={cx('w-full', CONTROL, CONTROL_SIZES[size], className)} />;
}

export function Select({ size = 'md', className, children, ...props }) {
  return (
    <select {...props} className={cx('w-full', CONTROL, CONTROL_SIZES[size], className)}>
      {children}
    </select>
  );
}

/** Input con etiqueta. `hint` va debajo, en texto secundario. */
export function Field({ label, hint, id, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div>
      <Label htmlFor={inputId}>{label}</Label>
      <Input id={inputId} aria-describedby={hint ? `${inputId}-hint` : undefined} {...props} />
      {hint && <p id={`${inputId}-hint`} className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function SelectField({ label, hint, id, children, ...props }) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div>
      <Label htmlFor={selectId}>{label}</Label>
      <Select id={selectId} {...props}>{children}</Select>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

/** Campo de contraseña con botón para mostrar/ocultar. */
export function PasswordInput({ id, visible, onToggleVisible, ...props }) {
  return (
    <div className={cx('nx-input-group flex h-9 items-center', CONTROL)}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        {...props}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-fg outline-none"
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={!!visible}
        className="mr-1 rounded-sm px-2 py-1 text-xs font-medium text-muted hover:text-fg"
      >
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  );
}

/**
 * Interruptor simple. `value` true/false.
 * Tamaño, posición y colores en `style` (con tokens CSS) para que siempre se
 * vea y se pueda tocar, aunque Tailwind no haya generado alguna clase.
 */
export function Toggle({ value, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
      style={{
        position: 'relative', width: 32, height: 18, flexShrink: 0, borderRadius: 9999,
        background: value ? 'var(--color-brand)' : 'var(--color-line-strong)', transition: 'background .15s',
        opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer', border: 0, padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, left: value ? 16 : 2, width: 14, height: 14, borderRadius: 9999,
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
export function LimitInput({ value, onChange, disabled, placeholder = 'Ilimitado', label }) {
  return (
    <input
      type="number"
      min="0"
      disabled={disabled}
      aria-label={label}
      value={value === null || value === undefined ? '' : value}
      onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      placeholder={placeholder}
      className={cx('nx-num w-20', CONTROL, CONTROL_SIZES.sm)}
    />
  );
}

/** Pestañas con subrayado. */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="mb-6 flex gap-5 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cx(
              '-mb-px border-b-2 pt-1 pb-2.5 text-sm whitespace-nowrap transition-colors',
              active ? 'border-brand font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Grupo de opciones excluyentes (filtros, ciclo de cobro, período). */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-line-strong bg-canvas p-0.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'h-7 rounded-sm px-2.5 text-xs font-medium transition-colors',
              active ? 'bg-raised-hover text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function UsageBar({ percent, exceeded }) {
  const p = Math.min(100, Math.max(0, percent || 0));
  const color = exceeded ? 'var(--color-bad)' : p >= 80 ? 'var(--color-warn)' : 'var(--color-brand)';
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-raised-hover" role="presentation">
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

/** Par etiqueta/valor para fichas de información (usar dentro de <dl>). */
export function Info({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  );
}
