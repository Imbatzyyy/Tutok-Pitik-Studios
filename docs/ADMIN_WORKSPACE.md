# Studio workspace

Production team sign-in: https://tutokpitikstudios.com/admin/login

Customer sign-in and Google identity remain customer-only. A team account entered in the public form receives a generic sign-in error. The admin workspace uses a separate session-storage key, rejects tokens in the URL and requires its own password sign-in. It does not offer public team registration.

| Role | Capabilities |
| --- | --- |
| Super admin | All workspace sections; create/manage accounts, roles and account status |
| Admin | Overview, bookings, payment review, booked clients, portfolio, availability, testimonials, website inquiries and activity |
| Staff | Overview, booking review and payment verification, booking status and photo delivery, booking activity |

Only admins and superadmins may delete bookings or manage public content. The account directory is restricted to superadmins. Staff see the client details needed for bookings. The accounts screen explains the roles, prevents self-demotion/deactivation and offers existing password-reset functionality.

## Session authorization

`netlify/functions/admin-login.mjs` accepts same-origin JSON POST requests. It uses the existing server-only Supabase service credential for atomic database rate limits and session registration; password verification uses the public Auth endpoint. The response contains only the successful session's access and refresh tokens, with no-store headers. Passwords and provider errors are not logged.

The private `studio_private.admin_sessions` table binds the verified Supabase `session_id` to the team user for at most eight hours. Registration/validation RPCs are callable only with the service role. RLS helpers and both authenticated Edge Function entry points enforce this binding against the live Auth session, current account role and active status. URL changes, user metadata or a normal customer-portal login cannot supply the binding. Signing out, deleting the Auth session, or changing role/status invalidates it. Role/status changes do not restore old access when reverted.

Supabase's session documentation: https://supabase.com/docs/guides/auth/sessions

The portal checks authorization on entry, token refresh, tab visibility and once a minute. Database and server writes still enforce current authorization on every request. Existing customer JWTs never gain team permissions. Admin resources have no-store and noindex response headers; these headers complement authorization and are not access controls themselves.

## Operations and data semantics

Bookings refresh every minute while visible. Refresh data reloads bookings and the account directory when permitted. Activity and inquiries have their own refresh buttons and show the latest 100 records. Bookings/accounts are fetched in stable 500-row pages, with an explicit failure above 50,000 records instead of silent truncation.

Verified downpayments mean non-cancelled bookings whose manual GCash payment status is verified. Scheduled balances are balances on confirmed bookings, not received cash. There is no automated payment gateway in this release. Payment verification and confirmation still require the studio to review the receipt. Existing branded booking emails, customer confirmation and gallery delivery stay connected.

The activity table records new changes from this release onward; it does not invent historical records. It stores resource IDs, action, actor role and status transitions, not full receipts or client messages. Service-role operations appear as System / server operation. Existing Gmail/Messenger conversations remain in their own apps; inquiries show existing website inquiry records.

## Validation and release

- `npm run typecheck`
- `npm run test:edge-access`
- `npm run test:booking-emails`
- `npm run test:google-auth`
- `npm run test:database-health`
- `npm run test:admin-login`
- `npm run build`
- `scripts/test-admin-portal.sql` runs only inside its rollback transaction after the migration exists. Fixtures use reserved IDs and example.invalid addresses; no booking email jobs are inserted.

Apply migration `20261116020000_admin_portal.sql`, deploy both changed Edge Functions and deploy the Netlify site including `admin-login`. Existing team sessions must sign in again through the new address. Never expose the service-role key through a VITE-prefixed variable, source control or client bundle.

For UI checks, use `VITE_DEMO_MODE=true npm run dev` locally. Demo credentials and fictional records are excluded from production builds. Never enable this flag on Netlify.
