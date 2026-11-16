import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { AtSign, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, MailCheck, Smartphone, UserRound } from 'lucide-react';
import Modal from './common/Modal';
import logoImage from '../assets/logo-160.png';
import { DEFAULT_PORTFOLIO } from '../content/portfolio';
import { STUDIO } from '../content/site';
import { getRememberMePreference, setRememberMePreference, supabase } from '../lib/supabase';
import { prepareGoogleSignIn } from '../lib/google-auth';
import { PolicyContent, POLICY_VERSION } from './PolicyPage';
import PrivacyHighlight from './PrivacyHighlight';
import { resolveSessionUser, type SessionUser } from '../lib/session';
import { errorMessage } from '../lib/api';

export type AuthView = 'signin' | 'signup' | 'forgot';

interface AuthProps {
  isOpen: boolean;
  defaultView?: AuthView;
  onClose: () => void;
  onSuccess: (user: SessionUser) => void;
  bookingIntent?: boolean;
}

type Stage = AuthView | 'forgot-sent' | 'signup-done';

const EMPTY = { firstName: '', lastName: '', username: '', email: '', phone: '', password: '', confirmPassword: '' };

const friendlyAuthError = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login')) return 'That email and password do not match. Check for typos or reset your password.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox (and spam folder) for the link we sent.';
  if (lower.includes('already registered') || lower.includes('already exists')) return 'An account with this email already exists. Try signing in instead.';
  if (lower.includes('failed to fetch') || lower.includes('network')) return 'We could not reach the server. Check your connection and try again.';
  return message;
};

/** A labelled input with a leading icon; the input itself is passed as children. */
function AuthField({ id, label, icon, error, className = '', children }: { id: string; label: ReactNode; icon: ReactNode; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="input-icon">
        {icon}
        {children}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, error, hint }: { id: string; label: ReactNode; value: string; onChange: (value: string) => void; autoComplete: string; error?: string; hint?: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-icon input-affix">
        <LockKeyhole size={18} aria-hidden="true" />
        <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} />
        <button type="button" className="affix-btn" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** Google's "G" mark, as required next to Google sign-in buttons. */
const GoogleMark = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.89 46.98 24.55Z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.79-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
  </svg>
);

// Studio photos for the sheet's picture panel: one for signing in, one for joining.
const AUTH_PHOTOS = {
  signin: DEFAULT_PORTFOLIO.find((item) => item.id === 'bgc-series-2'),
  signup: DEFAULT_PORTFOLIO.find((item) => item.id === 'blooms-in-blue'),
};
type PhotoKey = keyof typeof AUTH_PHOTOS;
const PHOTO_SIZES = '(min-width: 900px) 400px, 320px';

