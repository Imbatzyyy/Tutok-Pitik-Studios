import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import templates from '../_shared/auth-mail-templates.json' with { type: 'json' };
const SITE='https://tutokpitikstudios.com';
const AUTH='https://dhqxzrzjvgcmjjkmxlfs.supabase.co';
const teamRoles=new Set(['superadmin','super_admin','admin','staff']);
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function verifyHook(raw:string,headers:Headers,secret:string,now=Date.now()){
 const id=headers.get('webhook-id'),stamp=headers.get('webhook-timestamp'),sigs=headers.get('webhook-signature');
 const key=secret.replace(/^v1,whsec_/, '').replace(/^whsec_/, '');
 if(!key||!id||id.length>200||!stamp||!/^\d+$/.test(stamp)||Math.abs(now/1000-Number(stamp))>300||!sigs||sigs.length>2048)throw Error('Invalid hook');
 const expected=createHmac('sha256',Buffer.from(key,'base64')).update(`${id}.${stamp}.${raw}`).digest();
 if(!sigs.split(' ').some(s=>{const [v,b]=s.split(',');if(v!=='v1'||!b)return false;const actual=Buffer.from(b,'base64');return actual.length===expected.length&&timingSafeEqual(actual,expected);}))throw Error('Invalid hook');
 return {id,event:JSON.parse(raw)};
}
export function authMessages(event:any){
 const {user,email_data:d}=event;if(!user?.id||!user.email||!d?.email_action_type)throw Error('Invalid mail event');
 const kind=({signup:'confirmation',magiclink:'magic_link',email:'magic_link'} as Record<string,string>)[d.email_action_type]||d.email_action_type;
 const config=templates as Record<string,string|number>,template=config[`mailer_templates_${kind}_content`],subject=config[`mailer_subjects_${kind}`];
 if(typeof template!=='string'||typeof subject!=='string')throw Error('Unsupported mail event');
 let redirect=SITE;try{const candidate=new URL(d.redirect_to);if(candidate.origin===SITE)redirect=candidate.href;}catch{/* Use the studio home page. */}
 const build=(to:string,hash:string,token:string)=>{
  if(!/^\S+@\S+\.\S+$/.test(to))throw Error('Invalid recipient');
  let confirmation='';if(!kind.endsWith('_notification')&&kind!=='reauthentication'){
   if(typeof hash!=='string'||!hash||hash.length>1024)throw Error('Missing confirmation hash');
   const link=new URL('/auth/v1/verify',AUTH);link.searchParams.set('token',hash);link.searchParams.set('type',d.email_action_type);link.searchParams.set('redirect_to',redirect);confirmation=link.href;
   if(kind==='recovery'||kind==='invite'){const local=new URL('/reset-password',SITE);if(new URL(redirect).searchParams.get('studio')==='1')local.searchParams.set('studio','1');local.hash=new URLSearchParams({token_hash:hash,type:d.email_action_type}).toString();confirmation=local.href;}
  }
  const values:Record<string,unknown>={ConfirmationURL:confirmation,Token:token,TokenHash:hash,SiteURL:SITE,RedirectTo:redirect,Email:to,NewEmail:user.new_email};
  const body=kind==='recovery'||kind==='invite'?template.replace('This link is private and time limited.', 'This one-time link expires in 1 hour.'):template;
  const html=body.replace(/{{\s*\.(\w+)\s*}}/g,(_m,key)=>escape(values[key]));
  if(html.includes('{{'))throw Error('Unsupported email template');
  return {to:[to],subject,html};
 };
 if(kind==='email_change'){
  const messages=[];if(d.token_hash_new)messages.push(build(user.email,d.token_hash_new,d.token));
  messages.push(build(user.new_email,d.token_hash,d.token_new||d.token));return messages;
 }
 return [build(user.email,d.token_hash,d.token)];
}
export async function handleAuthMail(req:Request,config:{secret:string;key:string;from:string},deps:{roleFor:(id:string)=>Promise<string>;fetcher:typeof fetch}){
 const fail=(status:number,message:string)=>Response.json({error:{http_code:status,message}},{status});
 if(req.method!=='POST')return fail(405,'Method not allowed');
 if(!config.secret||!config.key||!config.from)return fail(503,'Email service unavailable');
 let verified;try{const raw=await req.text();if(raw.length>131072)return fail(413,'Request too large');verified=verifyHook(raw,req.headers,config.secret);}catch{return fail(401,'Invalid hook signature');}
 try{
  if(verified.event.email_data?.email_action_type==='recovery'){
   const role=await deps.roleFor(verified.event.user?.id);
   if(teamRoles.has(role))return fail(403,'Password recovery is managed by the studio.');
   if(role!=='customer')return fail(403,'Password recovery is unavailable.');
  }
  const messages=authMessages(verified.event);
  const responses=await Promise.all(messages.map((message,i)=>deps.fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`auth-hook:${verified.id}:${i}`},body:JSON.stringify({from:config.from,reply_to:'tutokpitikstudios@gmail.com',...message}),signal:AbortSignal.timeout(2000)})));
  if(responses.some(r=>!r.ok))return fail(503,'Email service unavailable');
  return Response.json({});
 }catch{return fail(503,'Email service unavailable');}
}
