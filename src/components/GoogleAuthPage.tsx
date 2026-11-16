import { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, ShieldCheck } from 'lucide-react';
import logoImage from '../assets/logo-160.png';
import { beginGoogleSignIn, finishGoogleSignIn, GOOGLE_CALLBACK_PATH } from '../lib/google-auth';

export default function GoogleAuthPage() {
  const [error, setError] = useState('');
  useEffect(() => {
    document.title = 'Google sign-in · Tutok Pitik Studios';
    let mounted = true;
    const run = async () => {
      try {
        if (window.location.pathname === GOOGLE_CALLBACK_PATH) {
          const destination = await finishGoogleSignIn();
          if (mounted) window.location.replace(destination);
        } else await beginGoogleSignIn();
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
      }
    };
    void run();
    return () => { mounted = false; };
  }, []);

  return (
    <main className="reset-page">
      <div className="ui-modal ui-modal-sm reset-card">
        <img src={logoImage} alt="Tutok Pitik Studios" width={64} height={64} className="reset-logo" />
        <header className="ui-modal-header">
          <div className="ui-modal-icon"><ShieldCheck size={22} /></div>
          <div className="ui-modal-heading">
            <h1>{error ? 'Let’s try signing in again' : 'Signing you in securely'}</h1>
            <p>{error ? 'Your booking selections are saved in this browser tab.' : 'Connecting your Google account to Tutok Pitik Studios.'}</p>
          </div>
        </header>
        <div className="ui-modal-body">
          {error ? <div className="notice notice-danger" role="alert"><p>{error}</p></div>
            : <div className="loading-row" role="status"><LoaderCircle size={18} className="spin" /> Please wait…</div>}
          {error && <a className="btn btn-primary btn-block reset-home" href="/?signin=1"><ArrowLeft size={16} /> Back to sign in</a>}
        </div>
      </div>
    </main>
  );
}
