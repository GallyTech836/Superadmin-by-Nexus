import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import LoginScreen from './auth/LoginScreen';
import { useSuperAdminAuth } from './auth/useSuperAdminAuth';
import { useBusinesses } from './data/useBusinesses';
import { useActivity } from './data/useActivity';
import { usePlatformStats } from './data/usePlatformStats';
import { usePlans } from './data/usePlans';
import Sidebar, { BrandMark } from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import NegociosPage from './pages/NegociosPage';
import AdminsPage from './pages/AdminsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import PlansPage from './pages/PlansPage';
import ActivityPage from './pages/ActivityPage';
import SettingsPage from './pages/SettingsPage';

const LoadingScreen = (
  <div style={{ background: 'var(--color-canvas)', width: '100vw', height: '100vh' }} />
);

function App() {
  const { user, loading, error, login, logout } = useSuperAdminAuth();
  const [page, setPage] = useState('dashboard');
  // Negocio a abrir al llegar a "Negocios" desde un atajo del Resumen.
  const [focus, setFocus] = useState(null); // { id, tab } | null
  const { businesses, loading: loadingBiz, updateStatus, updatePlan, updateInfo, updateSubscriptionEnd, updateOverrides, updateTrial, updateTerminology, updateAddons } = useBusinesses();
  const { activity, pushActivity } = useActivity();
  const platformStats = usePlatformStats();
  const { plans, createPlan, updatePlan: updatePlanDef, deletePlan, setPlanActive, seedLaunchPlans } = usePlans();

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
    setFocus(null);
    if (small) setMenuOpen(false);
  }
  function openBusiness(id, tab = 'resumen') {
    setFocus({ id, tab });
    setPage('negocios');
  }

  if (loading) return LoadingScreen;

  if (!user) {
    return <LoginScreen onLogin={login} error={error} loading={loading} />;
  }

  const pages = {
    dashboard: <DashboardPage businesses={businesses} plans={plans} platformStats={platformStats} onOpenBusiness={openBusiness} onGoTo={goTo} />,
    negocios: <NegociosPage key={focus ? `${focus.id}:${focus.tab}` : 'list'} focus={focus} onFocusDone={() => setFocus(null)} businesses={businesses} plans={plans} activity={activity} updateStatus={updateStatus} updatePlan={updatePlan} updateInfo={updateInfo} updateSubscriptionEnd={updateSubscriptionEnd} updateOverrides={updateOverrides} updateTrial={updateTrial} updateTerminology={updateTerminology} updateAddons={updateAddons} pushActivity={pushActivity} />,
    administradores: <AdminsPage businesses={businesses} />,
    suscripciones: <SubscriptionsPage businesses={businesses} plans={plans} updatePlan={updatePlan} updateSubscriptionEnd={updateSubscriptionEnd} pushActivity={pushActivity} />,
    planes: <PlansPage plans={plans} businesses={businesses} createPlan={createPlan} updatePlan={updatePlanDef} deletePlan={deletePlan} setPlanActive={setPlanActive} seedLaunchPlans={seedLaunchPlans} pushActivity={pushActivity} />,
    actividad: <ActivityPage activity={activity} businesses={businesses} />,
    configuracion: <SettingsPage userEmail={user.email} businessCount={businesses.length} pushActivity={pushActivity} />,
  };

  return (
    <div className="flex h-screen bg-canvas">
      {menuOpen && small && (
        <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(5, 6, 8, 0.72)' }} />
      )}
      {menuOpen && (
        <Sidebar page={page} setPage={goTo} onLogout={logout} userEmail={user.email} onClose={() => setMenu(false)} overlay={small} />
      )}
      <main className="min-w-0 flex-1 overflow-y-auto">
        {!menuOpen && (
          <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas px-4 md:px-8">
            <button
              type="button"
              onClick={() => setMenu(true)}
              aria-label="Abrir menú"
              className="-ml-1.5 rounded-md p-1.5 text-muted hover:bg-raised hover:text-fg"
            >
              <Menu size={18} />
            </button>
            <BrandMark size={22} />
            <span className="text-sm font-semibold text-fg">Nexus</span>
          </div>
        )}
        <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
          {loadingBiz ? (
            <p className="text-sm text-muted" role="status">Cargando negocios…</p>
          ) : (
            pages[page]
          )}
        </div>
      </main>
    </div>
  );
}

export default App;