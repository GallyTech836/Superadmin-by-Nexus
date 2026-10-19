import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Pencil, X } from 'lucide-react';
import {
  TERM_CONCEPTS, TERM_CONCEPT_LABELS, TERM_MAX_LENGTH,
  getBusinessProfile, resolveTerminology, cleanTerminologyOverrides,
} from '../shared/businessProfileModel';
import { Button, Badge, Input, Select, SectionLabel } from './common';

const GENDER_LABELS = { m: 'Masculino', f: 'Femenino' };

/**
 * Terminología de UN negocio (solo textos; no toca datos, planes ni capacidades).
 * Prioridad: personalización del negocio > término del tipo de negocio > genérico.
 * Guardar una fila igual al predeterminado = sin personalización (se borra).
 */
export default function TerminologyEditor({ business, onSave, busy }) {
  const profile = useMemo(() => getBusinessProfile(business.businessType), [business.businessType]);
  const saved = useMemo(() => cleanTerminologyOverrides(business.terminologyOverrides), [business.terminologyOverrides]);
  const defaults = useMemo(() => resolveTerminology(profile, null), [profile]);
  const effective = useMemo(() => resolveTerminology(profile, saved), [profile, saved]);

  const [editing, setEditing] = useState(null); // concept | null
  const [row, setRow] = useState({ singular: '', plural: '', gender: 'm' });
  const [error, setError] = useState('');
  useEffect(() => { setEditing(null); setError(''); }, [business.id]);

  function defaultOf(concept) {
    return { singular: defaults.terminology[concept], plural: defaults.terminology[`${concept}s`], gender: defaults.gender[concept] };
  }

  function startEdit(concept) {
    setRow(saved[concept] || defaultOf(concept));
    setEditing(concept);
    setError('');
  }

  async function saveRow() {
    const next = { ...saved, [editing]: row };
    const clean = cleanTerminologyOverrides(next);
    if (!clean[editing]) { setError('Completa singular y plural.'); return; }
    const d = defaultOf(editing);
    const v = clean[editing];
    // Si quedó igual al predeterminado no es una personalización.
    if (v.singular === d.singular && v.plural === d.plural && v.gender === d.gender) delete clean[editing];
    await onSave(clean, { concept: editing, value: clean[editing] || null });
    setEditing(null);
  }

  async function resetRow(concept) {
    const next = { ...saved };
    delete next[concept];
    await onSave(cleanTerminologyOverrides(next), { concept, value: null });
    if (editing === concept) setEditing(null);
  }

  return (
    <div className="border-t border-line pt-5">
      <SectionLabel className="!mb-1">Terminología</SectionLabel>
      <div className="mb-3">
        <p className="text-xs text-subtle">
          Predeterminada del tipo <span className="text-fg">{profile.label}</span>. Solo cambia textos, no datos ni capacidades.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-2xs tracking-[0.06em] text-subtle uppercase">
              <th className="px-3 py-2 font-semibold">Concepto</th>
              <th className="px-3 py-2 font-semibold">Predeterminado</th>
              <th className="px-3 py-2 font-semibold">En uso</th>
              <th className="px-3 py-2 font-semibold"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {TERM_CONCEPTS.map((concept) => {
              const d = defaultOf(concept);
              const isCustom = !!effective.customized[concept];
              const isEditing = editing === concept;
              return (
                <tr key={concept} className={isCustom ? 'bg-brand-wash' : ''}>
                  <td className="px-3 py-2 text-muted">{TERM_CONCEPT_LABELS[concept]}</td>
                  <td className="px-3 py-2 text-subtle">{d.singular} / {d.plural}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          size="sm"
                          aria-label="Singular"
                          value={row.singular}
                          maxLength={TERM_MAX_LENGTH}
                          placeholder="Singular"
                          onChange={(e) => setRow((r) => ({ ...r, singular: e.target.value }))}
                          className="!w-28"
                        />
                        <Input
                          size="sm"
                          aria-label="Plural"
                          value={row.plural}
                          maxLength={TERM_MAX_LENGTH}
                          placeholder="Plural"
                          onChange={(e) => setRow((r) => ({ ...r, plural: e.target.value }))}
                          className="!w-28"
                        />
                        <Select
                          size="sm"
                          aria-label="Género"
                          value={row.gender}
                          onChange={(e) => setRow((r) => ({ ...r, gender: e.target.value }))}
                          className="!w-auto"
                        >
                          <option value="m">{GENDER_LABELS.m}</option>
                          <option value="f">{GENDER_LABELS.f}</option>
                        </Select>
                        <span className="text-xs text-subtle">
                          Ej.: {row.gender === 'f' ? 'Nueva' : 'Nuevo'} {row.singular || '…'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-fg">
                        {effective.terminology[concept]} / {effective.terminology[`${concept}s`]}
                        {isCustom && <Badge outline tone="brand" className="ml-2">Personalizado</Badge>}
                      </span>
                    )}
                    {isEditing && error && <p role="alert" className="mt-1 text-xs text-bad">{error}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="primary" onClick={saveRow} disabled={busy}>Guardar</Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancelar" className="!h-7 !w-7"><X size={14} /></Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => startEdit(concept)}>Personalizar</Button>
                        {isCustom && (
                          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => resetRow(concept)} disabled={busy}>
                            Restablecer
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {Object.keys(saved).length > 0 && (
        <p className="mt-2 text-xs text-subtle">Las personalizaciones se conservan aunque cambies el tipo de negocio.</p>
      )}
    </div>
  );
}
