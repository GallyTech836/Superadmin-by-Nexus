import { PageHeader, Panel, Badge } from '../components/common';

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="text-sm text-subtle">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}

export default function SettingsPage({ userEmail, businessCount }) {
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
      </div>
    </div>
  );
}
