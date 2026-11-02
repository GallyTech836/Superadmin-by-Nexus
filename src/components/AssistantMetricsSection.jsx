import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Button, Badge, Info, Input, Label, Select, Toggle, Notice, Table, Th, Td,
} from './common';
import { getAssistantMetrics, getAssistantMetricsHistory, setAssistantMetricsConfig } from '../data/superadminApi';
import {
  TRACKING_LABELS, TRACKING_TONES, CONVERSATION_LABELS, trackingState, monthLabel, dayLabel, todayInLaPaz,
} from '../shared/assistantMetricsModel';

const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-BO'));
const CONV_ORDER = ['reserva', 'reprogramacion', 'humano', 'abandonada', 'consulta'];
const CONV_COLORS = {
  reserva: 'var(--color-ok)',
  reprogramacion: 'var(--color-brand)',
  humano: 'var(--color-warn)',
  abandonada: 'var(--color-bad)',
  consulta: 'var(--color-subtle)',
};
const ALCANCE_LABELS = { completo: 'Real', parcial: 'Parcial', ninguno: 'Pruebas' };

/**
 * Asistente WhatsApp / Consumo (pestaña Consumo del negocio).
 * Todo se lee del backend (solo Super Admin): contadores del mes, conversaciones,
 * reservas con bookedBy 'assistant' y la fecha de inicio de medición.
 */
