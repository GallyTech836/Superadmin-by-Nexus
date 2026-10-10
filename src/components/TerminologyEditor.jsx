import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Pencil, X } from 'lucide-react';
import {
  TERM_CONCEPTS, TERM_CONCEPT_LABELS, TERM_MAX_LENGTH,
  getBusinessProfile, resolveTerminology, cleanTerminologyOverrides,
} from '../shared/businessProfileModel';

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
    <div className="border-t border-white/5 pt-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">Terminología</p>
        <p className="text-xs text-slate-600">
          Predeterminada del tipo <span className="text-slate-400">{profile.label}</span>. Solo cambia textos, no datos ni capacidades.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/5 text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">Concepto</th>
              <th className="px-3 py-2 font-medium">Predeterminado</th>
              <th className="px-3 py-2 font-medium">En uso</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {TERM_CONCEPTS.map((concept) => {
              const d = defaultOf(concept);
              const isCustom = !!effective.customized[concept];
              const isEditing = editing === concept;
              return (
                <tr key={concept} className={isCustom ? 'bg-indigo-500/5' : ''}>
                  <td className="px-3 py-2 text-slate-400">{TERM_CONCEPT_LABELS[concept]}</td>
                  <td className="px-3 py-2 text-slate-500">{d.singular} / {d.plural}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          aria-label="Singular"
                          value={row.singular}
                          maxLength={TERM_MAX_LENGTH}
                          placeholder="Singular"
                          onChange={(e) => setRow((r) => ({ ...r, singular: e.target.value }))}
                          className="w-28 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
                        />
                        <input
                          aria-label="Plural"
                          value={row.plural}
                          maxLength={TERM_MAX_LENGTH}
                          placeholder="Plural"
                          onChange={(e) => setRow((r) => ({ ...r, plural: e.target.value }))}
                          className="w-28 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
                        />
                        <select
                          aria-label="Género"
                          value={row.gender}
                          onChange={(e) => setRow((r) => ({ ...r, gender: e.target.value }))}
                          className="rounded-md border border-white/10 bg-slate-950 px-1.5 py-1 text-xs text-white outline-none"
                        >
                          <option value="m">{GENDER_LABELS.m}</option>
                          <option value="f">{GENDER_LABELS.f}</option>
                        </select>
                        <span className="text-xs text-slate-500">
                          Ej.: {row.gender === 'f' ? 'Nueva' : 'Nuevo'} {row.singular || '…'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-white">
                        {effective.terminology[concept]} / {effective.terminology[`${concept}s`]}
                        {isCustom && <span className="ml-2 rounded bg-indigo-500/15 px-1.5 text-xs text-indigo-300">Personalizado</span>}
                      </span>
                    )}
                    {isEditing && error && <p className="mt-1 text-xs text-red-400">{error}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={saveRow} disabled={busy} className="rounded-md bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50">Guardar</button>
                        <button onClick={() => setEditing(null)} className="rounded-md p-1 text-slate-500 hover:text-white" aria-label="Cancelar"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-3">
                        <button onClick={() => startEdit(concept)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"><Pencil size={12} /> Personalizar</button>
                        {isCustom && (
                          <button onClick={() => resetRow(concept)} disabled={busy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-50">
                            <RotateCcw size={12} /> Restablecer
                          </button>
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
        <p className="mt-1.5 text-xs text-slate-600">Las personalizaciones se conservan aunque cambies el tipo de negocio.</p>
      )}
    </div>
  );
}
