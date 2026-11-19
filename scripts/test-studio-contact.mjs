import assert from 'node:assert/strict';
import { test } from 'node:test';
import contact from '../netlify/functions/studio-contact.mjs';

test('Inquiries enforce the studio origin and IP limit, preserve retry keys and respect analytics opt-out', async (t) => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only';
  process.env.VITE_SUPABASE_URL = 'https://dhqxzrzjvgcmjjkmxlfs.supabase.co';
  const calls = [];
  let limited = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({
      url,
      body: JSON.parse(options.body),
      headers: options.headers,
    });
    return Response.json(url.includes('studio_login_limit') ? !limited : []);
  });
  const request = (body, origin = 'https://tutokpitikstudios.com') =>
    contact(
      new Request(
        'https://tutokpitikstudios.com/.netlify/functions/studio-contact',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', origin },
          body: JSON.stringify(body),
        },
      ),
      { ip: '192.0.2.1' },
    );
  const inquiry = {
    kind: 'inquiry',
    name: 'Studio fixture',
    email: 'fixture@example.invalid',
    message: 'Please quote this session.',
    service: 'birthday',
    device: 'mobile',
    source: 'direct',
    stage: 'inquiry',
    key: '11111111-1111-4111-8111-111111111111',
    optOut: true,
  };
  assert.equal((await request(inquiry, 'https://example.invalid')).status, 403);
  assert.equal(calls.length, 0);
  for (let attempt = 0; attempt < 2; attempt++)
    assert.equal((await request(inquiry)).status, 200);
  const writes = calls.filter((call) => call.url.includes('contact_messages'));
  assert.equal(writes.length, 2);
  assert.equal(writes[0].body.request_key, writes[1].body.request_key);
  assert.equal(writes[0].body.visit_source, null);
  assert.equal(writes[0].body.visit_device, null);
  assert.match(writes[0].headers.Prefer, /ignore-duplicates/);
  assert.equal(
    calls.filter((call) => call.url.includes('studio_count_visit')).length,
    0,
  );
  limited = true;
  assert.equal((await request(inquiry)).status, 429);
  assert.equal(
    calls.filter((call) => call.url.includes('contact_messages')).length,
    2,
  );
});
