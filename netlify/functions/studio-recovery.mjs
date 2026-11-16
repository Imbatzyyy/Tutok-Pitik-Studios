import {createHash} from 'node:crypto';
const ORIGIN='https://dhqxzrzjvgcmjjkmxlfs.supabase.co';
const reply=(status,error)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
export default async function handler(req){
 if(req.method!=='POST')return reply(405,'Method not allowed');
 if(req.headers.get('origin')!=='https://tutokpitikstudios.com')return reply(403,'Request not allowed');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY,anon=process.env.VITE_SUPABASE_ANON_KEY;
 if(!key||!anon)return reply(503,'Recovery is temporarily unavailable');
 try{
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!token||token.length>10000)return reply(401,'Sign in again');
 const auth=await fetch(`${ORIGIN}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)});if(!auth.ok)return reply(401,'Sign in again');const user=await auth.json();
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
 const raw=await req.text();if(raw.length>512)return reply(400,'Invalid recovery code');const {code}=JSON.parse(raw);
 if(typeof code!=='string'||!/^[a-f0-9]{24}$/.test(code.trim().toLowerCase()))return reply(400,'Invalid recovery code');
 const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
 const rpc=async(name,body)=>fetch(`${ORIGIN}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
 const limit=await rpc('studio_login_limit',{p_key:createHash('sha256').update(`recovery:${user.id}`).digest('hex'),p_max:5});if(!limit.ok||await limit.json()!==true)return reply(429,'Please wait 15 minutes before trying recovery again');
 const accepted=await rpc('studio_consume_recovery',{p_user:user.id,p_session:claims.session_id,p_hash:createHash('sha256').update(code.trim().toLowerCase()).digest('hex')});if(!accepted.ok||await accepted.json()!==true)return reply(400,'Code invalid or used. Sign in again with your password before recovery.');
 const factors=await fetch(`${ORIGIN}/auth/v1/admin/users/${user.id}/factors`,{headers,signal:AbortSignal.timeout(5000)});if(!factors.ok)throw new Error();const list=await factors.json();
 for(const factor of (Array.isArray(list)?list:list.factors||[])){const removed=await fetch(`${ORIGIN}/auth/v1/admin/users/${user.id}/factors/${factor.id}`,{method:'DELETE',headers,signal:AbortSignal.timeout(5000)});if(!removed.ok)throw new Error();}
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return reply(503,'Recovery could not finish. Sign in again; if your authenticator remains, use another unused recovery code.');}
}
