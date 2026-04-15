import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'success'>('checking');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasRecoveryHash = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return hash.get('type') === 'recovery' || hash.has('access_token');
  }, []);

  useEffect(() => {
    const initializeRecovery = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session || hasRecoveryHash) {
        setStatus('ready');
      } else {
        setStatus('invalid');
      }
    };

    void initializeRecovery();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setStatus('ready');
        setError('');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [hasRecoveryHash]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      setStatus('success');
      setPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, document.title, '/reset-password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-overlay reset-password-page">
      <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
        <div className="auth-header">
          <div className="auth-icon">
            {status === 'success' ? <CheckCircle2 size={32} /> : <KeyRound size={32} />}
          </div>
          <h2>{status === 'success' ? 'Password Updated' : 'Reset Your Password'}</h2>
          <p>
            {status === 'success'
              ? 'Your password has been updated. You can return to the homepage and sign in with the new password.'
              : 'Create a new password for your account to finish the recovery process.'}
          </p>
        </div>

        {status === 'checking' && <div className="auth-success-banner">Checking your recovery link...</div>}

        {status === 'invalid' && (
          <div className="auth-error-banner">
            This recovery link is invalid or has expired. Please request a new password reset email.
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error-banner">{error}</div>}

            <div className="form-group">
              <label htmlFor="reset-password">
                <KeyRound size={18} />
                New Password
              </label>
              <input
                id="reset-password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your new password"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="reset-password-confirm">
                <KeyRound size={18} />
                Confirm Password
              </label>
              <input
                id="reset-password-confirm"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your new password"
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={submitting}>
              {submitting ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}

        {status === 'success' && (
          <a href="/" className="auth-submit-btn" style={{ display: 'inline-flex', justifyContent: 'center', textDecoration: 'none' }}>
            Back to Homepage
          </a>
        )}

        <div className="auth-switch">
          <p>
            <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} />
              Return Home
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
