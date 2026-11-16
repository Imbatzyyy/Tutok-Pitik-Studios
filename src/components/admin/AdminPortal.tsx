import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Camera, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Toaster } from 'sonner';
import { appFetch, isDemoMode, supabase } from '../../lib/supabase';
import { isTeamRole, resolveSessionUser, type SessionUser } from '../../lib/session';
import { parseRoute } from '../../lib/routes';
import { DEFAULT_PORTFOLIO } from '../../content/portfolio';
import logo from '../../assets/logo-160.png';
const Dashboard = lazy(() => import('./AdminDashboard'));
const LOGIN = '/admin/login';
const safeNext = (value: string | null) => value?.startsWith('/admin/') && !/[?\\#]/.test(value) && parseRoute(value)?.view === 'admin' ? value : '/admin/overview';

export default function AdminPortal() {
  const [user,setUser]=useState<SessionUser|null>(null);
  const [checking,setChecking]=useState(true);
  const [checkError,setCheckError]=useState(false);
  const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [visible,setVisible]=useState(false); const [busy,setBusy]=useState(false);
  const [error,setError]=useState(''); const [reset,setReset]=useState(false); const [sent,setSent]=useState(false);
  const [path,setPath]=useState(window.location.pathname);
  const checkRunning=useRef(false);
  const [routeRevision,setRouteRevision]=useState(0);
  const route=parseRoute(path);
  const next=useRef(safeNext(path===LOGIN?new URLSearchParams(location.search).get('next'):path));
  const photo=DEFAULT_PORTFOLIO.find(item=>item.id==='bgc-series-2') || DEFAULT_PORTFOLIO[0];
  const navigate=useCallback((url:string,replace=false)=>{
    if(location.pathname+location.search!==url)window.history[replace?'replaceState':'pushState']({},'',url);setPath(new URL(url,location.origin).pathname);
  },[]);
  const signOut=useCallback(async()=>{
    setUser(null);
    try { await supabase.rpc('studio_end_admin_session'); } finally {
      await supabase.auth.signOut({scope:'local'}).catch(()=>undefined);
      navigate(LOGIN,true);
    }
  },[navigate]);
  const check=useCallback(async()=>{
    if(checkRunning.current)return;
    checkRunning.current=true;
    try {
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(sessionError)throw sessionError;
      if(!session){setUser(null);setCheckError(false);return;}
      const {data:allowed,error:permissionError}=await supabase.rpc('is_studio_team');
      if(permissionError)throw permissionError;
      if(!allowed){await signOut();setError('Your session has ended. Please sign in again.');return;}
      const profile=await resolveSessionUser(session.user);
      if(!isTeamRole(profile.role)){await signOut();return;}
      setUser(profile);setCheckError(false);
    }catch{setCheckError(true);setUser(null);}
    finally{checkRunning.current=false;setChecking(false);}
  },[signOut]);
  useEffect(()=>{
    document.documentElement.dataset.studioWorkspace='true';
    document.title='Studio workspace · Tutok Pitik Studios';
    void check();
    const timer=window.setInterval(()=>{if(!document.hidden)void check();},60_000);
    const focus=()=>{if(!document.hidden)void check();};document.addEventListener('visibilitychange',focus);
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==='SIGNED_OUT')setUser(null);
      if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')window.setTimeout(()=>void check(),0);
    });
    const pop=()=>{setPath(location.pathname);setRouteRevision(n=>n+1);};window.addEventListener('popstate',pop);
    return()=>{delete document.documentElement.dataset.studioWorkspace;clearInterval(timer);document.removeEventListener('visibilitychange',focus);subscription.unsubscribe();window.removeEventListener('popstate',pop);};
  },[check]);
  useEffect(()=>{
    if(checking||checkError)return;
    if(user&&path===LOGIN)navigate(next.current,true);
    if(!user&&path!==LOGIN)navigate(`${LOGIN}?next=${encodeURIComponent(safeNext(path))}`,true);
  },[user,checking,checkError,path,navigate]);
  const submit=async(event:FormEvent)=>{
    event.preventDefault(); if(busy)return;setError('');
    if(!/^\S+@\S+\.\S+$/.test(email.trim())||(!reset&&!password)){setError('Enter your email and password to continue.');return;}
    setBusy(true);
    try{
      if(reset){
        const {error:resetError}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${location.origin}/reset-password`});
        if(resetError)throw new Error('Unable to send a reset link right now. Please try again.');
        setSent(true);return;
      }
      const response=await appFetch(`${location.origin}/.netlify/functions/admin-login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),password}),signal:AbortSignal.timeout(30_000)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Unable to sign in with these details.');
      const {error:sessionError}=await supabase.auth.setSession(result);if(sessionError)throw sessionError;
      setPassword('');await check();
    }catch(err){setError(err instanceof Error?err.message:'Unable to sign in. Please try again.');}
    finally{setBusy(false);}
  };
  if(checking)return <main className="admin-loading" role="status"><LoaderCircle className="spin"/> Opening your studio workspace…</main>;
  if(checkError)return <main className="admin-loading"><ShieldCheck/><h1>We couldn’t verify your session</h1><p>Check your connection and try again.</p><button className="btn btn-primary" onClick={()=>void check()}>Try again</button><a href={LOGIN} onClick={()=>void supabase.auth.signOut({scope:'local'})}>Return to sign in</a></main>;
  if(user)return <div className="admin-portal">{isDemoMode&&<div className="demo-banner">Local preview · fictional studio data</div>}<Suspense fallback={<main className="admin-loading">Loading workspace…</main>}><Dashboard key={`${user.role}-${routeRevision}`} user={user} initialTab={route?.view==='admin'?route.tab:undefined} initialBookingId={route?.view==='admin'?route.bookingId:undefined} onClose={()=>window.location.assign('/')} onLogout={()=>void signOut()} onLocationChange={(tab,id)=>navigate(id?`/admin/bookings/${encodeURIComponent(id)}`:`/admin/${tab}`,true)}/></Suspense><Toaster theme="light" position="top-right" richColors closeButton/></div>;
  return <main className="studio-login">
    <section className="studio-login-photo" aria-label="Tutok Pitik Studios team workspace">
      <img src={photo.src} alt="Photography by Tutok Pitik Studios"/>
      <a href="/" className="studio-login-brand"><img src={logo} alt=""/><span>TUTOK PITIK<br/><b>STUDIOS</b></span></a>
      <div className="studio-login-story"><span className="studio-eyebrow">BEHIND EVERY GREAT SESSION</span><h1>A little more focus.<br/>A lot more possibility.</h1><p>Your bookings, your people, your next great shoot.<br/>All in one place.</p><span className="studio-photo-credit"><Camera size={15}/> {photo.title} · Tutok Pitik Studios</span></div>
    </section>
    <section className="studio-login-panel">
      <a className="studio-back" href="/"><ArrowLeft size={16}/> Back to the website</a>
      <div className="studio-login-form"><span className="studio-login-symbol"><Camera size={27}/></span><p className="studio-eyebrow">THE STUDIO WORKSPACE</p><h2>{reset?'Reset your password':'Welcome back.'}</h2><p className="studio-login-intro">{reset?'We’ll send a reset link to your account email.':'Sign in to manage the moments that matter.'}</p>
      {sent?<div className="studio-reset-sent"><Mail/><h3>Check your inbox</h3><p>If the address is eligible, a reset link will arrive shortly. After resetting, return here to sign in.</p><button className="btn btn-primary" onClick={()=>{setReset(false);setSent(false);}}>Back to sign in</button></div>:<form onSubmit={submit}>
        {error&&<div className="notice notice-danger" role="alert">{error}</div>}
        <div className="field"><label htmlFor="team-email">Work email</label><input id="team-email" autoComplete="username" type="email" placeholder="you@studio.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
        {!reset&&<div className="field"><div className="studio-password-label"><label htmlFor="team-password">Password</label><button type="button" onClick={()=>{setReset(true);setError('');}}>Forgot password?</button></div><div className="input-affix"><input id="team-password" autoComplete="current-password" type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" className="affix-btn" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>}
        <button className="btn btn-primary btn-block studio-login-submit" disabled={busy}>{busy?<LoaderCircle size={18} className="spin"/>:<ArrowUpRight size={18}/>} {busy?'Please wait…':reset?'Send reset link':'Sign in to workspace'}</button>
        {reset&&<button type="button" className="btn btn-ghost btn-block" onClick={()=>setReset(false)}>Back to sign in</button>}
      </form>}
      <p className="studio-access-note"><LockKeyhole size={16}/> Access is limited to authorized studio team members. Need access? Contact your studio owner.</p>
      {isDemoMode&&<p className="notice">Local preview only · superadmin@demo.test / admin@demo.test / staff@demo.test · password demo1234</p>}
      </div><footer className="studio-login-footer"><span>© {new Date().getFullYear()} Tutok Pitik Studios</span><a href="/privacy">Privacy notice</a></footer>
    </section>
  </main>;
}