export default function Auth({ isOpen, defaultView = 'signin', onClose, onSuccess, bookingIntent = false }: AuthProps) {
  const [stage, setStage] = useState<Stage>(defaultView);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(getRememberMePreference);
  const [agreed, setAgreed] = useState(false);
  const [googleReview, setGoogleReview] = useState(false);
  const [googleAgreed, setGoogleAgreed] = useState(false);
  const [policy, setPolicy] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStage(defaultView);
    setErrors({});
    setLoading(false);
    setAgreed(false);
    setGoogleReview(false);
    setGoogleAgreed(false);
    setPolicy(null);
    setForm((current) => ({ ...EMPTY, email: current.email }));
  }, [isOpen, defaultView]);

  const set = (key: keyof typeof EMPTY) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '', general: '' }));
  };

  const emailValid = /^\S+@\S+\.\S+$/.test(form.email.trim());

  const googleSignIn = () => {
    if (loading || !googleAgreed) return;
    setLoading(true);
    setErrors({});
    try { prepareGoogleSignIn(remember, bookingIntent); }
    catch {
      setLoading(false);
      setErrors({ general: 'Please allow browser storage for secure Google sign-in, or sign in with your email.' });
    }
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!emailValid) next.email = 'Enter a valid email address.';
    if (!form.password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length || loading) return;

    setLoading(true);
    try {
      setRememberMePreference(remember);
      const { data, error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
      if (error) throw error;
      if (data.user) onSuccess(await resolveSessionUser(data.user));
      onClose();
    } catch (error) {
      setErrors({ general: friendlyAuthError(errorMessage(error)) });
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'Required.';
    if (!form.lastName.trim()) next.lastName = 'Required.';
    if (form.username.trim().length < 3) next.username = 'At least 3 characters.';
    else if (!/^[a-z0-9._-]+$/i.test(form.username.trim())) next.username = 'Letters, numbers, dots, dashes or underscores only.';
    if (!emailValid) next.email = 'Enter a valid email address.';
    if (form.phone && form.phone.replace(/\D/g, '').length < 10) next.phone = 'Enter a full mobile number or leave it blank.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    if (!agreed) next.agreed = 'Please agree to the Terms and acknowledge the Data Privacy Notice.';
    setErrors(next);
    if (Object.keys(next).length || loading) return;

    setLoading(true);
    try {
      setRememberMePreference(remember);
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
            username: form.username.trim(),
            phone: form.phone.trim() || undefined,
          },
        },
      });
      if (error) throw error;
      if (data.session && data.user) {
        onSuccess(await resolveSessionUser(data.user));
        onClose();
        return;
      }
      setStage('signup-done');
    } catch (error) {
      setErrors({ general: friendlyAuthError(errorMessage(error)) });
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailValid) {
      setErrors({ email: 'Enter the email you signed up with.' });
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      setStage('forgot-sent');
    } catch (error) {
      setErrors({ general: friendlyAuthError(errorMessage(error)) });
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Stage, { title: string; description: string; icon: ReactNode }> = {
    signin: { title: 'Welcome back', description: 'Sign in to book, track your bookings and see your photos.', icon: null },
    signup: { title: 'Create your account', description: `It is free and keeps your bookings, receipts and photo links in one place.`, icon: null },
    forgot: { title: 'Reset your password', description: 'Enter your email and we will send you a secure link to set a new password.', icon: <KeyRound size={22} /> },
    'forgot-sent': { title: 'Check your email', description: `If an account exists for ${form.email}, a reset link is on its way. It may take a minute; check spam too.`, icon: <MailCheck size={22} /> },
    'signup-done': { title: 'Confirm your email', description: `We sent a confirmation link to ${form.email}. Click it, then sign in to continue your booking.`, icon: <MailCheck size={22} /> },
  };
  const heading = titles[stage];
  const headingId = useId();
  const photoKey: PhotoKey = stage === 'signup' || stage === 'signup-done' ? 'signup' : 'signin';
  const description = bookingIntent && (stage === 'signin' || stage === 'signup')
    ? 'Your booking details are saved. Sign in or create a free account to pay the downpayment and lock in your date.'
    : heading.description;
  const rememberToggle = (
    <label className="checkbox auth-remember">
      <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
      <span>Keep me signed in</span>
    </label>
  );
  const submitLabel = (label: string) => (
    <>
      {loading && <LoaderCircle size={18} className="spin" />}
      {loading ? 'Please wait…' : label}
    </>
  );

  return (
    <>
      <Modal open={isOpen} onClose={onClose} size="xl" className={`auth-modal auth-stage-${stage}`} labelledBy={headingId} dismissible={!loading}>
        <div className="auth-shell">
          <div className="auth-visual" aria-hidden="true">
            {(Object.keys(AUTH_PHOTOS) as PhotoKey[]).map((key) => {
              const photo = AUTH_PHOTOS[key];
              if (!photo) return null;
              return (
                <picture key={key} className={`auth-visual-photo${key === photoKey ? ' is-active' : ''}`}>
                  {photo.largeAvif && <source type="image/avif" srcSet={`${photo.thumbAvif} 640w, ${photo.largeAvif} 1800w`} sizes={PHOTO_SIZES} />}
                  <img src={photo.thumb} srcSet={`${photo.thumb} 640w, ${photo.src} 1800w`} sizes={PHOTO_SIZES} alt="" decoding="async" />
                </picture>
              );
            })}
            <span className="auth-visual-shade" />
            <img className="auth-visual-logo" src={logoImage} alt="" width={56} height={56} />
          </div>

          <header className="auth-head" key={`head-${stage}`}>
            {heading.icon && <span className="auth-head-icon">{heading.icon}</span>}
            <p className="auth-eyebrow">{STUDIO.name}</p>
            <h2 id={headingId}>{heading.title}</h2>
            <p className="auth-lead">{description}</p>
            {/* Wide screens show the privacy note here, beside the form; phones show it below the form. */}
            {(stage === 'signin' || stage === 'signup') && <PrivacyHighlight compact onRead={() => setPolicy('privacy')} />}
          </header>

          <div className="auth-main">
            <div className="auth-main-inner">
              {(stage === 'signin' || stage === 'signup') && (
                <div className="auth-tabs" role="tablist" aria-label="Account" data-active={stage}>
                  <button type="button" role="tab" aria-selected={stage === 'signin'} className={stage === 'signin' ? 'is-active' : ''} onClick={() => { setStage('signin'); setErrors({}); }}>
                    Sign in
                  </button>
                  <button type="button" role="tab" aria-selected={stage === 'signup'} className={stage === 'signup' ? 'is-active' : ''} onClick={() => { setStage('signup'); setErrors({}); }}>
                    Create account
                  </button>
                </div>
              )}

              <div className="auth-pane" key={stage}>
                {errors.general && <div className="notice notice-danger" role="alert"><p>{errors.general}</p></div>}

                {(stage === 'signin' || stage === 'signup') && <div className="google-auth-options">
                  <button type="button" className="google-signin-button" disabled={loading} onClick={() => { setGoogleAgreed(false); setGoogleReview(true); }}>
                    <GoogleMark />
                    {loading ? 'Please wait…' : 'Continue with Google'}
                  </button>
                  <p className="google-auth-notice">Uses Google’s own screen. We only receive your basic profile and email.</p>
                  <div className="auth-divider"><span>or use your email</span></div>
                </div>}

                {stage === 'signin' && (
                  <form className="auth-form" onSubmit={signIn} noValidate>
                    <AuthField id="auth-email" label="Email" icon={<Mail size={18} aria-hidden="true" />} error={errors.email}>
                      <input id="auth-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={form.email} onChange={(event) => set('email')(event.target.value)} aria-invalid={Boolean(errors.email)} data-autofocus />
                    </AuthField>
                    <PasswordField id="auth-password" label="Password" value={form.password} onChange={set('password')} autoComplete="current-password" error={errors.password} />
                    <div className="auth-row">
                      {rememberToggle}
                      <button type="button" className="btn-link" onClick={() => { setStage('forgot'); setErrors({}); }}>
                        Forgot password?
                      </button>
                    </div>
                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                      {submitLabel('Sign in')}
                    </button>
                  </form>
                )}

                {stage === 'signup' && (
                  <form className="auth-form auth-form-signup" onSubmit={signUp} noValidate>
                    <div className="field-row auth-pair auth-pair-names">
                      <AuthField id="auth-first" label="First name" icon={<UserRound size={18} aria-hidden="true" />} error={errors.firstName}>
                        <input id="auth-first" type="text" autoComplete="given-name" value={form.firstName} onChange={(event) => set('firstName')(event.target.value)} aria-invalid={Boolean(errors.firstName)} data-autofocus />
                      </AuthField>
                      <AuthField id="auth-last" label="Last name" icon={<UserRound size={18} aria-hidden="true" />} error={errors.lastName}>
                        <input id="auth-last" type="text" autoComplete="family-name" value={form.lastName} onChange={(event) => set('lastName')(event.target.value)} aria-invalid={Boolean(errors.lastName)} />
                      </AuthField>
                    </div>
                    <div className="field-row auth-pair">
                      <AuthField id="auth-signup-email" label="Email" icon={<Mail size={18} aria-hidden="true" />} error={errors.email}>
                        <input id="auth-signup-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => set('email')(event.target.value)} aria-invalid={Boolean(errors.email)} />
                      </AuthField>
                      <AuthField id="auth-username" label="Username" icon={<AtSign size={18} aria-hidden="true" />} error={errors.username}>
                        <input id="auth-username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={form.username} onChange={(event) => set('username')(event.target.value)} aria-invalid={Boolean(errors.username)} />
                      </AuthField>
                    </div>
                    <AuthField id="auth-phone" label={<>Mobile number <span className="optional">(optional, needed to book)</span></>} icon={<Smartphone size={18} aria-hidden="true" />} error={errors.phone}>
                      <input id="auth-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" value={form.phone} onChange={(event) => set('phone')(event.target.value)} aria-invalid={Boolean(errors.phone)} />
                    </AuthField>
                    <div className="field-row auth-pair">
                      <PasswordField id="auth-new-password" label={<>Password <span className="optional">(8+ characters)</span></>} value={form.password} onChange={set('password')} autoComplete="new-password" error={errors.password} />
                      <PasswordField id="auth-confirm-password" label="Confirm password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" error={errors.confirmPassword} />
                    </div>
                    <div className="auth-row">{rememberToggle}</div>
                    <label className="checkbox checkbox-block agreement-box">
                      <input type="checkbox" aria-describedby="signup-agreement-help" aria-invalid={Boolean(errors.agreed)} checked={agreed} onChange={(event) => { setAgreed(event.target.checked); setErrors((current) => ({ ...current, agreed: '' })); }} />
                      <span>
                        I agree to the{' '}
                        <button type="button" className="btn-link" onClick={() => setPolicy('terms')}>Terms and Conditions</button> and acknowledge that I have read the{' '}
                        <button type="button" className="btn-link" onClick={() => setPolicy('privacy')}>Data Privacy Notice (RA 10173)</button>.
                      </span>
                    </label>
                    <p id="signup-agreement-help" className="agreement-help">For your account and booking services. This does not authorize marketing or public use of your photos.</p>
                    {errors.agreed && <p className="field-error">{errors.agreed}</p>}
                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                      {submitLabel('Create account')}
                    </button>
                  </form>
                )}

                {stage === 'forgot' && (
                  <form className="auth-form" onSubmit={sendReset} noValidate>
                    <AuthField id="auth-reset-email" label="Email" icon={<Mail size={18} aria-hidden="true" />} error={errors.email}>
                      <input id="auth-reset-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => set('email')(event.target.value)} aria-invalid={Boolean(errors.email)} data-autofocus />
                    </AuthField>
                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                      {submitLabel('Send reset link')}
                    </button>
                    <button type="button" className="btn btn-ghost btn-block" onClick={() => { setStage('signin'); setErrors({}); }}>
                      Back to sign in
                    </button>
                  </form>
                )}

                {(stage === 'signin' || stage === 'signup') && <PrivacyHighlight compact onRead={() => setPolicy('privacy')} />}

                {(stage === 'forgot-sent' || stage === 'signup-done') && (
                  <div className="auth-form">
                    <button type="button" className="btn btn-primary btn-block" onClick={() => { setStage('signin'); setErrors({}); }} data-autofocus>
                      Go to sign in
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={googleReview}
        onClose={() => setGoogleReview(false)}
        size="sm"
        className="auth-google-modal"
        icon={<GoogleMark size={22} />}
        title="Before you continue with Google"
        description="Review how your account and information will be handled."
        dismissible={!loading}
        footer={<><button type="button" className="btn btn-ghost" disabled={loading} onClick={() => setGoogleReview(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={!googleAgreed || loading} onClick={googleSignIn}>{loading ? 'Please wait…' : 'Continue to Google'}</button></>}
      >
        <PrivacyHighlight compact onRead={() => setPolicy('privacy')} />
        <div className="auth-row auth-row-google">{rememberToggle}</div>
        <label className="checkbox checkbox-block agreement-box">
          <input type="checkbox" checked={googleAgreed} aria-describedby="google-agreement-help" onChange={(event) => setGoogleAgreed(event.target.checked)} />
          <span>I agree to the <button type="button" className="btn-link" onClick={() => setPolicy('terms')}>Terms and Conditions</button> and acknowledge that I have read the <button type="button" className="btn-link" onClick={() => setPolicy('privacy')}>Data Privacy Notice (RA 10173)</button>.</span>
        </label>
        <p id="google-agreement-help" className="agreement-help">This does not authorize marketing or public use of your photos. Google sign-in shares your basic profile and email; it does not give us your Google password or access to your messages.</p>
        {errors.general && <p className="field-error" role="alert">{errors.general}</p>}
      </Modal>

      <Modal
        open={policy !== null}
        onClose={() => setPolicy(null)}
        size="lg"
        className="policy-modal"
        description={`Updated November 16, 2026 · Version ${POLICY_VERSION}`}
        title={policy === 'terms' ? 'Terms and Conditions' : 'Data Privacy Notice'}
        footer={<><a className="btn btn-ghost" href={policy === 'terms' ? '/terms' : '/privacy'} target="_blank" rel="noopener noreferrer">Open full page<span className="sr-only"> (opens in a new tab)</span></a><button type="button" className="btn btn-primary" onClick={() => setPolicy(null)}>Close notice</button></>}
      >
        {policy && <PolicyContent type={policy} />}
      </Modal>
    </>
  );
}
