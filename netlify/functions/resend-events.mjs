import {createHmac,timingSafeEqual} from 'node:crypto';
// Resend/Svix HMAC verification over the untouched body. Timestamp and event-ID
// deduplication prevent stale replay; equal-length signatures use constant time.
export function verifyEvent(raw,headers,secret,now=Date.now()){
 const id=headers.get('svix-id'),stamp=headers.get('svix-timestamp'),signatures=headers.get('svix-signature');
 if(!secret?.startsWith('whsec_')||!id||id.length>200||!stamp||!/^\d+$/.test(stamp)||Math.abs(now/1000-Number(stamp))>300||!signatures||signatures.length>2048)throw new Error('Invalid event');
 const expected=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${stamp}.${raw}`).digest();
 const valid=signatures.split(' ').some(signature=>{const [version,encoded]=signature.split(',');if(version!=='v1'||!encoded)return false;const actual=Buffer.from(encoded,'base64');return actual.length===expected.length&&timingSafeEqual(expected,actual);});
 if(!valid)throw new Error('Invalid event');return {id,event:JSON.parse(raw)};
}
export default async function handler(req){
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 if(!process.env.RESEND_WEBHOOK_SECRET||!process.env.SUPABASE_SERVICE_ROLE_KEY)return new Response('Temporarily unavailable',{status:503});
 if(Number(req.headers.get('content-length'))>65536)return new Response('Too large',{status:413});
 let verified;try{const raw=await req.text();if(Buffer.byteLength(raw)>65536)return new Response('Too large',{status:413});verified=verifyEvent(raw,req.headers,process.env.RESEND_WEBHOOK_SECRET);}catch{return new Response('Invalid event',{status:400});}
 const {id,event}=verified;const provider=event.data?.email_id,at=event.created_at;
 if(typeof provider!=='string'||!Number.isFinite(Date.parse(at)))return new Response('Invalid event',{status:400});
 try{const key=process.env.SUPABASE_SERVICE_ROLE_KEY;const result=await fetch('https://dhqxzrzjvgcmjjkmxlfs.supabase.co/rest/v1/rpc/studio_email_event',{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_event_id:id,p_provider_id:provider,p_type:event.type,p_at:at}),signal:AbortSignal.timeout(10000)});return new Response(result.ok?'OK':'Retry',{status:result.ok?200:503});}catch{return new Response('Retry',{status:503});}
}
