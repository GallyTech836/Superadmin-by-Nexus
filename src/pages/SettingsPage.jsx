export default function SettingsPage({ userEmail, businessCount }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Configuración</h1>
      <p className="mt-1 text-sm text-slate-500">Información de la cuenta y de la plataforma</p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-slate-900 p-5">
          <p className="mb-3 text-sm font-medium text-white">Super Admin</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Nombre</span><span className="text-white">Gally</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="text-white">{userEmail}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Rol</span><span className="text-white">super_admin</span></div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900 p-5">
          <p className="mb-3 text-sm font-medium text-white">Firebase</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Modo</span><span className="text-emerald-400">Conectado (proyecto real)</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Proyecto</span><span className="text-white">gally-flow</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Negocios gestionados</span><span className="text-white">{businessCount}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}