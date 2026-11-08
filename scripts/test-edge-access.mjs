// Offline integration tests: real Hono routing, isolated Edge module, fake services only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const source = readFileSync(new URL('../supabase/functions/make-server-032fda65/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.length, 0, 'Edge module must transpile');
const routes = [
  ['POST', '/users', { email: 'fixture@example.invalid', password: 'offline-fixture', fullName: 'Fixture' }],
  ['GET', '/users/all'],
  ['PUT', '/users/target', { fullName: 'Updated fixture', role: 'customer' }],
  ['DELETE', '/users/target'],
];
function harness({ role = 'superadmin', status = 'active', missing = false, lookupError = false, invalid = false } = {}) {
  const events = [];
  const profile = { id: 'actor', role, status };
  const supabase = {
    auth: {
      getUser: async () => {
        events.push('auth.lookup');
        return { data: { user: invalid ? null : { id: 'actor' } }, error: invalid ? { message: 'invalid' } : null };
      },
      admin: {
        createUser: async () => { events.push('auth.create'); return { data: { user: { id: 'target' } }, error: null }; },
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
    'npm:nodemailer': { createTransport: blockIO },
    './kv_store.tsx': { del: async (key) => { events.push(`kv.delete:${key}`); } },
  };
  const context = vm.createContext({
    exports: {}, Request, Response, Headers, URL, fetch: blockIO,
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
      if (authenticated) headers.set('Authorization', 'Bearer offline-token');
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
      const expected = !active ? 401 : allowed ? 200 : 403;
      const response = await h.request(method, path, body);
      assert.equal(response.status, expected, `${method} ${path}: ${role}/${status}`);
      const payload = await response.json();
      if (allowed) {
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
  assert.equal((await h.request('DELETE', '/users/actor')).status, 400);
  assert.deepEqual(h.events, ['auth.lookup', 'profile.lookup']);
  cases++;
}
const health = harness();
assert.equal((await health.request('GET', '/health', undefined, false)).status, 200);
assert.deepEqual(health.events, []);
cases++;
console.log(`PASS: ${cases} offline Hono route cases; no credentials, network, mail, or real data access.`);
