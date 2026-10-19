import { StatusBadge, PageHeader, Panel, EmptyState, Table, Th, Td, formatDate } from '../components/common';

export default function AdminsPage({ businesses }) {
  return (
    <div>
      <PageHeader
        title="Administradores"
        description={`${businesses.length} ${businesses.length === 1 ? 'administrador registrado' : 'administradores registrados'}`}
      />

      <Panel flush>
        <Table minWidth={680}>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Correo</Th>
              <Th>Negocio</Th>
              <Th>Estado</Th>
              <Th align="right">Alta</Th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <Td className="font-medium text-fg">{b.ownerName || '—'}</Td>
                <Td className="text-muted">{b.ownerEmail}</Td>
                <Td className="text-muted">{b.name}</Td>
                <Td><StatusBadge status={b.status === 'suspended' ? 'suspended' : 'active'} /></Td>
                <Td align="right" className="text-muted">{formatDate(b.createdAt) || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {businesses.length === 0 && <EmptyState title="Aún no hay administradores">Cada negocio que registres crea su administrador.</EmptyState>}
      </Panel>
      <p className="mt-3 text-xs text-subtle">
        Para suspender, reactivar o cambiar el plan de un administrador, hazlo desde su negocio en la sección Negocios.
      </p>
    </div>
  );
}
