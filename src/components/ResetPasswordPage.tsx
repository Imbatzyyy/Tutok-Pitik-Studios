import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CircleCheck, KeyRound, LoaderCircle } from 'lucide-react';
import logoImage from '../assets/logo-160.png';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/api';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'success'>('checking');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasRecoveryHash = useMemo(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return hash.get('type') === 'recovery' || hash.has('access_token');
  }, []);

  useEffect(() => {
    document.title = 'Reset password · Tutok Pitik Studios';
    supabase.auth.getSession().then(({ data: { session } }) => setStatus(session || hasRecoveryHash ? 'ready' : 'invalid'));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setStatus('ready');
        setError('');
      }
    });
    return () => subscription.unsubscribe();
  }, [hasRecoveryHash]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus('success');
      window.history.replaceState({}, document.title, '/reset-password');
    } catch (err) {
      setError(errorMessage(err, 'Unable to reset password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="reset-page">
      <div className="ui-modal ui-modal-sm reset-card">
        <img src={logoImage} alt="Tutok Pitik Studios" width={64} height={64} className="reset-logo" />
        <header className="ui-modal-header">
          <div className="ui-modal-icon">{status === 'success' ? <CircleCheck size={22} /> : <KeyRound size={22} />}</div>
          <div className="ui-modal-heading">
            <h1>{status === 'success' ? 'Password updated' : 'Set a new password'}</h1>
            <p>{status === 'success' ? 'You can now sign in with your new password.' : 'Choose a new password for your account.'}</p>
          </div>
        </header>
        <div className="ui-modal-body">
          {status === 'checking' && <div className="loading-row"><LoaderCircle size={18} className="spin" /> Checking your link…</div>}
          {status === 'invalid' && <div className="notice notice-danger"><p>This reset link is invalid or has expired. Request a new one from the sign-in window.</p></div>}
          {status === 'ready' && (
            <form className="auth-form" onSubmit={submit} noValidate>
              {error && <div className="notice notice-danger" role="alert"><p>{error}</p></div>}
              <div className="field">
                <label htmlFor="reset-password">New password</label>
                <input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
                <p className="field-hint">At least 8 characters.</p>
              </div>
              <div className="field">
                <label htmlFor="reset-confirm">Confirm new password</label>
                <input id="reset-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting && <LoaderCircle size={16} className="spin" />} Update password
              </button>
            </form>
          )}
          <a className="btn btn-ghost btn-block reset-home" href="/">
            <ArrowLeft size={16} /> Back to the website
          </a>
        </div>
      </div>
    </main>
  );
}
