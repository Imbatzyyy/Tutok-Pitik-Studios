import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CircleCheck, KeyRound, LoaderCircle } from 'lucide-react';
import logoImage from '../assets/logo-160.png';
import { createRecoveryClient } from '../lib/supabase';
import { errorMessage } from '../lib/api';

export default function ResetPasswordPage() {
  const studio = new URLSearchParams(location.search).get('studio')==='1';
  const recovery=useMemo(()=>createRecoveryClient(),[]);
  const [link]=useState(()=>new URLSearchParams(location.hash.replace(/^#/,'')));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'checking' | 'link' | 'mfa' | 'ready' | 'invalid' | 'success'>('checking');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [factor, setFactor] = useState('');
  const [code, setCode] = useState('');
  const preparePasswordForm = useCallback(async () => {
    setStatus('mfa');setError('');
    try {
      const {data,error}=await recovery.auth.mfa.listFactors();
      if(error)throw error;
      const enrolled=data.totp.find(item=>item.status==='verified');
      if(enrolled)setFactor(enrolled.id);else setStatus('ready');
    }catch{setError('We could not load your security settings. Please try again.');}
  },[recovery]);

  useEffect(() => {
    document.title = 'Reset password · Tutok Pitik Studios';
    // Fragments are not sent to the web server. Remove them from browser history
    // immediately and redeem the one-time token only after an explicit click.
    window.history.replaceState({},document.title,location.pathname+location.search);
    const type=link.get('type');
    if(type!=='recovery'&&type!=='invite'){setStatus('invalid');return;}
    if(link.get('token_hash')){setStatus('link');return;}
    const access=link.get('access_token'),refresh=link.get('refresh_token');
    if(!access||!refresh){setStatus('invalid');return;}
    let active=true;
    void recovery.auth.setSession({access_token:access,refresh_token:refresh}).then(async({data,error})=>{if(!active)return;if(error||!data.session)setStatus('invalid');else await preparePasswordForm();});
    return()=>{active=false;};
  },[link,recovery,preparePasswordForm]);
  const verifyLink=async()=>{
    if(submitting)return;setSubmitting(true);setError('');
    try{
      const type=link.get('type');if(type!=='recovery'&&type!=='invite')throw Error();
      const {data,error}=await recovery.auth.verifyOtp({token_hash:link.get('token_hash')||'',type});
      if(error||!data.session){setStatus('invalid');return;}
      link.delete('token_hash');await preparePasswordForm();
    }catch{setError('We could not verify the link. Check your connection and try again.');}
    finally{setSubmitting(false);}
  };

  const verifyAuthenticator = async (event:FormEvent) => {
    event.preventDefault();if(submitting)return;setSubmitting(true);setError('');
    try {
      const {error}=await recovery.auth.mfa.challengeAndVerify({factorId:factor,code:code.trim()});
      if(error)throw error;
      setCode('');setStatus('ready');
    }catch{setError('That code could not be verified. Enter a current six-digit authenticator code.');}
    finally{setSubmitting(false);}
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSubmitting(true);
    try {
      const { error: updateError } = await recovery.auth.updateUser({ password });
      if (updateError) throw updateError;
      await recovery.auth.signOut({scope:'local'});
      setStatus('success');
      window.history.replaceState({}, document.title, studio?'/reset-password?studio=1':'/reset-password');
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
          {status === 'invalid' && <div className="notice notice-danger"><p>{studio?'This reset link is invalid or has expired. Ask your super admin to send a new one.':'This reset link is invalid or has expired. Request a new one from the sign-in window.'}</p></div>}
          {status === 'link' && <><p>This private link can be used once and expires one hour after it was sent. Continue to verify it securely.</p>{error&&<p role="alert">{error}</p>}<button className="btn btn-primary btn-block" disabled={submitting} onClick={()=>void verifyLink()}>{submitting?'Verifying…':'Continue securely'}</button></>}
          {status === 'mfa' && <form className="auth-form" onSubmit={verifyAuthenticator}>
            <p>Your account uses an authenticator. Verify your identity before changing your password.</p>
            {error&&<div className="notice notice-danger" role="alert"><p>{error}</p></div>}
            {factor?<><div className="field"><label htmlFor="reset-code">Authenticator code</label><input id="reset-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))} autoFocus required /></div><button className="btn btn-primary btn-block" disabled={submitting||code.length!==6}>{submitting?'Verifying…':'Verify identity'}</button></>:<button type="button" className="btn btn-secondary" onClick={()=>void preparePasswordForm()}>Retry security check</button>}
            <p className="field-hint">If you lost your authenticator, contact your super admin for help with account recovery.</p>
          </form>}
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
          <a className="btn btn-ghost btn-block reset-home" href={studio?'/admin/login':'/'}>
            <ArrowLeft size={16} /> {studio?'Go to studio sign-in':'Back to the website'}
          </a>
        </div>
      </div>
    </main>
  );
}
