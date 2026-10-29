import { useEffect, useState } from 'react';
import { Badge, SectionLabel, formatDate, formatDateTime } from './common';
import { getExpiryNotices } from '../data/superadminApi';

function NoticeState({ aviso }) {
  if (!aviso) return <Badge tone="neutral">Pendiente</Badge>;
  const dias = aviso.diasRestantes;
  const faltaban = typeof dias === 'number'
    ? (dias === 0 ? 'vencía ese día' : `faltaban ${dias} ${dias === 1 ? 'día' : 'días'}`)
    : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <Badge tone="ok">Aceptado</Badge>
      <span className="text-xs text-subtle">
        {formatDateTime(aviso.aceptadoAt)}{faltaban ? ` · ${faltaban}` : ''}
      </span>
    </span>
  );
}

/** Solo lectura: qué avisos de vencimiento aceptó el admin, por período. */
export default function ExpiryNoticesSection({ negocioId }) {
  const [periodos, setPeriodos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setPeriodos(null);
    setError('');
    getExpiryNotices(negocioId)
      .then((list) => {
        if (!alive) return;
        const sorted = [...list].sort((a, b) => String(b.fechaVencimiento || '').localeCompare(String(a.fechaVencimiento || '')));
        setPeriodos(sorted);
      })
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [negocioId]);

  return (
    <div className="border-t border-line pt-5">
      <SectionLabel>Avisos de vencimiento</SectionLabel>
      {error && <p className="text-sm text-subtle">No se pudieron cargar los avisos ({error}).</p>}
      {!error && periodos === null && <p className="text-sm text-subtle">Cargando…</p>}
      {!error && periodos?.length === 0 && <p className="text-sm text-subtle">Sin avisos todavía.</p>}
      {!error && periodos?.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {periodos.map((p) => (
            <li key={`${p.tipo}_${p.fechaVencimiento}`} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] sm:items-center">
              <div className="text-sm text-fg">
                {p.tipo === 'trial' ? 'Prueba' : 'Plan'}
                <span className="block text-xs text-subtle">Vence {formatDate(p.fechaVencimiento)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-subtle">7 días</span>
                <NoticeState aviso={p.aviso7} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-subtle">5 días</span>
                <NoticeState aviso={p.aviso5} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
