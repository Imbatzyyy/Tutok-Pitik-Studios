import { checkDatabase } from '../lib/database-health.mjs';

// UTC 00:17, 06:17, 12:17, 18:17. Manila 08:17, 14:17, 20:17, 02:17.
// Netlify runs schedules only for published production deploys and blocks
// direct public URL invocation. No database/service-role secrets are needed.
export const config = { schedule: '17 */6 * * *' };

export default async function databaseHealth() {
  const ok = await checkDatabase();
  return new Response(null, {
    status: ok ? 204 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
