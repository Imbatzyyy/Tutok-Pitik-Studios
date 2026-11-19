import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import StatsBar from './components/StatsBar';
import Portfolio from './components/Portfolio';
import Services from './components/Services';
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
import { GUEST_USER, InactiveAccountError, resolveCustomerSession, type SessionUser } from './lib/session';
import { isDemoMode, supabase } from './lib/supabase';
import { clearBookingDrafts } from './lib/booking-hold';
import { clearBookingResume } from './lib/booking-resume';
import { findService } from './content/site';
import { askStudio } from './components/Inquiry';
import { HOME, parseRoute, type SiteRoute } from './lib/routes';
import NotFound from './components/NotFound';

const Auth = lazy(() => import('./components/Auth'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const AdminPortal = lazy(() => import('./components/admin/AdminPortal'));
const Lightbox = lazy(() => import('./components/Lightbox'));
const SuccessModal = lazy(() => import('./components/SuccessModal'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'));
const GoogleAuthPage = lazy(() => import('./components/GoogleAuthPage'));
const PolicyPage = lazy(() => import('./components/PolicyPage'));


function Site() {
  const [user, setUser] = useState<SessionUser>(GUEST_USER);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(DEFAULT_PORTFOLIO);
  const [lightbox, setLightbox] = useState<{ items: PortfolioItem[]; index: number } | null>(null);
  const [success, setSuccess] = useState<BookingSuccess | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [auth, setAuth] = useState<{ open: boolean; view: AuthView; intent?: 'booking' }>(() => ({ open: new URLSearchParams(window.location.search).get('signin') === '1', view: 'signin' }));
  const [route, setRoute] = useState<SiteRoute>(() => parseRoute(window.location.pathname) || HOME);
  const [prefill, setPrefill] = useState<BookingPrefill | null>(() => {
    const params=new URLSearchParams(location.search);
    const service=findService(params.get('service'));
    const hours=Number(params.get('hours'));
    return service ? {serviceId:service.id,hours:service.packages.some(p=>p.hours===hours)?hours:undefined,nonce:Date.now()} : null;
  });
  const availability = useAvailability();
  useEffect(()=>{
    if(!authReady)return;
    if(location.hash==='#ask-studio') askStudio(findService(new URLSearchParams(location.search).get('service'))?.id);
    else if(location.hash==='#contact' || location.hash==='#open-dates') scrollToSection(location.hash);
  },[authReady]);
  const routeRef = useRef(route);
  routeRef.current = route;
  const authSucceeded = useRef(false);
  const leaving = useRef(false);
  const afterLeave = useRef<(() => void) | null>(null);

  // ---- Customer account overlays ----

  /** Open an overlay as its own history entry, so Back closes it. */
  const openView = useCallback((path: string) => {
    window.history.pushState({ tps: true }, '', path);
    setRoute(parseRoute(path) || HOME);
  }, []);

  /** Mirror a tab change in the address bar without adding history entries. */
  const syncPath = useCallback((path: string) => {
    if (routeRef.current.view === 'home' || leaving.current || window.location.pathname === path) return;
    window.history.replaceState(window.history.state, '', path);
  }, []);

  /** Close the overlay and return to the page; `then` runs once the address is back to "/". */
  const leaveView = useCallback((then?: () => void) => {
    if (leaving.current) {
      if (then) afterLeave.current = then;
      return;
    }
    if (routeRef.current.view === 'home') {
      then?.();
      return;
    }
    setRoute(HOME);
    if (window.history.state?.tps) {
      leaving.current = true;
      afterLeave.current = then || null;
      window.history.back();
    } else {
      window.history.replaceState(null, '', '/');
      if (then) window.setTimeout(then, 0);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRoute(window.location.pathname) || HOME);
      leaving.current = false;
      const then = afterLeave.current;
      afterLeave.current = null;
      if (then) window.setTimeout(then, 50);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // ?signin=1 (from the Google error page) opens the sheet once; don't keep it in the address.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('signin')) return;
    url.searchParams.delete('signin');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

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
    let authRevision = 0;
    let previousCustomer = '';
    const apply = async (authUser: any) => {
      const revision = ++authRevision;
      try {
        const resolved = await resolveCustomerSession(authUser);
        if (!cancelled && authRevision === revision) {
          if (previousCustomer && previousCustomer !== resolved.id) { clearBookingDrafts(); setSuccess(null); }
          previousCustomer = resolved.role === 'customer' ? resolved.id : '';
          setUser(resolved);
        }
      } catch (error) {
        if (cancelled || authRevision !== revision) return;
        setUser(GUEST_USER);
        if (error instanceof InactiveAccountError) toast.error(error.message, { id: 'inactive-account' });
      }
    };

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) await apply(session.user);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') { ++authRevision; previousCustomer=''; setSuccess(null); clearBookingDrafts(); setUser(GUEST_USER); }
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

  // The booking form picks up at the payment step by itself (see Contact).
  const handleAuthSuccess = (nextUser: SessionUser) => {
    authSucceeded.current = true;
    setUser(nextUser);
    toast.success(`Welcome, ${nextUser.firstName || nextUser.fullName}!`);
  };

  const closeAuth = () => {
    setAuth((current) => ({ ...current, open: false }));
    if (authSucceeded.current) {
      authSucceeded.current = false;
      return;
    }
    if (auth.intent === 'booking') clearBookingResume();
    // Dismissed the sign-in that /account asked for: back to the page.
    if (routeRef.current.view !== 'home') leaveView();
  };

  const handleLogout = async () => {
    clearBookingDrafts();
    leaveView();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* sign out locally anyway */
    }
    setUser(GUEST_USER);
    toast('Signed out');
  };

  // Customer account overlays require a customer session.
  useEffect(() => {
    if (!authReady || route.view === 'home') return;
    if (user.role === 'guest') {
      setAuth((current) => (current.open ? current : { open: true, view: 'signin' }));

    }
  }, [authReady, route.view, user.role, leaveView]);

  return (
    <div className="App">
      <a className="skip-link" href="#contact">
        Skip to booking
      </a>
      {isDemoMode && <div className="demo-banner">Demo mode · local test data only</div>}

      <Navigation
        user={user}
        onOpenAuth={() => openAuth('signin')}
        onOpenProfile={() => openView('/account')}
        onBook={() => goToBooking()}
      />

      <main>
        <Hero nextOpenDate={nextOpenDate} onBook={() => scrollToSection('open-dates')} />
        <StatsBar />
        <Portfolio items={portfolio} onOpen={(items, index) => setLightbox({ items, index })} />
        <Services deliveryDays={availability.rules.delivery_days} items={portfolio} onBook={(serviceId, hours) => goToBooking(serviceId, hours)} />
        <Process onBook={() => goToBooking()} />
        <About />
        <Testimonials />
        <FAQ />
        {authReady && <Contact key={user.id}
          user={user}
          availability={availability}
          prefill={prefill}
          onPrefillUsed={()=>setPrefill(null)}
          onSuccess={setSuccess}
          onRequireAuth={(view) => openAuth(view, 'booking')}
          onUserUpdated={setUser}
        />}
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
              setLightbox(null);
              leaveView(() => goToBooking(serviceId));
            }}
          />
        )}
        {success && (
          <SuccessModal
            booking={success}
            onClose={() => setSuccess(null)}
            onViewBookings={() => {
              setSuccess(null);
              openView('/account/bookings');
            }}
          />
        )}
        {auth.open && <Auth isOpen defaultView={auth.view} bookingIntent={auth.intent === 'booking'} onClose={closeAuth} onSuccess={handleAuthSuccess} />}
        {route.view === 'account' && user.role !== 'guest' && (
          <UserProfile
            isOpen
            initialTab={route.tab as ProfileTab | undefined}
            user={user}
            catalog={portfolio}
            onClose={() => leaveView()}
            onLogout={handleLogout}
            onUpdateUser={setUser}
            onBook={() => leaveView(() => goToBooking())}
            onOpenGallery={(items, index) => setLightbox({ items, index })}
            onBrowsePortfolio={() => leaveView(() => scrollToSection('portfolio'))}
            onTabChange={(tab) => syncPath(`/account/${tab}`)}
          />
        )}

      </Suspense>

      <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ duration: 4500 }} />
    </div>
  );
}

export default function App() {
  if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')) {
    return <Suspense fallback={<main className="reset-page" role="status">Opening studio workspace…</main>}><AdminPortal /></Suspense>;
  }
  if (['/auth/google', '/auth/callback'].includes(window.location.pathname)) {
    return <Suspense fallback={<main className="reset-page" role="status">Loading secure sign-in…</main>}><GoogleAuthPage /></Suspense>;
  }
  if (['/privacy', '/terms'].includes(window.location.pathname.replace(/\/$/,''))) {
    return <Suspense fallback={null}><PolicyPage type={window.location.pathname.startsWith('/privacy') ? 'privacy' : 'terms'} /></Suspense>;
  }
  if (window.location.pathname === '/reset-password') {
    return (
      <Suspense fallback={null}>
        <ResetPasswordPage />
      </Suspense>
    );
  }
  if (!parseRoute(window.location.pathname)) return <NotFound />;
  return <Site />;
}
