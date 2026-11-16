import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const source = fs.readFileSync('src/lib/google-auth.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const makeStorage = () => {
 const values = new Map();
 return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};
};
let checks=0;
function harness({href='https://tutokpitikstudios.com/auth/callback?code=one-use-code',oauthError=false,exchangeError=false,profileError=false}={}) {
 const storage=makeStorage(),events=[];
 const auth={
  async signInWithOAuth(options){events.push(['oauth',options]);return {data:{url:'https://auth.example.invalid/authorize'},error:oauthError?new Error('private provider diagnostic'):null};},
  async exchangeCodeForSession(code){events.push(['exchange',code]);return {data:exchangeError?{}:{session:{access_token:'fixture-only'},user:{id:'customer'}},error:exchangeError?new Error('private provider diagnostic'):null};},
 };
 const exports={};
 vm.runInNewContext(compiled,{exports,URL,URLSearchParams,Date,sessionStorage:storage,window:{location:{origin:'https://tutokpitikstudios.com',href,assign:p=>events.push(['navigate',p])},history:{replaceState:(_a,_b,p)=>events.push(['clean',p])}},require:id=>{
  if(id==='./supabase')return {supabase:{auth},setRememberMePreference:v=>events.push(['remember',v])};
  if(id==='./session')return {resolveCustomerSession:async u=>{events.push(['profile',u.id]);if(profileError)throw new Error('Account unavailable');return u;}};
  throw new Error('Unexpected module');
 }});
 return {api:exports,storage,events,attempt:(returnTo='/#contact',startedAt=Date.now())=>storage.setItem('tps:google-signin',JSON.stringify({startedAt,returnTo}))};
}
for(const booking of [false,true]){
 const h=harness();h.api.prepareGoogleSignIn(false,booking);
 assert.deepEqual(h.events,[['remember',false],['navigate','/auth/google']]);
 assert.equal(h.api.readGoogleAttempt().returnTo,booking?'/#contact':'/');checks++;
}
for(const invalid of ['https://evil.invalid','//evil.invalid','/admin','javascript:alert(1)']){
 const h=harness();h.attempt(invalid);assert.equal(h.api.readGoogleAttempt(),null);await assert.rejects(h.api.finishGoogleSignIn());assert.ok(!h.events.some(e=>e[0]==='exchange'));checks++;
}
for(const stamp of [Date.now()-11*60_000,Date.now()+60_000,'not a date',null]){
 const h=harness();h.attempt('/',stamp);assert.equal(h.api.readGoogleAttempt(),null);checks++;
}
{
 const h=harness();h.storage.setItem('tps:google-signin','broken json');assert.equal(h.api.readGoogleAttempt(),null);checks++;
}
{
 const h=harness();h.attempt();await h.api.beginGoogleSignIn();const opts=h.events.find(e=>e[0]==='oauth')[1];
 assert.equal(opts.provider,'google');assert.equal(opts.options.redirectTo,'https://tutokpitikstudios.com/auth/callback');assert.equal(opts.options.scopes,'openid email profile');assert.equal(opts.options.queryParams.prompt,'select_account');assert.equal(opts.options.skipBrowserRedirect,true);checks++;
}
{
 const h=harness({oauthError:true});h.attempt();await assert.rejects(h.api.beginGoogleSignIn(),/temporarily unavailable/);assert.ok(!h.events.some(e=>e[0]==='navigate'));checks++;
}
for(const href of ['https://tutokpitikstudios.com/auth/callback?error=access_denied&error_description=secret','https://tutokpitikstudios.com/auth/callback#error=access_denied','https://tutokpitikstudios.com/auth/callback']){
 const h=harness({href});h.attempt();await assert.rejects(h.api.finishGoogleSignIn());assert.deepEqual(h.events,[['clean','/auth/callback']]);assert.equal(h.api.readGoogleAttempt(),null);checks++;
}
{
 const h=harness();h.attempt();assert.equal(await h.api.finishGoogleSignIn(),'/#contact');assert.deepEqual(h.events,[['clean','/auth/callback'],['exchange','one-use-code'],['profile','customer']]);await assert.rejects(h.api.finishGoogleSignIn());assert.equal(h.events.filter(e=>e[0]==='exchange').length,1);checks++;
}
for(const options of [{exchangeError:true},{profileError:true}]){
 const h=harness(options);h.attempt();await assert.rejects(h.api.finishGoogleSignIn());assert.ok(!h.events.some(e=>e[0]==='navigate'));checks++;
}
// Exercise the real SDK's PKCE generation: no network or production credentials.
{
 const storage=makeStorage();
 const client=createClient('https://example.supabase.co','fixture-public-key',{auth:{flowType:'pkce',storage,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://tutokpitikstudios.com/auth/callback',skipBrowserRedirect:true,scopes:'openid email profile'}});
 assert.equal(error,null);const url=new URL(data.url);assert.equal(url.searchParams.get('code_challenge_method'),'s256');assert.match(url.searchParams.get('code_challenge'),/^[A-Za-z0-9_-]{43}$/);assert.ok([...storage.values.keys()].some(k=>k.endsWith('-code-verifier')));await client.auth.stopAutoRefresh();checks++;
}
// Exercise actual storage configuration on all routes, including legacy recovery.
const storageSource=fs.readFileSync('src/lib/supabase.ts','utf8').replaceAll('import.meta.env.VITE_SUPABASE_URL',JSON.stringify('https://example.supabase.co')).replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY',JSON.stringify('public-fixture-key')).replaceAll("import.meta.env.VITE_DEMO_MODE === 'true'",'false').replace("(await import('./demo')).createDemoFetch(supabaseUrl)",'undefined');
const storageCompiled=ts.transpileModule(storageSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
for(const pathname of ['/','/reset-password','/auth/google','/auth/callback','/admin','/admin/login','/admin/bookings']){
 const localStorage=makeStorage(),sessionStorage=makeStorage();let config;
 vm.runInNewContext(storageCompiled,{exports:{},URL,fetch(){throw new Error('No network');},window:{location:{pathname},localStorage,sessionStorage},require:id=>({createClient:(_url,_key,c)=>{config=c;return {};}})});
 const google=pathname.startsWith('/auth/');assert.equal(config.auth.flowType,google?'pkce':'implicit');const admin=pathname.startsWith('/admin');assert.equal(config.auth.detectSessionInUrl,!google&&!admin);assert.equal(config.auth.storageKey,`sb-example-auth-token${admin?'-admin':''}`);
 config.auth.storage.setItem(config.auth.storageKey,JSON.stringify({access_token:'studio-session',provider_token:'do-not-retain',provider_refresh_token:'do-not-retain'}));
 const saved=JSON.parse(sessionStorage.getItem(config.auth.storageKey));assert.equal(saved.access_token,'studio-session');assert.equal(saved.provider_token,undefined);assert.equal(saved.provider_refresh_token,undefined);assert.equal(localStorage.getItem('sb-example-auth-token'),null);
 config.auth.storage.setItem('sb-example-auth-token-code-verifier','verifier');assert.equal(config.auth.storage.getItem('sb-example-auth-token-code-verifier'),'verifier');checks++;
}
console.log(`PASS: ${checks} Google-auth security and lifecycle checks; no live credentials or network.`);

// Sessions from the other entry point must never be migrated or overwritten.
for (const pathname of ['/', '/admin/login']) {
 const localStorage=makeStorage(),sessionStorage=makeStorage();let config;const api={};
 const other=pathname==='/'?'sb-example-auth-token-admin':'sb-example-auth-token';
 localStorage.setItem(other,'other-portal-session');
 vm.runInNewContext(storageCompiled,{exports:api,URL,fetch(){throw new Error('No network');},window:{location:{pathname},localStorage,sessionStorage},require:id=>({createClient:(_url,_key,c)=>{config=c;return {};}})});
 api.setRememberMePreference(false);assert.equal(localStorage.getItem(other),'other-portal-session');assert.equal(sessionStorage.getItem(other),null);checks++;
}
console.log(`PASS: ${checks} auth lifecycle, customer/admin storage isolation and URL-token handling checks.`);
