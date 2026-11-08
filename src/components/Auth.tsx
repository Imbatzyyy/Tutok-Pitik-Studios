import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Camera, Eye, EyeOff, KeyRound, LoaderCircle, MailCheck } from 'lucide-react';
import Modal from './common/Modal';
import { setRememberMePreference, supabase } from '../lib/supabase';
import { resolveSessionUser, type SessionUser } from '../lib/session';
import { errorMessage } from '../lib/api';
import { STUDIO } from '../content/site';

export type AuthView = 'signin' | 'signup' | 'forgot';

interface AuthProps {
  isOpen: boolean;
  defaultView?: AuthView;
  onClose: () => void;
  onSuccess: (user: SessionUser) => void;
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

function PasswordField({ id, label, value, onChange, autoComplete, error, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; error?: string; hint?: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-affix">
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

export default function Auth({ isOpen, defaultView = 'signin', onClose, onSuccess }: AuthProps) {
  const [stage, setStage] = useState<Stage>(defaultView);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [policy, setPolicy] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStage(defaultView);
    setErrors({});
    setLoading(false);
    setAgreed(false);
    setForm((current) => ({ ...EMPTY, email: current.email }));
  }, [isOpen, defaultView]);

  const set = (key: keyof typeof EMPTY) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '', general: '' }));
  };

  const emailValid = /^\S+@\S+\.\S+$/.test(form.email.trim());

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
    if (!agreed) next.agreed = 'Please agree to the Terms and Data Privacy Notice.';
    setErrors(next);
    if (Object.keys(next).length || loading) return;

    setLoading(true);
    try {
      setRememberMePreference(true);
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
    signin: { title: 'Welcome back', description: 'Sign in to book, track your bookings and see your photos.', icon: <Camera size={22} /> },
    signup: { title: 'Create your account', description: `It is free and keeps your bookings, receipts and photo links in one place.`, icon: <Camera size={22} /> },
    forgot: { title: 'Reset your password', description: 'Enter your email and we will send you a secure link to set a new password.', icon: <KeyRound size={22} /> },
    'forgot-sent': { title: 'Check your email', description: `If an account exists for ${form.email}, a reset link is on its way. It may take a minute; check spam too.`, icon: <MailCheck size={22} /> },
    'signup-done': { title: 'Confirm your email', description: `We sent a confirmation link to ${form.email}. Click it, then sign in to continue your booking.`, icon: <MailCheck size={22} /> },
  };
  const heading = titles[stage];
  const submitLabel = (label: string) => (
    <>
      {loading && <LoaderCircle size={18} className="spin" />}
      {loading ? 'Please wait…' : label}
    </>
  );

  return (
    <>
      <Modal open={isOpen} onClose={onClose} size="sm" className="auth-modal" icon={heading.icon} title={heading.title} description={heading.description} dismissible={!loading}>
        {(stage === 'signin' || stage === 'signup') && (
          <div className="auth-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={stage === 'signin'} className={stage === 'signin' ? 'is-active' : ''} onClick={() => { setStage('signin'); setErrors({}); }}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={stage === 'signup'} className={stage === 'signup' ? 'is-active' : ''} onClick={() => { setStage('signup'); setErrors({}); }}>
              Create account
            </button>
          </div>
        )}

        {errors.general && <div className="notice notice-danger" role="alert"><p>{errors.general}</p></div>}

        {stage === 'signin' && (
          <form className="auth-form" onSubmit={signIn} noValidate>
            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(event) => set('email')(event.target.value)} aria-invalid={Boolean(errors.email)} data-autofocus />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>
            <PasswordField id="auth-password" label="Password" value={form.password} onChange={set('password')} autoComplete="current-password" error={errors.password} />
            <div className="auth-row">
              <label className="checkbox">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span>Keep me signed in</span>
              </label>
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
          <form className="auth-form" onSubmit={signUp} noValidate>
            <div className="field-row">
              <div className="field">
                <label htmlFor="auth-first">First name</label>
                <input id="auth-first" autoComplete="given-name" value={form.firstName} onChange={(event) => set('firstName')(event.target.value)} aria-invalid={Boolean(errors.firstName)} data-autofocus />
                {errors.firstName && <p className="field-error">{errors.firstName}</p>}
              </div>
              <div className="field">
                <label htmlFor="auth-last">Last name</label>
                <input id="auth-last" autoComplete="family-name" value={form.lastName} onChange={(event) => set('lastName')(event.target.value)} aria-invalid={Boolean(errors.lastName)} />
                {errors.lastName && <p className="field-error">{errors.lastName}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="auth-username">Username</label>
              <input id="auth-username" autoComplete="username" value={form.username} onChange={(event) => set('username')(event.target.value)} aria-invalid={Boolean(errors.username)} />
              {errors.username && <p className="field-error">{errors.username}</p>}
            </div>
            <div className="field">
              <label htmlFor="auth-signup-email">Email</label>
              <input id="auth-signup-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => set('email')(event.target.value)} aria-invalid={Boolean(errors.email)} />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>
            <div className="field">
              <label htmlFor="auth-phone">
                Mobile number <span className="optional">(optional, needed to book)</span>
              </label>
              <input id="auth-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" value={form.phone} onChange={(event) => set('phone')(event.target.value)} aria-invalid={Boolean(errors.phone)} />
              {errors.phone && <p className="field-error">{errors.phone}</p>}
            </div>
            <PasswordField id="auth-new-password" label="Password" value={form.password} onChange={set('password')} autoComplete="new-password" error={errors.password} hint="At least 8 characters." />
            <PasswordField id="auth-confirm-password" label="Confirm password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" error={errors.confirmPassword} />
            <label className="checkbox checkbox-block">
              <input type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); setErrors((current) => ({ ...current, agreed: '' })); }} />
              <span>
                I agree to the{' '}
                <button type="button" className="btn-link" onClick={() => setPolicy('terms')}>Terms and Conditions</button> and the{' '}
                <button type="button" className="btn-link" onClick={() => setPolicy('privacy')}>Data Privacy Notice</button>.
              </span>
            </label>
            {errors.agreed && <p className="field-error">{errors.agreed}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {submitLabel('Create account')}
            </button>
          </form>
        )}

        {stage === 'forgot' && (
          <form className="auth-form" onSubmit={sendReset} noValidate>
            <div className="field">
              <label htmlFor="auth-reset-email">Email</label>
              <input id="auth-reset-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => set('email')(event.target.value)} aria-invalid={Boolean(errors.email)} data-autofocus />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {submitLabel('Send reset link')}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => { setStage('signin'); setErrors({}); }}>
              Back to sign in
            </button>
          </form>
        )}

        {(stage === 'forgot-sent' || stage === 'signup-done') && (
          <div className="auth-form">
            <button type="button" className="btn btn-primary btn-block" onClick={() => { setStage('signin'); setErrors({}); }} data-autofocus>
              Go to sign in
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={policy !== null}
        onClose={() => setPolicy(null)}
        size="md"
        title={policy === 'terms' ? 'Terms and Conditions' : 'Data Privacy Notice'}
        footer={<button type="button" className="btn btn-primary" onClick={() => setPolicy(null)}>Close</button>}
      >
        {policy === 'terms' ? (
          <div className="policy-text">
            <p><strong>Account use.</strong> Use your account only for legitimate {STUDIO.name} services such as bookings, inquiries and profile management.</p>
            <p><strong>Accurate information.</strong> Provide true, complete and up-to-date details when you register and book.</p>
            <p><strong>Bookings.</strong> Bookings are subject to studio review, schedule availability, payment verification and service policies.</p>
            <p><strong>Your responsibility.</strong> Keep your login details secure. You are responsible for activity under your account.</p>
            <p><strong>Changes.</strong> {STUDIO.name} may update pricing, transportation fees and service requirements when necessary.</p>
          </div>
        ) : (
          <div className="policy-text">
            <p><strong>What we collect.</strong> Your name, email, mobile number, account details, booking information and files you upload, only as needed to deliver our services.</p>
            <p><strong>How we use it.</strong> Account creation, booking management, customer communication, payment review and service updates.</p>
            <p><strong>Protection.</strong> We take reasonable steps to keep your data secure and accessible only for legitimate business purposes.</p>
            <p><strong>Limited sharing.</strong> Your information is not shared unnecessarily and is only used for the services you requested.</p>
            <p><strong>Consent.</strong> By creating an account, you agree to the processing of your information for these purposes.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
