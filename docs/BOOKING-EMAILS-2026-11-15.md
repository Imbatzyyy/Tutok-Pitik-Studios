# Booking email release — 15 November 2026

The production website keeps the existing GCash QR image, receipt upload and
manual studio approval. No PayMongo checkout, payment key or webhook was deployed.
A submission acknowledgment is explicitly separate from payment verification and
booking approval.

## Email behavior

- Creating a booking queues an acknowledgment to the signed-in account's Auth
  email and a new-booking alert to `tutokpitikstudios@gmail.com`.
- The first transition to `confirmed` queues the customer confirmation.
- Emails use `Tutok Pitik Studios <bookings@mail.tutokpitikstudios.com>` and replies
  go to the studio Gmail address. Email content comes from database snapshots,
  not browser-supplied recipients or templates. Receipt metadata and images are
  excluded; staff open the authenticated dashboard to review payment.
- Existing bookings are not emailed retroactively. Retried requests and repeated
  status toggles do not create additional messages for the same event.

## Provider and security configuration

Resend's `mail.tutokpitikstudios.com` domain is verified. Its DKIM TXT and two
provider CNAME records are hosted at the existing Netlify DNS zone. Registrar and
nameservers were not changed for this release. Resend's enforced TLS setting is
enabled; recipients whose mail servers cannot negotiate TLS will not receive
plaintext delivery. TLS protects transport, not end-to-end mailbox access.

The dedicated Resend key has Sending access limited to this domain. It is stored
in Supabase server configuration, never in browser `VITE_*` variables or Git.
Booking delivery uses HTTPS; the scheduler's separate random token is in
Supabase Secrets and Vault. Database queue rows, claim functions and pg_net
request/response tables are not accessible to anonymous or customer roles.

The `booking-emails` function authenticates a real Supabase user and active
profile, checks booking ownership or studio-team membership, or requires the
private scheduled-worker token. Gateway JWT verification is disabled because the
function performs this authorization itself and the scheduler uses its dedicated
secret. HTML values are escaped and raw provider errors are not exposed.

Supabase Auth also uses the verified domain through Resend SMTP, TLS port 465,
with sender `accounts@mail.tutokpitikstudios.com`. Email verification remains
required; Auth sending is limited to 100 messages/hour. This replaces the default
team-address-only sender. All 13 Auth templates and their subjects now use the studio design; the original
templates remain backed up privately. The optional welcome and profile-update
notifications also use Resend and the shared template, with recipients and names
read from the authenticated account. Their old Mailgun path has been removed.

The unused legacy service-role signup endpoint is retired because it bypassed
email verification. The current website already uses Supabase Auth signup
directly. Existing security-notification enable/disable settings are preserved;
their templates are ready whenever those notifications are enabled.

Run `npm run email:templates` to regenerate `supabase/templates/auth-config.json`
and the 13 HTML sources from the shared design. The JSON is a non-secret
Management API patch containing templates, subjects and the 100/hour limit.
This Supabase Auth limit does not increase the Resend account subscription quota
or set a rate limit for application booking-email jobs.

## Queue and operations

The database transaction that saves the booking also inserts its email jobs. An
immediate authenticated request attempts delivery; `tps-booking-email-retry`
runs every minute using pg_cron, pg_net and Vault, so closing the browser cannot
lose the queued email. Empty queues cause no HTTP dispatch.

Jobs use a unique `(booking_id, kind)` pair, locked claims and a stable Resend
idempotency key. Temporary failures retry with backoff, at most eight attempts.
Ambiguous deliveries older than 23 hours or exhausted retries enter `review`
instead of risking duplicates beyond Resend's 24-hour deduplication window.
Operators should inspect failed/review rows and Resend delivery events before
retrying a message. `sent` in this queue means accepted by Resend; final delivery
and bounces are visible in Resend's dashboard. There is no automated bounce-sync
webhook in this release. Provider plan quotas still apply.

Non-sensitive queue check in the Supabase SQL editor:

```sql
select kind, state, count(*)
from public.booking_email_outbox
group by kind, state;
```

Apply `20261115000000_booking_emails.sql` to the restored studio schema, configure
server secrets, deploy `booking-emails` and the compatibility function, provision
Vault secret `tps_booking_email_worker`, then apply
`20261115010000_booking_email_schedule.sql`. Migrations contain no secret values.
For another Supabase project, replace the fixed project URL in the scheduler.
These migrations were applied to production through the management API; do not
blindly replay them with a CLI migration push.

## Verification

- 41 offline email checks cover escaped content, trusted recipients, request
  deduplication keys, queue processing and sanitized provider failures.
- Account-template checks verify HTML escaping and preservation of the secure
  Supabase action URLs and verification-code placeholders. Additional access
  tests verify the retired signup bypass and blocked anonymous email endpoints.
- 187 existing Hono authorization cases, TypeScript checking and the Vite 6.4.5
  production build passed; clean npm installation reported zero vulnerabilities.
- Transactional database fixtures verified queue uniqueness, grants, metadata
  exclusion and non-overlapping claims, then rolled back.
- Live fixture `TPS-51834D` sent a customer acknowledgment, studio alert and
  approval confirmation. Resend showed all three **Delivered**, with one attempt
  each. The scheduled worker sent the confirmation with HTTP 200.
- Live access checks rejected anonymous dispatch, unknown/invalid booking IDs,
  customer queue access and customer self-approval. Repeated dispatch sent zero
  additional messages. Both legacy frontend notification routes also work.
- The fixture uses the studio's Gmail plus-address; no actual customer was
  contacted and no money was moved. The test account and booking were removed.

Private configuration backups and provider evidence are outside Git under
`/Users/imbatzy/.codex/private/tutok-booking-emails-2026-11-15`.
