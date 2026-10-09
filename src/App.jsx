import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import LoginScreen from './auth/LoginScreen';
import { useSuperAdminAuth } from './auth/useSuperAdminAuth';
import { useBusinesses } from './data/useBusinesses';
import { useActivity } from './data/useActivity';
import { usePlatformStats } from './data/usePlatformStats';
import { usePlans } from './data/usePlans';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import NegociosPage from './pages/NegociosPage';
import AdminsPage from './pages/AdminsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import PlansPage from './pages/PlansPage';
import ActivityPage from './pages/ActivityPage';
import SettingsPage from './pages/SettingsPage';

const LoadingScreen = (
  <div style={{ background: '#020617', width: '100vw', height: '100vh' }} />
);

function App() {
  const { user, loading, error, login, logout } = useSuperAdminAuth();
  const [page, setPage] = useState('dashboard');
  const { businesses, loading: loadingBiz, updateStatus, updatePlan, updateInfo, updateSubscriptionEnd, updateOverrides, updateTrial, updateTerminology } = useBusinesses();
  const { activity, pushActivity } = useActivity();
  const platformStats = usePlatformStats();
  const { plans, createPlan, updatePlan: updatePlanDef, deletePlan } = usePlans();

  // Menú lateral: se cierra con X y se abre con ☰ (se recuerda la elección).
  // En pantallas chicas se muestra encima del contenido y se cierra solo al
  // elegir una sección.
  const isSmall = () => typeof window !== 'undefined' && window.innerWidth < 768;
  const [small, setSmall] = useState(isSmall);
  const [menuOpen, setMenuOpen] = useState(() => {
    if (isSmall()) return false;
    try { return localStorage.getItem('sa_menu_open') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    const onResize = () => setSmall(isSmall());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  function setMenu(open) {
    setMenuOpen(open);
    if (!small) { try { localStorage.setItem('sa_menu_open', open ? '1' : '0'); } catch { /* sin storage */ } }
  }
  function goTo(key) {
    setPage(key);
    if (small) setMenuOpen(false);
  }

  if (loading) return LoadingScreen;

  if (!user) {
    return <LoginScreen onLogin={login} error={error} loading={loading} />;
  }

  const pages = {
    dashboard: <DashboardPage businesses={businesses} plans={plans} platformStats={platformStats} />,
    negocios: <NegociosPage businesses={businesses} plans={plans} activity={activity} updateStatus={updateStatus} updatePlan={updatePlan} updateInfo={updateInfo} updateSubscriptionEnd={updateSubscriptionEnd} updateOverrides={updateOverrides} updateTrial={updateTrial} updateTerminology={updateTerminology} pushActivity={pushActivity} />,
    administradores: <AdminsPage businesses={businesses} />,
    suscripciones: <SubscriptionsPage businesses={businesses} plans={plans} updatePlan={updatePlan} updateSubscriptionEnd={updateSubscriptionEnd} pushActivity={pushActivity} />,
    planes: <PlansPage plans={plans} businesses={businesses} createPlan={createPlan} updatePlan={updatePlanDef} deletePlan={deletePlan} pushActivity={pushActivity} />,
    actividad: <ActivityPage activity={activity} businesses={businesses} />,
    configuracion: <SettingsPage userEmail={user.email} businessCount={businesses.length} />,
  };

  return (
    <div className="flex h-screen bg-slate-950">
      {menuOpen && small && (
        <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,.5)' }} />
      )}
      {menuOpen && (
        <Sidebar page={page} setPage={goTo} onLogout={logout} userEmail={user.email} onClose={() => setMenu(false)} overlay={small} />
      )}
      <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">
        {!menuOpen && (
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Abrir menú"
            className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:text-white"
          >
            <Menu size={18} />
            <span className="font-semibold text-white">NEXUS<span className="text-indigo-400">.</span></span>
          </button>
        )}
        {loadingBiz ? (
          <p className="text-sm text-slate-500">Cargando negocios…</p>
        ) : (
          pages[page]
        )}
      </main>
    </div>
  );
}

export default App;