import {createClient} from 'npm:@supabase/supabase-js';
import {handleAuthMail} from './core.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
Deno.serve(req=>handleAuthMail(req,{secret:Deno.env.get('STUDIO_AUTH_EMAIL_HOOK_SECRET')||'',key:Deno.env.get('RESEND_API_KEY')||'',from:Deno.env.get('RESEND_FROM_EMAIL')||''},{fetcher:fetch,roleFor:async id=>{const {data,error}=await db.from('users').select('role').eq('id',id).maybeSingle();if(error||!data)throw Error('Profile unavailable');return data.role;}}));
