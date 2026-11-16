import { createHash } from 'node:crypto';
const ORIGIN = 'https://dhqxzrzjvgcmjjkmxlfs.supabase.co';
const SITE = 'https://tutokpitikstudios.com';
const generic = 'Unable to sign in with these details.';
const reply = (status, body) => Response.json(body, {status, headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
export default async function adminLogin(req, context) {
  if (req.method !== 'POST') return reply(405,{error:'Method not allowed.'});
  if (req.headers.get('origin') !== SITE) return reply(403,{error:'Request not allowed.'});
  if (!req.headers.get('content-type')?.includes('application/json')) return reply(415,{error:generic});
  const env=process.env;
  if (env.VITE_SUPABASE_URL?.replace(/\/$/,'') !== ORIGIN || !env.SUPABASE_SERVICE_ROLE_KEY || !env.VITE_SUPABASE_ANON_KEY) return reply(503,{error:'Sign-in is temporarily unavailable.'});
  const service=env.SUPABASE_SERVICE_ROLE_KEY;
  const call = async (path, body, key=service) => fetch(`${ORIGIN}${path}`, {method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(5000)});
  try {
    if (Number(req.headers.get('content-length'))>4096) return reply(413,{error:generic});
    const raw=await req.text(); if (raw.length>4096) return reply(413,{error:generic});
    let body;try{body=JSON.parse(raw);}catch{return reply(400,{error:generic});}
    if(!body||Array.isArray(body))return reply(400,{error:generic});
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    if (!/^\S+@\S+\.\S+$/.test(email)||email.length>254||typeof body.password!=='string'||!body.password||body.password.length>256) return reply(400,{error:generic});
    // Atomic shared limits. Hashes expire; no email/IP/password is written to logs.
    for (const [scope,value,max] of [['account',email,10],['ip',context.ip||'unknown',40]]) {
      const hash=createHash('sha256').update(`${scope}:${value}`).digest('hex');
      const limit=await call('/rest/v1/rpc/studio_login_limit',{p_key:hash,p_max:max});
      if (!limit.ok) return reply(503,{error:'Sign-in is temporarily unavailable.'});
      if (await limit.json()!==true) return reply(429,{error:'Too many sign-in attempts. Please try again in 15 minutes.'});
    }
    const auth=await call('/auth/v1/token?grant_type=password',{email,password:body.password},env.VITE_SUPABASE_ANON_KEY);
    if (!auth.ok) return reply(401,{error:generic});
    const session=await auth.json();
    const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
    const registered=await call('/rest/v1/rpc/studio_register_admin_session',{p_user_id:session.user.id,p_session_id:claims.session_id});
    if (!registered.ok || await registered.json()!==true) {
      await fetch(`${ORIGIN}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(3000)}).catch(()=>{});
      return reply(401,{error:generic});
    }
    return reply(200,{access_token:session.access_token,refresh_token:session.refresh_token});
  } catch { return reply(503,{error:'Sign-in is temporarily unavailable. Please try again.'}); }
}
