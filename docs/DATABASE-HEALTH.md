# Scheduled database availability check

The active Tutok Pitik Studios Supabase project is `dhqxzrzjvgcmjjkmxlfs`. On November 16, 2026, the Management API reported `ACTIVE_HEALTHY` and its organization plan as `free`.

Netlify runs `database-health` from the published production deploy at `17 */6 * * *` UTC: 00:17, 06:17, 12:17 and 18:17. In Asia/Manila these are **02:17, 08:17, 14:17 and 20:17 every day**. No browser, local computer or ChatGPT session needs to remain open. Netlify documents that schedules run only on published production deploys; branch and preview deploys do not run on a schedule.

The function makes one HTTPS `HEAD` request to the active project's Data API, querying the existing public portfolio table with `select=id&limit=1`. This exercises a database read without returning rows or downloading images. It does not read customer tables, create or update records, invoke the email worker, send mail or change the website interface.

## Security and request limits

- Uses the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Netlify's function runtime. Their existing functions scope was verified. No additional credential is created and no service-role/database password is needed.
- Allows only the exact production Supabase origin (with optional trailing slash). Rejects other origins, insecure HTTP, paths and userinfo before sending the key.
- Accepts a public publishable key or the project's legacy anonymous JWT. Rejects service-role JWTs and JWTs for other projects. Database row policies remain in force.
- `HEAD`, `limit=1`, no count preference, no response-body parsing, no Realtime connection and no redirects. Only HTTP 200/206 with JSON content type count as success.
- 10-second timeout per request; at most one retry for a transport/timeout or 5xx failure. There are normally four database requests a day, with an upper bound of eight during transient failures.
- Logs only a fixed success or sanitized failure message; no keys, customer data, response bodies or raw provider errors. The handler returns a bodyless 204 on success or 503 on failure.
- Netlify protects scheduled functions from direct public URL invocation. The authenticated dashboard's **Run now** is the supported manual verification path.

## Reliability limits

This is a **best-effort activity safeguard**, not a setting that disables Supabase's Free-plan pausing. Supabase says a few daily database requests usually provide sufficient activity but does not guarantee that. Paid plans are the supported way to avoid inactivity pausing. Pro currently starts at US$25/month, with actual cost dependent on organization/projects and usage. No subscription or billing setting was changed.

This function cannot resume a project that Supabase has already paused. It reports failure instead. Recovery requires resuming the project in Supabase; do not assume that a request automatically wakes it. The existing Supabase email-retry cron is also not an external availability guarantee and cannot run while its database is paused.

The check depends on Netlify hosting/scheduling, available quotas, the configured runtime variables and the portfolio schema remaining available. This release does not add email alerts or replace Supabase's pause-warning emails. A successful manual invocation verifies the deployed function today; future scheduled execution remains dependent on those services.

## Operations and validation

1. Open Netlify → `tutokpitikstudios` → Functions → `database-health`.
2. Confirm the **Scheduled** badge, schedule and next run.
3. Select **Run now** to verify runtime configuration. A successful run logs `Database health check succeeded (read-only, no response body).`
4. If it fails, inspect the sanitized failure class. Confirm project status and runtime configuration without copying credentials into logs or chat.
5. To disable, remove `netlify/functions/database-health.mjs` and publish the change. No database migration is required.

Run `npm run test:database-health` for the 40 offline checks, including malformed/misrouted configuration, anonymous key enforcement, bounded retry, timeout wiring, redirects, unexpected content type and bodyless output. Netlify's existing required build command now includes this test suite.

Sources reviewed November 16, 2026:

- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/kb/faqs/platform/free-project-pausing
- https://supabase.com/pricing
- https://docs.netlify.com/build/functions/scheduled-functions/
