// Offline integration tests: real Hono routing, isolated Edge module, fake services only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const emailModule = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../supabase/functions/_shared/email.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:emailModule});
const portalModule={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../supabase/functions/_shared/admin-session.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:portalModule,atob});
const token='fixture.'+Buffer.from(JSON.stringify({aal:'aal2',sub:'actor',session_id:'11111111-1111-4111-8111-111111111111'})).toString('base64url')+'.signature';
const source = readFileSync(new URL('../supabase/functions/make-server-032fda65/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.length, 0, 'Edge module must transpile');
const routes = [
  ['POST', '/users', { email: 'fixture@example.invalid', role:'staff', fullName: 'Fixture' }],
  ['GET', '/users/all'],
  ['PUT', '/users/target', { fullName: 'Updated fixture', role: 'customer' }],
  ['DELETE', '/users/target'],
];
function harness({ role = 'superadmin', status = 'active', missing = false, lookupError = false, invalid = false, portal = true, portalError = false } = {}) {
  const events = [];
  const profile = { id: 'actor', role, status };
  const supabase = {
    rpc:async (name,args)=>{assert.equal(name,"studio_admin_session_valid");assert.equal(args.p_user_id,"actor");return {data:portal,error:portalError?{message:"offline failure"}:null};},
    auth: {
      getUser: async () => {
        events.push('auth.lookup');
        return { data: { user: invalid ? null : { id: 'actor' } }, error: invalid ? { message: 'invalid' } : null };
      },
      admin: {
        inviteUserByEmail: async (email,options) => { events.push('auth.create'); return { data: { user: { id: 'target' } }, error: null }; },
        updateUserById: async () => { events.push('auth.update'); return { error: null }; },
        deleteUser: async () => { events.push('auth.delete'); return { error: null }; },
      },
    },
    from(table) {
      assert.equal(table, 'users');
      let changes = {};
      const query = {
        select() { return query; },
        eq() { return query; },
        update(values) { events.push('db.update'); changes = values; return query; },
        async maybeSingle() {
          events.push('profile.lookup');
          return { data: missing ? null : profile, error: lookupError ? { message: 'fixture failure' } : null };
        },
        async single() { return { data: { id: 'target', ...changes }, error: null }; },
        async order() { events.push('db.list'); return { data: [{ id: 'target' }], error: null }; },
      };
      return query;
    },
  };
  let handler;
  let forbiddenIO = 0;
  const blockIO = () => { forbiddenIO++; throw new Error('External I/O forbidden'); };
  const modules = {
    'npm:hono@4.13.17': { Hono }, 'npm:hono@4.13.17/cors': { cors }, 'npm:hono@4.13.17/logger': { logger },
    'npm:@supabase/supabase-js': { createClient: () => supabase },
    '../_shared/email.ts': emailModule,
    '../_shared/admin-session.ts': portalModule,
    './kv_store.tsx': { del: async (key) => { events.push(`kv.delete:${key}`); } },
  };
  const context = vm.createContext({
    exports: {}, Request, Response, Headers, URL, AbortSignal, fetch: blockIO,
    console: { log() {}, error() {}, warn() {} },
    Deno: { env: { get: () => undefined }, serve: (fn) => { handler = fn; } },
    require: (name) => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected import: ${name}`);
      return modules[name];
    },
  });
  vm.runInContext(compiled.outputText, context, { timeout: 1000 });
  return {
    events, profile,
    async request(method, path, body, authenticated = true) {
      const headers = new Headers();
      if (authenticated) headers.set('Authorization', `Bearer ${token}`);
      if (body) headers.set('Content-Type', 'application/json');
      const response = await handler(new Request(`http://offline.invalid/make-server-032fda65${path}`, {
        method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
      }));
      assert.equal(forbiddenIO, 0, 'No mail or network call may be attempted');
      return response;
    },
  };
}
let cases = 0;
for (const [method, path, body] of routes) {
  for (const role of ['superadmin', 'super_admin', 'admin', 'staff', 'customer', 'guest', 'unknown']) {
    for (const status of ['active', 'inactive', 'suspended', null, undefined, '']) {
      const h = harness({ role, status });
      h.profile.status = status;
      const active = (status ?? 'active') === 'active';
      const allowed = active && ['superadmin', 'super_admin'].includes(role);
      const retired=method==='DELETE';
      const expected = !active ? 401 : retired ? 410 : allowed ? 200 : 403;
      const response = await h.request(method, path, body);
      assert.equal(response.status, expected, `${method} ${path}: ${role}/${status}`);
      const payload = await response.json();
      if (allowed&&!retired) {
        assert.equal(payload.success, true);
        const effect = { POST: 'auth.create', GET: 'db.list', PUT: 'auth.update', DELETE: 'auth.delete' }[method];
        assert.ok(h.events.includes(effect), `Allowed ${method} must execute operation`);
        if (method === 'DELETE') assert.equal(h.events.filter(e => e.startsWith('kv.delete:')).length, 3);
      } else {
        assert.deepEqual(h.events, ['auth.lookup', 'profile.lookup'], 'Denied requests must stop before listing or mutation');
      }
      assert.equal(h.profile.role, role, 'Normalization must not mutate stored profile');
      cases++;
    }
  }
  for (const options of [{ missing: true }, { lookupError: true }, { invalid: true }]) {
    const h = harness(options);
    assert.equal((await h.request(method, path, body)).status, 401);
    assert.ok(h.events.every(e => ['auth.lookup', 'profile.lookup'].includes(e)));
    cases++;
  }
  const h = harness();
  assert.equal((await h.request(method, path, body, false)).status, 401);
  assert.deepEqual(h.events, []);
  cases++;
}
for (const role of ['superadmin', 'super_admin']) {
  const h = harness({ role });
  assert.equal((await h.request('DELETE', '/users/actor')).status, 410);
  assert.deepEqual(h.events, ['auth.lookup', 'profile.lookup']);
  cases++;
}
const health = harness();
assert.equal((await health.request('GET', '/health', undefined, false)).status, 200);
assert.deepEqual(health.events, []);
cases++;
console.log(`PASS: ${cases} offline Hono route cases; no credentials, network, mail, or real data access.`);

