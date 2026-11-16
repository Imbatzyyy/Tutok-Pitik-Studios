import {handleAuthMail} from './core.ts';
// Keep the synchronous Auth hook small: the entire provider call has a five-second budget.
// A bounded REST lookup avoids loading the database SDK and its realtime/Auth clients.
const databaseUrl=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
Deno.serve(req=>handleAuthMail(req,{secret:Deno.env.get('STUDIO_AUTH_EMAIL_HOOK_SECRET')||'',key:Deno.env.get('RESEND_API_KEY')||'',from:Deno.env.get('RESEND_FROM_EMAIL')||''},{fetcher:fetch,roleFor:async id=>{
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('Profile unavailable');
 const url=new URL('/rest/v1/users',databaseUrl);url.search=new URLSearchParams({select:'role',id:`eq.${id}`,limit:'1'}).toString();
 const response=await fetch(url,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},signal:AbortSignal.timeout(1500)});
 if(!response.ok)throw Error('Profile unavailable');
 const rows=await response.json();if(!Array.isArray(rows)||rows.length!==1||typeof rows[0].role!=='string')throw Error('Profile unavailable');
 return rows[0].role;
}}));
