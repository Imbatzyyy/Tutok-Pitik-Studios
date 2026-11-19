import { createHmac } from 'node:crypto';

const site = 'https://tutokpitikstudios.com';
const project = 'https://dhqxzrzjvgcmjjkmxlfs.supabase.co';
const services = [
  'portrait',
  'birthday',
  'event',
  'commercial',
  'landscape',
  'other',
];
const stages = [
  'service_view',
  'package',
  'signup_return',
  'slot',
  'submitted',
  'retry_failed',
  'inquiry',
];
const reply = (status, message) =>
  Response.json(
    { message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );

export default async function contact(request, context) {
  if (request.method !== 'POST') return reply(405, 'POST required.');
  if (request.headers.get('origin') !== site)
    return reply(403, 'Open the studio website to continue.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply(415, 'JSON required.');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !key ||
    !context.ip ||
    process.env.VITE_SUPABASE_URL?.replace(/\/$/, '') !== project
  )
    return reply(503, 'Please try again later.');
  const headers = {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
  };
  const post = (path, body, extra = {}) =>
    fetch(project + '/rest/v1/' + path, {
      method: 'POST',
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
    });
  try {
    if (Number(request.headers.get('content-length')) > 10000)
      return reply(413, 'Message too long.');
    const text = await request.text();
    if (text.length > 6000) return reply(413, 'Message too long.');
    let input;
    try {
      input = JSON.parse(text);
    } catch {
      return reply(400, 'Invalid message.');
    }
    if (!input || !services.includes(input.service))
      return reply(400, 'Choose a service.');
    const count = input.kind === 'event';
    if (count && input.stage === 'inquiry') return reply(400, 'Invalid event.');
    if (!count && input.kind !== 'inquiry')
      return reply(400, 'Unknown request.');
    if (
      !stages.includes(input.stage) ||
      !['direct', 'search', 'social', 'referral'].includes(input.source) ||
      !['desktop', 'mobile'].includes(input.device)
    )
      return reply(400, 'Invalid event.');
    const hashed = createHmac('sha256', key)
      .update('studio-contact:' + input.kind + ':' + context.ip)
      .digest('hex');
    const limit = await post('rpc/studio_login_limit', {
      p_key: hashed,
      p_max: count ? 60 : 5,
    });
    if (!limit.ok) return reply(503, 'Please try again later.');
    if ((await limit.json()) !== true)
      return reply(
        429,
        'Too many requests. Please try later or contact the studio directly.',
      );
    if (!count) {
      const name = String(input.name || '').trim(),
        email = String(input.email || '').trim(),
        message = String(input.message || '').trim();
      if (
        (input.phone && !/^[+0-9 ()-]{7,22}$/.test(input.phone)) ||
        !name ||
        name.length > 100 ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        message.length < 5 ||
        message.length > 2000 ||
        !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(input.key) ||
        (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date))
      )
        return reply(400, 'Check the contact details and question.');
      const res = await post(
        'contact_messages?on_conflict=request_key',
        {
          name,
          email,
          message,
          request_key: input.key,
          reply_phone: input.phone || null,
          visit_source: input.optOut ? null : input.source,
          visit_device: input.optOut ? null : input.device,
          preferred_date: input.date || null,
          service: input.service,
          subject: input.service + ' photography inquiry',
        },
        { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      );
      if (!res.ok)
        return reply(
          503,
          'Your inquiry could not be verified. Retry or email the studio.',
        );
    }
    if (!count)
      return reply(
        200,
        input.phone
          ? 'Your inquiry is with the studio. We will reply by phone.'
          : 'Your inquiry is with the studio. We will reply by email.',
      );
    const metric = await post('rpc/studio_count_visit', {
      p_service: input.service,
      p_stage: count ? input.stage : 'inquiry',
      p_device: input.device,
      p_source: input.source,
    }).catch(() => null);
    if (!metric?.ok) return reply(503, 'Counter unavailable.');
    return reply(200, 'Recorded.');
  } catch {
    return reply(503, 'Please retry or contact the studio by email.');
  }
}
