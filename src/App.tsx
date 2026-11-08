import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import StatsBar from './components/StatsBar';
import Portfolio from './components/Portfolio';
import Services from './components/Services';
import Pricing from './components/Pricing';
import Process from './components/Process';
import About from './components/About';
import Testimonials from './components/Testimonials';
import FAQ from './components/FAQ';
import Contact, { type BookingPrefill, type BookingSuccess } from './components/Contact';
import Footer from './components/Footer';
import FloatingContact from './components/FloatingContact';
import ScrollToTop from './components/ScrollToTop';
import type { AuthView } from './components/Auth';
import type { ProfileTab } from './components/UserProfile';
import { DEFAULT_PORTFOLIO, normalizePortfolioRow, type PortfolioItem } from './content/portfolio';
import { dayState, earliestBookableDate, useAvailability } from './lib/availability';
import { toDateKey } from './lib/format';
import { scrollToSection } from './lib/scroll';
import { GUEST_USER, InactiveAccountError, resolveSessionUser, type SessionUser } from './lib/session';
import { isDemoMode, supabase } from './lib/supabase';

const Auth = lazy(() => import('./components/Auth'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const Lightbox = lazy(() => import('./components/Lightbox'));
const SuccessModal = lazy(() => import('./components/SuccessModal'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'));

const TEAM_ROLES = ['superadmin', 'admin', 'staff'];

function Site() {
  const [user, setUser] = useState<SessionUser>(GUEST_USER);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(DEFAULT_PORTFOLIO);
  const [lightbox, setLightbox] = useState<{ items: PortfolioItem[]; index: number } | null>(null);
  const [success, setSuccess] = useState<BookingSuccess | null>(null);
  const [auth, setAuth] = useState<{ open: boolean; view: AuthView; intent?: 'booking' }>({ open: false, view: 'signin' });
  const [profile, setProfile] = useState<{ open: boolean; tab?: ProfileTab }>({ open: false });
  const [adminOpen, setAdminOpen] = useState(false);
  const [prefill, setPrefill] = useState<BookingPrefill | null>(null);
  const availability = useAvailability();

  const loadPortfolio = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_images')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error || !data || data.length === 0) {
        setPortfolio(DEFAULT_PORTFOLIO);
        return;
      }
      setPortfolio(data.map(normalizePortfolioRow).filter((item) => item.src));
    } catch {
      setPortfolio(DEFAULT_PORTFOLIO);
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    let cancelled = false;
    const apply = async (authUser: any) => {
      try {
        const resolved = await resolveSessionUser(authUser);
        if (!cancelled) setUser(resolved);
      } catch (error) {
        if (cancelled) return;
        setUser(GUEST_USER);
        if (error instanceof InactiveAccountError) toast.error(error.message, { id: 'inactive-account' });
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) void apply(session.user);
      })
      .catch(() => undefined);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') setUser(GUEST_USER);
      else if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) void apply(session.user);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const nextOpenDate = useMemo(() => {
    if (availability.status !== 'ready' || !availability.hasSlots) return null;
    const date = earliestBookableDate();
    for (let offset = 0; offset < 60; offset += 1) {
      const key = toDateKey(date);
      const state = dayState(key, availability);
      if (state === 'open' || state === 'limited') {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }
      date.setDate(date.getDate() + 1);
    }
    return null;
  }, [availability]);

  const goToBooking = useCallback((serviceId?: string, hours?: number) => {
    if (serviceId || hours) setPrefill({ serviceId, hours, nonce: Date.now() });
    window.setTimeout(() => scrollToSection('contact'), 0);
  }, []);

  const openAuth = (view: AuthView = 'signin', intent?: 'booking') => setAuth({ open: true, view, intent });

  const handleAuthSuccess = (nextUser: SessionUser) => {
    setUser(nextUser);
    toast.success(`Welcome, ${nextUser.firstName || nextUser.fullName}!`);
    if (auth.intent === 'booking' && nextUser.role === 'customer') {
      window.setTimeout(() => scrollToSection('contact'), 150);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* sign out locally anyway */
    }
    setUser(GUEST_USER);
    setProfile({ open: false });
    setAdminOpen(false);
    toast('Signed out');
  };

  const isTeam = TEAM_ROLES.includes(user.role);

  return (
    <div className="App">
      <a className="skip-link" href="#contact">
        Skip to booking
      </a>
      {isDemoMode && <div className="demo-banner">Demo mode · local test data only</div>}

      <Navigation
        user={user}
        onOpenAuth={() => openAuth('signin')}
        onOpenProfile={() => setProfile({ open: true })}
        onOpenAdmin={isTeam ? () => setAdminOpen(true) : undefined}
        onBook={() => goToBooking()}
      />

      <main>
        <Hero nextOpenDate={nextOpenDate} onBook={() => goToBooking()} />
        <StatsBar />
        <Portfolio items={portfolio} onOpen={(items, index) => setLightbox({ items, index })} />
        <Services onBook={(serviceId) => goToBooking(serviceId)} />
        <Pricing onBook={(serviceId, hours) => goToBooking(serviceId, hours)} />
        <Process onBook={() => goToBooking()} />
        <About />
        <Testimonials />
        <FAQ />
        <Contact
          user={user}
          availability={availability}
          prefill={prefill}
          onSuccess={setSuccess}
          onRequireAuth={(view) => openAuth(view, 'booking')}
          onUserUpdated={setUser}
        />
      </main>

      <Footer onBook={(serviceId) => goToBooking(serviceId)} />
      <FloatingContact />
      <ScrollToTop />

      <Suspense fallback={null}>
        {lightbox && (
          <Lightbox
            items={lightbox.items}
            index={lightbox.index}
            onIndexChange={(index) => setLightbox((current) => (current ? { ...current, index } : current))}
            onClose={() => setLightbox(null)}
            user={user}
            onRequireSignIn={() => {
              setLightbox(null);
              openAuth('signin');
            }}
            onBookSimilar={(serviceId) => {
              setProfile({ open: false });
              goToBooking(serviceId);
            }}
          />
        )}
        {success && (
          <SuccessModal
            booking={success}
            onClose={() => setSuccess(null)}
            onViewBookings={() => {
              setSuccess(null);
              setProfile({ open: true, tab: 'bookings' });
            }}
          />
        )}
        {auth.open && <Auth isOpen defaultView={auth.view} onClose={() => setAuth((current) => ({ ...current, open: false }))} onSuccess={handleAuthSuccess} />}
        {profile.open && user.role !== 'guest' && (
          <UserProfile
            isOpen
            initialTab={profile.tab}
            user={user}
            catalog={portfolio}
            onClose={() => setProfile({ open: false })}
            onLogout={handleLogout}
            onUpdateUser={setUser}
            onBook={() => goToBooking()}
            onOpenGallery={(items, index) => setLightbox({ items, index })}
          />
        )}
        {adminOpen && isTeam && <AdminDashboard user={user} onClose={() => setAdminOpen(false)} onPortfolioUpdated={loadPortfolio} onLogout={handleLogout} />}
      </Suspense>

      <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ duration: 4500 }} />
    </div>
  );
}

export default function App() {
  if (window.location.pathname === '/reset-password') {
    return (
      <Suspense fallback={null}>
        <ResetPasswordPage />
      </Suspense>
    );
  }
  return <Site />;
}
