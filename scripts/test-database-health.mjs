import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDatabase, EXPECTED_ORIGIN } from '../netlify/lib/database-health.mjs';
import handler, { config } from '../netlify/functions/database-health.mjs';

const jwt = (claims) => `test.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
const anon = jwt({ role: 'anon', ref: 'dhqxzrzjvgcmjjkmxlfs' });
const valid = { VITE_SUPABASE_URL: EXPECTED_ORIGIN, VITE_SUPABASE_ANON_KEY: anon };
const reply = (status = 200, type = 'application/json; charset=utf-8', redirected = false) => ({
  status, redirected, headers: new Headers(type === null ? {} : { 'content-type': type }),
  json: () => { throw new Error('Must not read rows'); }, text: () => { throw new Error('Must not read a response body'); },
});
function harness(sequence = [reply()], env = valid) {
  const calls = [], logs = [], timeouts = [];
  return {
    calls, logs, timeouts,
    run: () => checkDatabase({
      env,
      fetchImpl: async (...args) => {
        calls.push(args);
        const item = sequence[Math.min(calls.length - 1, sequence.length - 1)];
        if (item instanceof Error) throw item;
        return item;
      },
      timeoutSignal: (ms) => { timeouts.push(ms); return new AbortController().signal; },
      logger: { info: (msg) => logs.push(msg), error: (msg) => logs.push(msg) },
    }),
  };
}

test('four runs per day with an off-hour UTC minute', () => assert.equal(config.schedule, '17 */6 * * *'));
test('bounded anonymous HEAD query, no response rows or count and no redirects', async () => {
  const h = harness(); assert.equal(await h.run(), true); assert.equal(h.calls.length, 1);
  const [url, opts] = h.calls[0];
  assert.equal(url, `${EXPECTED_ORIGIN}/rest/v1/portfolio_images?select=id&limit=1`);
  assert.equal(opts.method, 'HEAD'); assert.equal(opts.redirect, 'error'); assert.equal(opts.cache, 'no-store');
  assert.deepEqual(opts.headers, { apikey: anon, Accept: 'application/json' });
  assert.equal(opts.body, undefined); assert.equal(opts.signal.aborted, false);
  assert.deepEqual(h.timeouts, [10_000]);
  assert.deepEqual(h.logs, ['Database health check succeeded (read-only, no response body).']);
});
for (const origin of [undefined, '', 'http://dhqxzrzjvgcmjjkmxlfs.supabase.co', 'https://other.supabase.co', `${EXPECTED_ORIGIN}.evil.test`, `${EXPECTED_ORIGIN}/rest/v1`, `${EXPECTED_ORIGIN}?secret=value`, 'https://user:pass@dhqxzrzjvgcmjjkmxlfs.supabase.co']) {
  test(`reject invalid origin ${String(origin)}`, async () => {
    const h = harness([], { ...valid, VITE_SUPABASE_URL: origin }); assert.equal(await h.run(), false); assert.equal(h.calls.length, 0); assert.deepEqual(h.logs, ['Database health check failed (configuration).']);
  });
}
for (const key of [undefined, '', 'not-a-key', 'sb_secret_must-not-send', jwt({role:'service_role',ref:'dhqxzrzjvgcmjjkmxlfs'}), jwt({role:'anon',ref:'wrong-project'}), 'test.invalid-json.signature', `${anon}\n`]) {
  test(`reject unsuitable key case ${String(key).slice(0,15)}`, async () => {
    const h = harness([], { ...valid, VITE_SUPABASE_ANON_KEY: key }); assert.equal(await h.run(), false); assert.equal(h.calls.length, 0); assert.deepEqual(h.logs, ['Database health check failed (configuration).']);
  });
}
test('accept trailing slash and a publishable key without bearer-token assumptions', async () => {
  const h = harness([reply(206)], { VITE_SUPABASE_URL: `${EXPECTED_ORIGIN}/`, VITE_SUPABASE_ANON_KEY:'sb_publishable_testOnly' });
  assert.equal(await h.run(), true); assert.equal(h.calls[0][1].headers.apikey, 'sb_publishable_testOnly');
});
for (const status of [201, 204, 301, 302, 307, 400, 401, 403, 404, 429]) {
  test(`HTTP ${status} fails without retry`, async () => {
    const h = harness([reply(status)]); assert.equal(await h.run(), false); assert.equal(h.calls.length, 1);
  });
}
for (const failure of [new Error('network with private credentials'), Object.assign(new Error('timeout'), {name:'TimeoutError'}), reply(500), reply(503)]) {
  test(`one retry can recover from ${failure.status || failure.name}`, async () => {
    const h = harness([failure, reply()]); assert.equal(await h.run(), true); assert.equal(h.calls.length, 2); assert.deepEqual(h.timeouts, [10_000, 10_000]);
  });
}
test('persistent network failure is bounded and logs no credentials or raw error', async () => {
  const h = harness([new Error(`private error ${anon} https://private.example.test`)]);
  assert.equal(await h.run(), false); assert.equal(h.calls.length, 2);
  assert.deepEqual(h.logs, ['Database health check failed (network or timeout).']);
});
test('persistent server failure is bounded', async () => {
  const h = harness([reply(503)]); assert.equal(await h.run(), false); assert.equal(h.calls.length, 2); assert.deepEqual(h.logs, ['Database health check failed (HTTP 503).']);
});
for (const type of [null, 'text/html', 'application/jsonp']) {
  test(`unexpected content type ${type} is rejected`, async () => {
    const h = harness([reply(200,type)]); assert.equal(await h.run(), false); assert.equal(h.calls.length,1);
  });
}
test('redirected response is rejected', async () => {
  const h = harness([reply(200,'application/json',true)]); assert.equal(await h.run(),false); assert.equal(h.calls.length,1);
});
test('scheduled handler returns bodyless 204/503 and does not expose upstream output', async () => {
  const oldFetch = globalThis.fetch, oldInfo=console.info, oldError=console.error;
  const oldUrl=process.env.VITE_SUPABASE_URL, oldKey=process.env.VITE_SUPABASE_ANON_KEY;
  try {
    process.env.VITE_SUPABASE_URL=EXPECTED_ORIGIN; process.env.VITE_SUPABASE_ANON_KEY=anon;
    console.info=()=>{}; console.error=()=>{}; globalThis.fetch=async()=>reply();
    const good=await handler(); assert.equal(good.status,204); assert.equal(await good.text(),''); assert.equal(good.headers.get('cache-control'),'no-store');
    globalThis.fetch=async()=>reply(401); const bad=await handler(); assert.equal(bad.status,503); assert.equal(await bad.text(),'');
  } finally {
    globalThis.fetch=oldFetch; console.info=oldInfo; console.error=oldError;
    if(oldUrl===undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL=oldUrl;
    if(oldKey===undefined) delete process.env.VITE_SUPABASE_ANON_KEY; else process.env.VITE_SUPABASE_ANON_KEY=oldKey;
  }
});