const legacySignup = harness();
assert.equal((await legacySignup.request('POST', '/auth/signup', {email:'fixture@example.invalid'}, false)).status, 410);
assert.deepEqual(legacySignup.events, []);
for (const route of ['/send-welcome-email','/send-profile-update-email']) {
 const h = harness();
 assert.equal((await h.request('POST', route, {}, false)).status, 401);
 assert.deepEqual(h.events, []);
}
console.log('Legacy signup bypass is retired; unauthenticated account-email requests are blocked.');

for(const role of ['superadmin','super_admin','admin','staff']){
 for(const options of [{portal:false},{portalError:true}]){
  const h=harness({role,...options});assert.equal((await h.request('GET','/users/all')).status,401);
  assert.deepEqual(h.events,['auth.lookup','profile.lookup']);cases++;
 }
}
for(const updates of [{role:'customer'},{status:'inactive'},{role:'owner'},{status:'unknown'}]){
 const h=harness();assert.equal((await h.request('PUT','/users/actor',updates)).status,400);assert.deepEqual(h.events,['auth.lookup','profile.lookup']);cases++;
}
for(const method of ['POST','PUT','DELETE']){
 const h=harness({role:'staff'});assert.equal((await h.request(method,method==='POST'?'/portfolio':'/portfolio/target',{})).status,403);cases++;
}
for(const badToken of ['', 'malformed', 'x.'+Buffer.from(JSON.stringify({aal:'aal1',sub:'actor',session_id:'11111111-1111-4111-8111-111111111111'})).toString('base64url')+'.s', 'x.'+Buffer.from(JSON.stringify({sub:'other',session_id:'11111111-1111-4111-8111-111111111111'})).toString('base64url')+'.s']) {
 assert.equal(await portalModule.hasPortalSession({rpc:()=>{throw new Error('Must not query');}},badToken,'actor'),false);cases++;
}
console.log(`PASS: ${cases} total edge authorization cases including portal binding, revocation errors, staff content restrictions and self-lockout.`);

for(const [method,path] of [['POST','/bookings'],['PUT','/bookings/target'],['DELETE','/bookings/target'],['GET','/bookings/all']]){const h=harness();assert.equal((await h.request(method,path,method==='GET'?undefined:{})).status,410);assert.deepEqual(h.events,['auth.lookup','profile.lookup']);}
console.log('Legacy booking mutations are retired; no service-role bypass can skip the validated RPCs.');
