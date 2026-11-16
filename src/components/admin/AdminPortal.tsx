import '../../styles/studio-operations.css';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, Camera, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Toaster } from 'sonner';
import logo from '../../assets/logo-160.png';
import { DEFAULT_PORTFOLIO } from '../../content/portfolio';
import { ConfirmHost } from '../../lib/confirm';
import { parseRoute } from '../../lib/routes';
import { isTeamRole, resolveSessionUser, type SessionUser } from '../../lib/session';
import { appFetch, isDemoMode, supabase } from '../../lib/supabase';
import StudioMfa from './StudioMfa';

const Dashboard = lazy(() => import('./AdminDashboard'));

const LOGIN = '/admin/login';
const WIDE = '(min-width: 761px)';
/** Shown instead of the photo on phones, so the large image is never downloaded there. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const safeNext = (value: string | null) => (value?.startsWith('/admin/') && !/[?\\#]/.test(value) && parseRoute(value)?.view === 'admin' ? value : '/admin/overview');

type FieldErrors = { email?: string; password?: string };

export default function AdminPortal() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [path, setPath] = useState(window.location.pathname);
  const [routeRevision, setRouteRevision] = useState(0);
  const checkRunning = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const route = parseRoute(path);
  const next = useRef(safeNext(path === LOGIN ? new URLSearchParams(location.search).get('next') : path));
  const photo = DEFAULT_PORTFOLIO.find((item) => item.id === 'bgc-series-2') || DEFAULT_PORTFOLIO[0];

  const navigate = useCallback((url: string, replace = false) => {
    if (location.pathname + location.search !== url) window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
    setPath(new URL(url, location.origin).pathname);
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    try {
      await supabase.rpc('studio_end_admin_session');
    } finally {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      navigate(LOGIN, true);
    }
  }, [navigate]);

  const check = useCallback(async () => {
    if (checkRunning.current) return;
    checkRunning.current = true;
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        setNeedsMfa(false);
        setUser(null);
        setCheckError(false);
        return;
      }
      const { data: allowed, error: permissionError } = await supabase.rpc('is_studio_team');
      if (permissionError) throw permissionError;
      if (!allowed) {
        const { data: entry, error: entryError } = await supabase.rpc('studio_mfa_entry');
        if (entryError) throw entryError;
        if (entry) {
          setNeedsMfa(true);
          setUser(null);
          setCheckError(false);
          return;
        }
        await signOut();
        setError('Your session has ended. Please sign in again.');
        return;
      }
      const profile = await resolveSessionUser(session.user);
      if (!isTeamRole(profile.role)) {
        await signOut();
        return;
      }
      setNeedsMfa(false);
      setUser(profile);
      setCheckError(false);
    } catch {
      setCheckError(true);
      setUser(null);
    } finally {
      checkRunning.current = false;
      setChecking(false);
    }
  }, [signOut]);

  useEffect(() => {
    document.documentElement.dataset.studioWorkspace = 'true';
    document.title = 'Studio workspace · Tutok Pitik Studios';
    void check();
    const timer = window.setInterval(() => {
      if (!document.hidden) void check();
    }, 60_000);
    const focus = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener('visibilitychange', focus);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') window.setTimeout(() => void check(), 0);
    });
    const pop = () => {
      setPath(location.pathname);
      setRouteRevision((n) => n + 1);
    };
    window.addEventListener('popstate', pop);
    return () => {
      delete document.documentElement.dataset.studioWorkspace;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', focus);
      subscription.unsubscribe();
      window.removeEventListener('popstate', pop);
    };
  }, [check]);

  useEffect(() => {
    if (checking || checkError) return;
    if (user && path === LOGIN) navigate(next.current, true);
    if (!user && path !== LOGIN) navigate(`${LOGIN}?next=${encodeURIComponent(safeNext(path))}`, true);
  }, [user, checking, checkError, path, navigate]);

  const trackCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.('CapsLock') === true);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    const problems: FieldErrors = {};
    if (!email.trim()) problems.email = 'Enter your work email.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) problems.email = 'Enter a valid email address, like you@studio.com.';
    if (!password) problems.password = 'Enter your password.';
    setFieldErrors(problems);
    if (problems.email) return emailRef.current?.focus();
    if (problems.password) return passwordRef.current?.focus();

    setBusy(true);
    try {
      const response = await appFetch(`${location.origin}/.netlify/functions/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'We couldn’t sign you in with these details.');
      const { error: sessionError } = await supabase.auth.setSession(result);
      if (sessionError) throw sessionError;
      setPassword('');
      await check();
    } catch (err) {
      const timedOut = err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
      setError(timedOut ? 'The sign-in took too long. Check your connection and try again.' : err instanceof Error ? err.message : 'We couldn’t sign you in. Please try again.');
      passwordRef.current?.select();
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <main className="admin-loading" role="status">
        <img className="admin-loading-logo" src={logo} alt="" />
        <span>
          <LoaderCircle className="spin" size={18} aria-hidden="true" /> Opening your studio workspace…
        </span>
      </main>
    );
  }

  if (checkError) {
    return (
      <main className="admin-loading">
        <section className="studio-auth-card">
          <img className="admin-loading-logo" src={logo} alt="" />
          <ShieldCheck size={28} aria-hidden="true" />
          <h1>We couldn’t check your session</h1>
          <p>This is usually a brief connection problem. Check your internet connection, then try again.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => void check()}>
            Try again
          </button>
          <a className="studio-auth-link" href={LOGIN} onClick={() => void supabase.auth.signOut({ scope: 'local' })}>
            Return to sign in
          </a>
        </section>
      </main>
    );
  }

  if (needsMfa) {
    return (
      <StudioMfa
        onVerified={() => void check()}
        onExit={() => {
          setNeedsMfa(false);
          void signOut();
        }}
      />
    );
  }

  if (user) {
    return (
      <div className="admin-portal">
        {isDemoMode && <div className="demo-banner">Local preview · fictional studio data</div>}
        <Suspense
          fallback={
            <main className="admin-loading" role="status">
              <LoaderCircle className="spin" size={18} aria-hidden="true" /> Loading workspace…
            </main>
          }
        >
          <Dashboard
            key={`${user.role}-${routeRevision}`}
            user={user}
            initialTab={route?.view === 'admin' ? route.tab : undefined}
            initialBookingId={route?.view === 'admin' ? route.bookingId : undefined}
            onClose={() => window.location.assign('/')}
            onLogout={signOut}
            onLocationChange={(tab, id) => navigate(id ? `/admin/bookings/${encodeURIComponent(id)}` : `/admin/${tab}`, true)}
          />
        </Suspense>
        <ConfirmHost />
        <Toaster theme="light" position="top-right" richColors closeButton />
      </div>
    );
  }

  return (
    <main className="studio-login">
      <section className="studio-login-photo" aria-hidden="true">
        <picture>
          {photo.largeAvif && <source media={WIDE} srcSet={photo.largeAvif} type="image/avif" />}
          <source media={WIDE} srcSet={photo.src} type="image/jpeg" />
          <img src={BLANK} alt="" decoding="async" />
        </picture>
        <a href="/" className="studio-login-brand" tabIndex={-1}>
          <img src={logo} alt="" />
          <span>
            Tutok Pitik
            <br />
            <b>Studios</b>
          </span>
        </a>
        <div className="studio-login-story">
          <span className="studio-eyebrow">Behind every great session</span>
          <p className="studio-login-headline">
            A little more focus.
            <br />A lot more possibility.
          </p>
          <p>Your bookings, your people and your next great shoot, all in one place.</p>
          <span className="studio-photo-credit">
            <Camera size={15} aria-hidden="true" /> {photo.title} · Tutok Pitik Studios
          </span>
        </div>
      </section>

      <section className="studio-login-panel">
        <div className="studio-login-top">
          <a className="studio-login-mobile-brand" href="/">
            <img src={logo} alt="" />
            <span>Tutok Pitik Studios</span>
          </a>
          <a className="studio-back" href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to website
          </a>
        </div>

        <div className="studio-login-form">
          <span className="studio-login-symbol" aria-hidden="true">
            <Camera size={24} />
          </span>
          <p className="studio-eyebrow">Studio workspace</p>
          <h1>Welcome back.</h1>
          <p className="studio-login-intro">Sign in with your studio team account.</p>

          <form onSubmit={submit} noValidate>
            {error && (
              <div className="notice notice-danger" role="alert">
                {error}
              </div>
            )}
            <div className="field">
              <label htmlFor="team-email">Work email</label>
              <input
                ref={emailRef}
                id="team-email"
                autoComplete="username"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@studio.com"
                value={email}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'team-email-error' : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                }}
              />
              {fieldErrors.email && (
                <p className="field-error" id="team-email-error">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="field">
              <div className="studio-password-label">
                <label htmlFor="team-password">Password</label>
                <button type="button" className="studio-link-btn" aria-expanded={helpOpen} aria-controls="team-reset-help" onClick={() => setHelpOpen((open) => !open)}>
                  Forgot password?
                </button>
              </div>
              <div className="input-affix">
                <input
                  ref={passwordRef}
                  id="team-password"
                  autoComplete="current-password"
                  type={visible ? 'text' : 'password'}
                  value={password}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={[fieldErrors.password ? 'team-password-error' : '', capsLock ? 'team-caps' : ''].filter(Boolean).join(' ') || undefined}
                  onKeyDown={trackCaps}
                  onKeyUp={trackCaps}
                  onBlur={() => setCapsLock(false)}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
                  }}
                />
                <button type="button" className="affix-btn" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {capsLock && (
                <p className="field-hint studio-caps" id="team-caps">
                  <KeyRound size={14} aria-hidden="true" /> Caps Lock is on
                </p>
              )}
              {fieldErrors.password && (
                <p className="field-error" id="team-password-error">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {helpOpen && (
              <div className="studio-reset-help" id="team-reset-help">
                <strong>Resetting a team password</strong>
                <p>For security, team passwords can’t be reset from this page. Ask a super admin to send you a reset link from Accounts &amp; roles in the workspace.</p>
                <p>If you are the only super admin, contact the verified project owner or another super admin for help.</p>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block studio-login-submit" disabled={busy}>
              {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="studio-access-note">
            <LockKeyhole size={16} aria-hidden="true" /> Only authorized studio team members can sign in. After your password you may be asked for a code from your authenticator app.
          </p>
          {isDemoMode && <p className="notice">Local preview only · superadmin@demo.test / admin@demo.test / staff@demo.test · password demo1234</p>}
        </div>

        <footer className="studio-login-footer">
          <span>© {new Date().getFullYear()} Tutok Pitik Studios</span>
          <a href="/privacy">Privacy notice</a>
        </footer>
      </section>
    </main>
  );
}
