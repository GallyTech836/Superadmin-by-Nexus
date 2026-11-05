import { useEffect, useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import {
  FORM_TEMPLATES, LABEL_MAX_LENGTH, OPTION_MAX_LENGTH, MAX_OPTIONS,
  getFormTemplateKey, cleanBookingFormConfig, defaultBookingFormConfig,
} from '../shared/bookingFormModel';
import { Button, Badge, Input, SectionLabel, Toggle } from './common';

const TIPOS = { image: 'Foto', text: 'Texto', select: 'Opciones', age: 'Edad', date: 'Fecha' };

/**
 * Formulario de reserva de UN negocio (peluquería canina: datos de la mascota).
 * Lo usan el link público y el asistente de WhatsApp de Nexus. Se guarda en
 * negocios/{id}.bookingFormConfig; sin config, Nexus usa la plantilla.
 * Solo aparece si el tipo de negocio tiene plantilla (bookingFormModel).
 */
export default function BookingFormEditor({ business, onSave, busy }) {
  const templateKey = getFormTemplateKey(business.businessType);
  const saved = useMemo(
    () => (templateKey ? cleanBookingFormConfig(templateKey, business.bookingFormConfig) : { fields: [] }),
    [templateKey, business.bookingFormConfig],
  );
  const [fields, setFields] = useState(saved.fields);
  const [error, setError] = useState('');
  useEffect(() => { setFields(saved.fields); setError(''); }, [saved, business.id]);

  if (!templateKey) return null;
  const tpl = FORM_TEMPLATES[templateKey];
  const tipoDe = (key) => tpl.fields.find((f) => f.key === key)?.type;
  const dirty = JSON.stringify(fields) !== JSON.stringify(saved.fields);
  const isDefault = JSON.stringify(saved.fields) === JSON.stringify(defaultBookingFormConfig(templateKey).fields);

  const patch = (i, p) => setFields((list) => list.map((f, j) => {
    if (j !== i) return f;
    const next = { ...f, ...p };
    if (!next.enabled) next.required = false; // un campo apagado no puede ser obligatorio
    return next;
  }));
  const move = (i, d) => setFields((list) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const out = [...list];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  });

  async function save(next) {
    const clean = cleanBookingFormConfig(templateKey, { fields: next });
    if (!clean.fields.some((f) => f.enabled)) { setError('Deja al menos un campo activo.'); return; }
    setError('');
    await onSave(clean);
  }

  return (
    <div className="border-t border-line pt-5">
      <SectionLabel className="!mb-1">Formulario de reserva</SectionLabel>
      <p className="mb-3 text-xs text-subtle">
        Datos que se piden al reservar, en el link público y por WhatsApp (mismo orden y obligatorios).
        {isDefault && <Badge outline className="ml-2">Predeterminado</Badge>}
      </p>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-2xs tracking-[0.06em] text-subtle uppercase">
              <th className="px-3 py-2 font-semibold">Orden</th>
              <th className="px-3 py-2 font-semibold">Etiqueta</th>
              <th className="px-3 py-2 font-semibold">Tipo</th>
              <th className="px-3 py-2 font-semibold">Activo</th>
              <th className="px-3 py-2 font-semibold">Obligatorio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {fields.map((f, i) => {
              const tipo = tipoDe(f.key);
              return (
                <tr key={f.key} className={f.enabled ? '' : 'opacity-60'}>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" icon={ArrowUp} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="!h-7 !w-7 justify-center" />
                      <Button size="icon" variant="ghost" icon={ArrowDown} onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Bajar" className="!h-7 !w-7 justify-center" />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input size="sm" aria-label="Etiqueta" value={f.label} maxLength={LABEL_MAX_LENGTH}
                      onChange={(e) => patch(i, { label: e.target.value })} className="!w-48" />
                    {tipo === 'select' && (
                      <Input size="sm" aria-label="Opciones separadas por coma" value={(f.options || []).join(', ')}
                        maxLength={MAX_OPTIONS * (OPTION_MAX_LENGTH + 2)}
                        onChange={(e) => patch(i, { options: e.target.value.split(',').map((o) => o.trimStart()) })}
                        placeholder="Opciones separadas por coma" className="mt-1.5 !w-48" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{TIPOS[tipo] || tipo}</td>
                  <td className="px-3 py-2"><Toggle value={f.enabled} onChange={(v) => patch(i, { enabled: v })} label={`Activar ${f.label}`} /></td>
                  <td className="px-3 py-2"><Toggle value={f.required} disabled={!f.enabled} onChange={(v) => patch(i, { required: v })} label={`${f.label} obligatorio`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-bad">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => save(fields)} disabled={busy || !dirty}>Guardar formulario</Button>
        {dirty && <Button size="sm" variant="ghost" onClick={() => setFields(saved.fields)} disabled={busy}>Descartar</Button>}
        {!isDefault && (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => save(defaultBookingFormConfig(templateKey).fields)} disabled={busy}>
            Restablecer
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-subtle">Las opciones necesitan al menos 2; si no, se usan las predeterminadas.</p>
    </div>
  );
}
