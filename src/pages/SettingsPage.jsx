import { useEffect, useState } from 'react';
import { PageHeader, Panel, Badge, Field, Button } from '../components/common';
import { getSupportConfig, setSupportConfig } from '../data/superadminApi';

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="text-sm text-subtle">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
// Código de país + número: entre 8 y 15 dígitos (formato de wa.me).
const isValidWhatsapp = (v) => /^\d{8,15}$/.test(v);

function SupportPanel({ pushActivity }) {
  const [saved, setSaved] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    getSupportConfig()
      .then((data) => {
        const n = onlyDigits(data?.whatsapp);
        setSaved(n);
        setValue(n);
      })
      .catch((err) => setMsg({ type: 'error', text: `No se pudo cargar: ${err.message}` }))
      .finally(() => setLoading(false));
  }, []);

  const digits = onlyDigits(value);
  const valid = digits === '' || isValidWhatsapp(digits);
  const changed = digits !== saved;

  async function save() {
    if (!valid || !changed) return;
    setBusy(true);
    setMsg(null);
    try {
      await setSupportConfig(digits);
      await pushActivity?.('WhatsApp de soporte actualizado', `Número de soporte: ${saved || '—'} → ${digits || '—'}`, {
        before: { whatsapp: saved || null }, after: { whatsapp: digits || null },
      });
      setSaved(digits);
      setMsg({ type: 'ok', text: 'Guardado.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Soporte" description="Número al que escriben los negocios desde el aviso de vencimiento">
      <div className="space-y-3">
        <Field
          label="WhatsApp"
          inputMode="numeric"
          placeholder="59170000000"
          value={value}
          disabled={loading || busy}
          onChange={(e) => { setValue(onlyDigits(e.target.value)); setMsg(null); }}
          hint={valid ? 'Solo números, con código de país (591 para Bolivia).' : 'Número no válido: entre 8 y 15 dígitos, con código de país.'}
        />
        {digits && valid && (
          <p className="text-xs text-subtle">
            Enlace:{' '}
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="font-mono text-fg underline underline-offset-2">
              wa.me/{digits}
            </a>
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          {msg && <span className={`text-xs ${msg.type === 'error' ? 'text-bad' : 'text-ok'}`}>{msg.text}</span>}
          <Button variant="primary" size="sm" onClick={save} disabled={loading || busy || !valid || !changed}>
            Guardar
          </Button>
        </div>
      </div>
    </Panel>
  );
}

export default function SettingsPage({ userEmail, businessCount, pushActivity }) {
  return (
    <div>
      <PageHeader title="Configuración" description="Información de la cuenta y de la plataforma" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title="Cuenta">
          <dl className="-my-2.5 divide-y divide-line">
            <Row label="Nombre">Gally</Row>
            <Row label="Correo">{userEmail}</Row>
            <Row label="Rol"><span className="font-mono text-xs">super_admin</span></Row>
          </dl>
        </Panel>
        <Panel title="Firebase">
          <dl className="-my-2.5 divide-y divide-line">
            <Row label="Modo"><Badge tone="ok">Conectado (proyecto real)</Badge></Row>
            <Row label="Proyecto"><span className="font-mono text-xs">gally-flow</span></Row>
            <Row label="Negocios gestionados"><span className="nx-num">{businessCount}</span></Row>
          </dl>
        </Panel>
        <SupportPanel pushActivity={pushActivity} />
      </div>
    </div>
  );
}