export default function AssistantMetricsSection({ business, pushActivity }) {
  const hoy = todayInLaPaz();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, h] = await Promise.all([getAssistantMetrics(business.id, mes), getAssistantMetricsHistory(business.id)]);
      setReport(r);
      setHistory(h);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [business.id, mes]);

  useEffect(() => { load(); }, [load]);

  // ── Configuración del seguimiento ──
  const config = report?.config || history?.config || null;
  const [startDraft, setStartDraft] = useState('');
  useEffect(() => { setStartDraft(config?.startDate || ''); }, [config?.startDate]);
  const [saving, setSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState({ type: '', text: '' });

  async function saveConfig(body, okText) {
    setSaving(true);
    setConfigMsg({ type: '', text: '' });
    try {
      const r = await setAssistantMetricsConfig(business.id, body);
      const antes = r.antes || {};
      const partes = [];
      if ((antes.startDate || null) !== (r.config.startDate || null)) partes.push(`inicio de medición ${antes.startDate || 'sin fecha'} → ${r.config.startDate || 'sin fecha'}`);
      if (antes.enabled !== r.config.enabled) partes.push(`seguimiento ${r.config.enabled ? 'activado' : 'pausado'}`);
      if (partes.length && pushActivity) {
        await pushActivity('Seguimiento del asistente', `${business.name}: ${partes.join('; ')}`, { negocioId: business.id, before: antes, after: r.config });
      }
      setConfigMsg({ type: 'ok', text: okText });
      await load();
    } catch (err) {
      setConfigMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const estado = report?.estado || (config ? trackingState(config, hoy) : null);
  const monthOptions = [...new Set([hoy.slice(0, 7), ...(history?.meses || []).map((m) => m.mes)])].sort().reverse();

  return (
    <section className="rounded-lg border border-line bg-surface">
      {/* Encabezado + configuración */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-medium text-fg">Asistente WhatsApp / Consumo</p>
          {estado && (
            <p className="mt-0.5 text-xs text-subtle">
              <Badge tone={TRACKING_TONES[estado]}>{TRACKING_LABELS[estado]}</Badge>
              {estado === 'pruebas' && config?.startDate && <span className="ml-1.5">· empieza el {dayLabel(config.startDate)}</span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor={`wa-start-${business.id}`}>Inicio de medición real</Label>
            <Input
              id={`wa-start-${business.id}`}
              size="sm"
              type="date"
              className="!w-auto"
              value={startDraft}
              onChange={(e) => setStartDraft(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={saving || (startDraft || '') === (config?.startDate || '')}
            onClick={() => saveConfig({ startDate: startDraft || null }, startDraft ? `Medición real desde el ${dayLabel(startDraft)}` : 'Sin fecha: el negocio queda en pruebas')}
          >
            Guardar fecha
          </Button>
          <div className="flex h-8 items-center gap-2">
            <Toggle
              label="Seguimiento estadístico"
              value={config?.enabled !== false}
              disabled={saving || !config}
              onChange={(on) => saveConfig({ enabled: on }, on ? 'Seguimiento activado' : 'Seguimiento pausado: no se registran datos nuevos')}
            />
            <span className="text-xs text-muted">Seguimiento</span>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {configMsg.text && <Notice tone={configMsg.type === 'error' ? 'bad' : 'ok'}>{configMsg.text}</Notice>}

        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={`wa-mes-${business.id}`}>Mes</Label>
          <Select id={`wa-mes-${business.id}`} size="sm" className="!w-auto" value={mes} onChange={(e) => setMes(e.target.value)}>
            {monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </Select>
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={load} disabled={loading} className="ml-auto">
            {loading ? 'Cargando…' : 'Actualizar'}
          </Button>
        </div>

        {error && <Notice tone="bad">No se pudieron leer las métricas: {error}</Notice>}

        {report && <MonthSummary report={report} />}

        {history?.meses?.length > 0 && <HistoryTable meses={history.meses} selected={mes} onSelect={setMes} />}

        <p className="text-xs text-subtle">
          Conversación: mensajes del mismo cliente con menos de 30 min entre sí. Termina sin reserva cuando pasan 30 min sin que confirme;
          mientras sigue abierta puede cambiar de categoría. Reservas: citas del mes (por fecha de la cita) sin canceladas ni registros de
          servicio; por WhatsApp = creadas por el asistente desde el inicio de la medición. Lo anterior a esa fecha se muestra como pruebas.
        </p>
      </div>
    </section>
  );
}

function MonthSummary({ report }) {
  const { mensajes: m, reservas: r, conversaciones: c, alcance } = report;

  if (alcance === 'ninguno') {
    return (
      <Notice tone="info" title="Este mes no tiene consumo real">
        {report.config?.startDate
          ? `La medición empieza el ${dayLabel(report.config.startDate)}.`
          : 'Falta la fecha de inicio de medición: todo cuenta como pruebas.'}
        {' '}Mensajes de prueba enviados: <b className="nx-num">{fmt(m.enviadosPruebas)}</b>. Reservas por WhatsApp en el mes: <b className="nx-num">{fmt(r.asistente)}</b> de {fmt(r.total)}.
      </Notice>
    );
  }

  const entradaIncompleta = m.entrantesDesde && report.desde && m.entrantesDesde > report.desde;
  return (
    <div className="space-y-5">
      {alcance === 'parcial' && (
        <p className="text-xs text-muted">
          Medición desde el {dayLabel(report.desde)}. Antes de esa fecha hubo <span className="nx-num">{fmt(m.enviadosPruebas)}</span> mensajes de prueba que no se cuentan.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3">
        <Info label="Mensajes salientes">
          <span className="nx-num text-lg">{fmt(m.enviados)}</span>
          {report.promedioDiarioEnviados !== null && <span className="ml-1.5 text-xs text-subtle">{fmt(report.promedioDiarioEnviados)}/día</span>}
          {m.rechazados > 0 && <span className="block text-xs text-warn">{fmt(m.rechazados)} sin respuesta por límite</span>}
        </Info>
        <Info label="Mensajes entrantes">
          <span className="nx-num text-lg">{fmt(m.entrantes)}</span>
          {entradaIncompleta && <span className="block text-xs text-subtle">registrados desde el {dayLabel(m.entrantesDesde)}</span>}
        </Info>
        <Info label="Interacciones">
          <span className="nx-num text-lg">{fmt(m.interacciones)}</span>
          <span className="block text-xs text-subtle">entrantes + salientes</span>
        </Info>
        <Info label="Reservas por WhatsApp">
          <span className="nx-num text-lg">{fmt(r.asistente)}</span>
          <span className="ml-1.5 text-xs text-subtle">de {fmt(r.total)}{r.porcentaje !== null ? ` · ${r.porcentaje.toLocaleString('es-BO')} %` : ''}</span>
        </Info>
        <Info label="Conversaciones">
          <span className="nx-num text-lg">{fmt(c.total)}</span>
          <span className="ml-1.5 text-xs text-subtle">{fmt(c.sinReserva)} sin reserva</span>
        </Info>
        <Info label="Salientes por reserva">
          <span className="nx-num text-lg">{report.promedioEnviadosPorReserva === null ? '—' : report.promedioEnviadosPorReserva.toLocaleString('es-BO')}</span>
          <span className="block text-xs text-subtle">salientes ÷ reservas por WhatsApp</span>
        </Info>
      </dl>

      <ConversationBar conversaciones={c} />
      <DailyChart diario={report.diario} />
    </div>
  );
}

function ConversationBar({ conversaciones: c }) {
  if (!c.total) return <p className="text-xs text-subtle">Sin conversaciones registradas en este período.</p>;
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted">Conversaciones por resultado</p>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-raised-hover" role="img" aria-label="Conversaciones por resultado">
        {CONV_ORDER.filter((k) => c[k] > 0).map((k) => (
          <div key={k} style={{ width: `${(c[k] / c.total) * 100}%`, background: CONV_COLORS[k] }} title={`${CONVERSATION_LABELS[k]}: ${c[k]}`} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {CONV_ORDER.map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: CONV_COLORS[k] }} aria-hidden="true" />
            {CONVERSATION_LABELS[k]} <span className="nx-num text-fg">{fmt(c[k])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras por día: salientes (azul) y entrantes (gris). Días de prueba, atenuados. */
function DailyChart({ diario = [] }) {
  if (!diario.length) return null;
  const max = Math.max(1, ...diario.map((d) => Math.max(d.enviados, d.entrantes)));
  const W = 600;
  const H = 120;
  const slot = W / diario.length;
  const bar = Math.max(1, Math.min(8, slot / 2 - 1.5));
  const y = (v) => H - (v / max) * H;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="font-medium">Consumo diario</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand" aria-hidden="true" />Salientes</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: 'var(--color-line-strong)' }} aria-hidden="true" />Entrantes</span>
        <span className="ml-auto nx-num text-subtle">máx. {fmt(max)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="h-auto w-full" role="img" aria-label="Mensajes por día">
        <line x1="0" x2={W} y1={H + 0.5} y2={H + 0.5} stroke="var(--color-line)" />
        {diario.map((d, i) => {
          const cx = i * slot + slot / 2;
          return (
            <g key={d.fecha} opacity={d.real ? 1 : 0.35}>
              <title>{`${dayLabel(d.fecha)}: ${d.enviados} salientes, ${d.entrantes} entrantes${d.real ? '' : ' (pruebas)'}`}</title>
              <rect x={cx - bar - 0.5} y={y(d.enviados)} width={bar} height={H - y(d.enviados)} rx="1" fill="var(--color-brand)" />
              <rect x={cx + 0.5} y={y(d.entrantes)} width={bar} height={H - y(d.entrantes)} rx="1" fill="var(--color-line-strong)" />
            </g>
          );
        })}
        <text x="0" y={H + 13} fontSize="10" fill="var(--color-subtle)">{dayLabel(diario[0].fecha)}</text>
        <text x={W} y={H + 13} fontSize="10" fill="var(--color-subtle)" textAnchor="end">{dayLabel(diario[diario.length - 1].fecha)}</text>
      </svg>
    </div>
  );
}

function HistoryTable({ meses, selected, onSelect }) {
  return (
    <div className="rounded-md border border-line">
      <p className="border-b border-line px-4 py-2.5 text-xs font-medium text-muted">Histórico mensual</p>
      <Table minWidth={520}>
        <thead>
          <tr>
            <Th>Mes</Th>
            <Th align="right">Salientes</Th>
            <Th align="right">Entrantes</Th>
            <Th align="right">Conversaciones</Th>
            <Th align="right">Con reserva</Th>
            <Th>Tipo</Th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr
              key={m.mes}
              onClick={() => onSelect(m.mes)}
              className={`cursor-pointer border-b border-line last:border-0 hover:bg-raised ${m.mes === selected ? 'bg-brand-wash' : ''}`}
            >
              <Td className="text-fg">{monthLabel(m.mes)}</Td>
              <Td align="right" className="text-fg">
                {m.alcance === 'ninguno' ? <span className="text-subtle">{fmt(m.enviadosPruebas)} prueba</span> : fmt(m.enviados)}
              </Td>
              <Td align="right" className="text-fg">{m.alcance === 'ninguno' ? '—' : fmt(m.entrantes)}</Td>
              <Td align="right" className="text-fg">{m.alcance === 'ninguno' ? '—' : fmt(m.conversaciones)}</Td>
              <Td align="right" className="text-fg">{m.alcance === 'ninguno' ? '—' : fmt(m.conReserva)}</Td>
              <Td><Badge tone={m.alcance === 'ninguno' ? 'warn' : m.alcance === 'parcial' ? 'brand' : 'ok'}>{ALCANCE_LABELS[m.alcance]}</Badge></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
