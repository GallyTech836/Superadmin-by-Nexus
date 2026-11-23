import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * Avisos cortos de Nexus Control.
 *
 *   const toast = useToast();
 *   toast.ok('Plan cambiado');
 *   toast.error('No se pudo guardar: …');
 *
 * - Celular: arriba al centro. Pantallas grandes: abajo a la derecha.
 * - Éxito se va a los 3,5 s; error a los 7 s (para alcanzar a leerlo).
 *   Tocar un aviso lo cierra.
 * - El mismo mensaje repetido no se apila: reinicia su tiempo. Máximo 3.
 */
const ToastContext = createContext(null);

const DURATION = { ok: 3500, error: 7000 };
const MAX_VISIBLE = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const listRef = useRef([]);
  const timersRef = useRef(new Map());
  const seqRef = useRef(0);

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
    listRef.current = listRef.current.filter((t) => t.id !== id);
    setToasts(listRef.current);
  }, []);

  const schedule = useCallback((id, type) => {
    clearTimeout(timersRef.current.get(id));
    timersRef.current.set(id, setTimeout(() => dismiss(id), DURATION[type]));
  }, [dismiss]);

  const show = useCallback((message, type) => {
    if (!message) return;
    const same = listRef.current.find((t) => t.message === message && t.type === type);
    if (same) { schedule(same.id, type); return; }
    seqRef.current += 1;
    const id = seqRef.current;
    let next = [...listRef.current, { id, message, type }];
    while (next.length > MAX_VISIBLE) {
      clearTimeout(timersRef.current.get(next[0].id));
      timersRef.current.delete(next[0].id);
      next = next.slice(1);
    }
    listRef.current = next;
    setToasts(next);
    schedule(id, type);
  }, [schedule]);

  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = {
      ok: (m) => show(m, 'ok'),
      error: (m) => show(m, 'error'),
    };
  }

  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach((t) => clearTimeout(t)); timers.clear(); };
  }, []);

  return (
    <ToastContext.Provider value={apiRef.current}>
      {children}
      {toasts.length > 0 && createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-6 md:items-end md:px-0"
          style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          {toasts.map((t) => {
            const isError = t.type === 'error';
            const Icon = isError ? XCircle : CheckCircle2;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => dismiss(t.id)}
                role={isError ? 'alert' : 'status'}
                className={`nx-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-line-strong border-l-2 bg-surface px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.45)] ${isError ? 'border-l-bad' : 'border-l-ok'}`}
              >
                <Icon size={16} aria-hidden="true" className={`mt-0.5 shrink-0 ${isError ? 'text-bad' : 'text-ok'}`} />
                <span className="text-sm text-fg">{t.message}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

const NOOP = { ok: () => {}, error: () => {} };

export function useToast() {
  return useContext(ToastContext) || NOOP;
}

/** Texto de error legible a partir de un error de Firebase o del backend. */
export function errorText(err) {
  const code = err?.code || '';
  if (code === 'permission-denied') return 'Sin permiso para hacer este cambio (revisa la sesión o las reglas).';
  if (code === 'unavailable') return 'Sin conexión con el servidor. Inténtalo de nuevo.';
  if (code === 'unauthenticated') return 'La sesión venció. Vuelve a iniciar sesión.';
  return err?.message || 'Error desconocido.';
}
