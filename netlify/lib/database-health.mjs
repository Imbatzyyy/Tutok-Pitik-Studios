// This is a low-egress activity/availability check, not a no-pause guarantee.
export const EXPECTED_ORIGIN = 'https://dhqxzrzjvgcmjjkmxlfs.supabase.co';
const PROJECT_REF = 'dhqxzrzjvgcmjjkmxlfs';
const QUERY = '/rest/v1/portfolio_images?select=id&limit=1';
const TIMEOUT_MS = 10_000;

function isAnonymousKey(key) {
  if (typeof key !== 'string' || key !== key.trim()) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    // Do not allow an accidentally configured service-role JWT to bypass RLS.
    return claims.role === 'anon' && claims.ref === PROJECT_REF;
  } catch {
    return false;
  }
}

export async function checkDatabase({ env = process.env, fetchImpl = fetch, logger = console, timeoutSignal = AbortSignal.timeout } = {}) {
  const origin = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  // An exact allowlist prevents credentials being sent to a different server.
  if ((origin !== EXPECTED_ORIGIN && origin !== `${EXPECTED_ORIGIN}/`) || !isAnonymousKey(key)) {
    logger.error('Database health check failed (configuration).');
    return false;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(`${EXPECTED_ORIGIN}${QUERY}`, {
        method: 'HEAD',
        headers: { apikey: key, Accept: 'application/json' },
        redirect: 'error',
        cache: 'no-store',
        signal: timeoutSignal(TIMEOUT_MS),
      });
    } catch {
      // One bounded retry for transport failure/timeout; never log provider errors.
      if (attempt === 0) continue;
      logger.error('Database health check failed (network or timeout).');
      return false;
    }

    if (response.status >= 500 && response.status <= 599 && attempt === 0) continue;
    if (response.status !== 200 && response.status !== 206) {
      logger.error(`Database health check failed (HTTP ${response.status}).`);
      return false;
    }
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (response.redirected || contentType !== 'application/json') {
      logger.error('Database health check failed (unexpected response).');
      return false;
    }
    // HEAD executes the bounded database read but transfers no portfolio rows.
    logger.info('Database health check succeeded (read-only, no response body).');
    return true;
  }
  return false;
}
