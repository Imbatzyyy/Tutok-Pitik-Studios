# Supabase migration handoff — 8 November 2026

The production website is https://tutokpitikstudios.com. Its active Supabase
project is `dhqxzrzjvgcmjjkmxlfs` (TutokPitikStudios). The former project is
`gsgngpcljdkemwkbotfn` (tutok-pitik-studios).

## Preserved data and services

| Dataset | Original records preserved |
| --- | ---: |
| Auth accounts and identities | 11 each |
| Public user profiles | 11 |
| Bookings | 5 |
| Portfolio images | 12 |
| Favorites | 6 |
| Contact messages | 0 |
| Original storage buckets and objects | 0 |

Original IDs, password hashes, profile fields, booking fields, embedded images,
auth records, and relationships were preserved. The original public schema,
indexes, policies, triggers, and functions were compared before applying the
website compatibility changes. Platform-owned schema migration ledgers remain
managed by Supabase rather than being overwritten with older versions.

The production Edge Function `make-server-032fda65` and all 16 custom secrets
were transferred. Secret hashes match the source. Temporary migration and
validation functions were removed. The website's required storage buckets now
exist: `profile-pictures` and `portfolio` are public; `payment-receipts` is private
and limits files to 5 MiB.

## Application compatibility and access fixes

The two SQL files under `supabase/migrations` were applied after restoring the
source schema. They add the website's availability functions, testimonials,
blocked dates, missing columns, and storage policies. They also preserve the
source's suspended account status, prevent signup metadata from granting an
admin role, prevent self-promotion, replace overlapping permissive policies,
support favorite and file replacement operations, and add the Edge Function's
service-only key-value table.

The deployed Edge Function accepts both historical superadmin role spellings,
rejects inactive and suspended profiles, limits account administration to
superadmins, and corrects its SMTP configuration lookup.

These SQL files assume the restored original schema. They are not an independent
bootstrap for an empty project. Do not run historical schema restore scripts
against the live destination.

## Verification

- Initial restored data matched source table fingerprints; the final comparison
  confirmed preservation of original rows and fields after compatibility changes.
- Live isolated fixtures verified password sign-in, profile and booking
  isolation, booking creation and administration, availability without customer
  contact data, favorite upsert, profile and portfolio file replacement, private
  receipt authorization, testimonial visibility, blocked dates, and superadmin
  account management. All fixture users, records, and files were removed.
- The offline Hono suite covers 187 authorization cases without external calls.
- TypeScript checking and the production frontend build pass.
- The release patches Vite, Hono, DOMPurify, fflate, and affected build dependencies to address the dependency
  advisories found during the final audit. The deployed Hono version is pinned
  to the version exercised by the offline authorization suite. The complete npm
  audit reports zero known vulnerabilities at the time of release.
- The published frontend was checked for the destination endpoint and absence of
  the old project endpoint and server credentials. The live site was also
  inspected in the browser.

Existing account password hashes were preserved; actual customer passwords were
not used for testing. Existing browser sessions should sign in again after the
project change.

## Email exception accepted for this cutover

The existing Mailgun credentials fail provider authentication. The user chose to
continue with Supabase's default account-email service and keep the custom email
templates backed up. Supabase rejected applying custom templates without custom
SMTP for this project configuration.

Supabase's default sender only delivers to project team email addresses. General
customer signup confirmations and password recovery therefore need a working
custom SMTP provider. Booking emails using the invalid Mailgun credentials also
need that provider repaired. No real customer messages were sent during testing;
email delivery is not a passed acceptance check. Confirmation requirements were
not disabled. See [Supabase's SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

## Source retirement and recovery

The old project remains online with application-table and `auth.users` writes
blocked to prevent divergent data. It has not been paused or deleted. The new
website uses the destination independently of the source. Keep the source until
the owner is ready to end the recovery window, then pause it before considering
permanent deletion.

Private logical schema/data exports, configuration snapshots, original Edge
Function code, custom templates, parity evidence, and the source unfreeze script
are stored outside this repository in
`/Users/imbatzy/.codex/private/tutok-migration-2026-11-08`.
These contain credentials and customer data and must not be committed or shared
as public artifacts. This backup is a verified logical export, not a `pg_dump`
archive. Direct PostgreSQL connections were unavailable during this migration.

Returning traffic to the source would require reconciling any records written to
the destination after cutover, removing the source write guard, and rebuilding
the frontend with matching source configuration. Changing the project URL alone
would lose access to new destination activity.

## Deployment source

The release branch is `codex/supabase-migration`, based on the existing remote
`main` and containing the currently published redesigned website plus migration
fixes. It retains the repository exclusions already present on remote `main` and
updates affected dependencies to compatible patched versions. Netlify uses this
release branch for production;
the older `main` source does not contain the current website.

Only browser-safe `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in the
frontend. Netlify's Supabase variables were updated to the destination. Keep
service-role keys, JWT signing secrets, and provider passwords out of `VITE_*`
variables. `.env.example` documents the destination; `.env.local` remains private.
