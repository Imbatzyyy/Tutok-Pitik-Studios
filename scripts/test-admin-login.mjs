import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import login from '../netlify/functions/admin-login.mjs';
const originalFetch=globalThis.fetch;
const originalEnv={...process.env};
const origin='https://tutokpitikstudios.com';
const sessionId='11111111-1111-4111-8111-111111111111';
const token='fixture.'+Buffer.from(JSON.stringify({sub:'actor',session_id:sessionId})).toString('base64url')+'.signature';
let calls=[], permission=true, limit=true, authOK=true;
beforeEach(()=>{
 calls=[];permission=true;limit=true;authOK=true;
 process.env.VITE_SUPABASE_URL='https://dhqxzrzjvgcmjjkmxlfs.supabase.co';
 process.env.SUPABASE_SERVICE_ROLE_KEY='server-fixture';process.env.VITE_SUPABASE_ANON_KEY='public-fixture';
 globalThis.fetch=async(url,init)=>{
  calls.push({url,init,body:init.body?JSON.parse(init.body):null});
  assert(url.startsWith(process.env.VITE_SUPABASE_URL));
  if(url.includes('studio_login_limit'))return Response.json(limit);
  if(url.includes('/token?'))return Response.json(authOK?{access_token:token,refresh_token:'refresh-fixture',user:{id:'actor'}}:{error:'private auth error'},{status:authOK?200:400});
  if(url.includes('studio_register_admin_session'))return Response.json(permission);
  if(url.includes('/logout?'))return new Response(null,{status:204});
  throw new Error('Unexpected I/O');
 };
});
afterEach(()=>{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in originalEnv))delete process.env[k];Object.assign(process.env,originalEnv);});
const request=(body={email:'team@example.invalid',password:'fixture-password'},headers={},method='POST')=>new Request(origin+'/.netlify/functions/admin-login',{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
const call=req=>login(req,{ip:'192.0.2.1'});
test('Successful login binds the verified session before returning only session tokens',async()=>{
 const r=await call(request());assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{access_token:token,refresh_token:'refresh-fixture'});
 assert.deepEqual(calls[3].body,{p_user_id:'actor',p_session_id:sessionId});
 assert(calls.slice(0,2).every(c=>/^[a-f0-9]{64}$/.test(c.body.p_key)));
 assert(calls.slice(0,2).every(c=>!JSON.stringify(c.body).includes('team@example.invalid')));
 assert.equal(calls[2].init.headers.apikey,'public-fixture');assert.equal(calls[3].init.headers.apikey,'server-fixture');
});
test('Customer or inactive role is denied generically and the temporary session is revoked',async()=>{
 permission=false;const r=await call(request());assert.equal(r.status,401);assert.deepEqual(await r.json(),{error:'Unable to sign in with these details.'});assert(calls.at(-1).url.endsWith('/logout?scope=local'));
});
test('Invalid credentials disclose no provider response',async()=>{authOK=false;const r=await call(request());assert.equal(r.status,401);assert(!(await r.text()).includes('private'));assert.equal(calls.length,3);});
test('Cross-origin submission is rejected before credentials are used',async()=>{assert.equal((await call(request(undefined,{Origin:'https://evil.example'}))).status,403);assert.equal(calls.length,0);});
test('Missing origin is rejected',async()=>{const req=request();req.headers.delete('Origin');assert.equal((await call(req)).status,403);assert.equal(calls.length,0);});
test('Non-POST and non-JSON are rejected without I/O',async()=>{assert.equal((await call(request(undefined,{},'GET'))).status,405);assert.equal((await call(request(undefined,{'Content-Type':'text/plain'}))).status,415);assert.equal(calls.length,0);});
test('Rate limit rejects before password verification',async()=>{limit=false;assert.equal((await call(request())).status,429);assert.equal(calls.length,1);});
test('Oversized input and invalid fields never reach auth',async()=>{assert.equal((await call(request('x'.repeat(4100)))).status,413);assert.equal((await call(request({email:'bad',password:'p'}))).status,400);assert.equal(calls.length,0);});
test('Unknown Supabase project and missing server secret fail closed',async()=>{process.env.VITE_SUPABASE_URL='https://other.supabase.co';assert.equal((await call(request())).status,503);delete process.env.SUPABASE_SERVICE_ROLE_KEY;assert.equal((await call(request())).status,503);assert.equal(calls.length,0);});
test('Provider failure is sanitized and tokens are never returned',async()=>{globalThis.fetch=async()=>{throw new Error('server-fixture private response');};const r=await call(request());assert.equal(r.status,503);assert(!(await r.text()).includes('fixture'));});
test('Failed binding never returns an unbound token',async()=>{const mock=globalThis.fetch;globalThis.fetch=async(url,init)=>url.includes('studio_register')?Response.json({error:'private error'},{status:500}):mock(url,init);const r=await call(request());assert.equal(r.status,401);assert(!(await r.text()).includes('token'));});
