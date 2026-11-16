import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, LoaderCircle, ShieldCheck, Smartphone } from 'lucide-react';
import logo from '../../assets/logo-160.png';
import { rpc } from '../../lib/studio';
import { supabase } from '../../lib/supabase';

export default function StudioMfa({ onVerified, onExit }: { onVerified: () => void; onExit: () => void }) {
  const [factor, setFactor] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const verified = data.totp.find((f) => f.status === 'verified');
        if (verified) {
          if (!cancelled) setFactor(verified.id);
          return;
        }
        // Remove incomplete enrollments from an interrupted previous setup.
        for (const f of data.all.filter((f) => f.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
        const enrolled = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Studio authenticator', issuer: 'Tutok Pitik Studios' });
        if (enrolled.error) throw enrolled.error;
        if (!cancelled) {
          setFactor(enrolled.data.id);
          setQr(enrolled.data.totp.qr_code);
          setSecret(enrolled.data.totp.secret);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'We couldn’t prepare verification. Go back and sign in again.');
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const value = code.trim();
    if (!recovery && !/^\d{6}$/.test(value)) {
      setError('Enter the six-digit code from your authenticator app.');
      inputRef.current?.focus();
      return;
    }
    if (recovery && value.length < 6) {
      setError('Enter one of your saved recovery codes.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (recovery) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const r = await fetch('/.netlify/functions/studio-recovery', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: value }),
        });
        const result = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(result.error || 'Recovery could not be completed.');
        await supabase.auth.signOut({ scope: 'global' });
        setNotice('Your old authenticator was removed. Sign in again, then set up a new authenticator.');
        setRecovery(false);
        setFactor('');
        setQr('');
        return;
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code: value });
      if (error) throw error;
      if (!(await rpc('is_studio_team'))) throw new Error('Verification worked, but your workspace session ended. Please sign in again.');
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed. Check the code and try again.');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
      setCode('');
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the key stays visible to copy by hand */
    }
  };

  const setup = !!qr && !recovery;
  const title = recovery ? 'Use a recovery code' : setup ? 'Set up your authenticator' : 'Enter your verification code';
  const intro = recovery
    ? 'Enter one of the unused recovery codes you saved from the workspace. Your old authenticator will be removed, and you’ll sign in again to set up a new one.'
    : setup
      ? 'Studio records stay locked until this account is protected with an authenticator app, such as Google Authenticator or Microsoft Authenticator.'
      : 'Open your authenticator app and enter the six-digit code for Tutok Pitik Studios.';

  return (
    <main className="studio-auth">
      <section className="studio-auth-card studio-mfa" aria-labelledby="mfa-title">
        <div className="studio-auth-brand">
          <img src={logo} alt="" />
          <span>Tutok Pitik Studios</span>
        </div>
        <span className="studio-auth-icon" aria-hidden="true">
          {setup ? <Smartphone size={24} /> : <ShieldCheck size={24} />}
        </span>
        <p className="studio-eyebrow">Account security</p>
        <h1 id="mfa-title">{title}</h1>
        <p className="studio-auth-intro">{intro}</p>

        {preparing && (
          <p className="ops-loading" role="status">
            <LoaderCircle size={18} className="spin" aria-hidden="true" /> Preparing verification…
          </p>
        )}

        {setup && (
          <ol className="studio-mfa-steps">
            <li>
              <strong>Scan this code</strong> with your authenticator app.
              <img src={qr} alt="QR code to add Tutok Pitik Studios to your authenticator app" width="188" height="188" />
              <details>
                <summary>Can’t scan? Enter the setup key instead</summary>
                <div className="studio-mfa-secret">
                  <code>{secret}</code>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copySecret()}>
                    {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copied ? 'Copied' : 'Copy key'}
                  </button>
                </div>
              </details>
            </li>
            <li>
              <strong>Enter the six-digit code</strong> the app shows below.
            </li>
          </ol>
        )}

        {notice && (
          <p className="notice notice-success" role="status">
            {notice}
          </p>
        )}

        {(factor || recovery) && (
          <form onSubmit={submit} noValidate>
            <label className="field" htmlFor="mfa-code">
              {recovery ? 'Recovery code' : 'Six-digit code'}
            </label>
            <input
              ref={inputRef}
              id="mfa-code"
              className={recovery ? 'studio-recovery-input' : 'studio-code-input'}
              autoFocus
              autoComplete="one-time-code"
              inputMode={recovery ? 'text' : 'numeric'}
              pattern={recovery ? undefined : '[0-9]*'}
              placeholder={recovery ? 'xxxx-xxxx' : '000000'}
              value={code}
              aria-invalid={!!error}
              aria-describedby={error ? 'mfa-error' : undefined}
              onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={recovery ? 40 : 6}
            />
            {error && (
              <p role="alert" id="mfa-error" className="notice notice-danger">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || (!factor && !recovery)}>
              {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
              {busy ? 'Checking…' : 'Verify and continue'}
            </button>
          </form>
        )}
        {!factor && !recovery && !preparing && error && (
          <p role="alert" className="notice notice-danger">
            {error}
          </p>
        )}

        <div className="studio-auth-actions">
          {!qr && factor && (
            <button
              type="button"
              className="studio-link-btn"
              onClick={() => {
                setRecovery(!recovery);
                setError('');
                setCode('');
              }}
            >
              {recovery ? 'Use my authenticator app instead' : 'Lost your authenticator? Use a recovery code'}
            </button>
          )}
          <button type="button" className="studio-link-btn" onClick={onExit}>
            Back to sign in
          </button>
        </div>
      </section>
    </main>
  );
}
