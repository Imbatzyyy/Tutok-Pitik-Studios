# Google sign-in — 16 November 2026

Google sign-in uses Supabase Auth in production project `dhqxzrzjvgcmjjkmxlfs`.
The dedicated Google Cloud project is `tutok-pitik-studios-auth`. Its web client
allows the studio origin and the exact Supabase `/auth/v1/callback` endpoint.
The client secret is stored only in Supabase's server provider configuration.
No Google secret is bundled, committed, or configured through `VITE_*`.

## Flow and compatibility

Both sign-in and create-account screens offer Continue with Google. Google
supplies basic identity through `openid email profile`; no Gmail, contacts,
Drive, calendar or offline-access permissions are requested. Google tokens are
removed before session persistence. Account roles come from the database, never
Google or editable user metadata. New accounts are always customers.

A full-page navigation to `/auth/google` selects a PKCE client configuration;
`/auth/callback` explicitly exchanges the one-use code, then removes it from
browser history. The callback requires a same-tab, 10-minute attempt record and
returns only to `/` or `/#contact`. Arbitrary return URLs and raw provider errors
are not accepted. Booking drafts already persist in session storage. Session-only
storage is the default unless Keep me signed in is selected.

Email confirmation and recovery retain the existing implicit configuration on
other routes, so emailed links continue working across devices. Email verification
and the Auth email limit of 100/hour remain enabled. Automatic verified-email
identity linking is handled by Supabase; manual linking remains disabled.

The app includes public privacy and terms routes linked from the Google consent
screen and footer. Google support contact is the owner account permitted by the
console (`princebalane19@gmail.com`); developer notifications and site support
use `tutokpitikstudios@gmail.com`.

## Privacy and security

The production tables already had RLS enabled and payment receipts were private.
The accompanying migration makes profile pictures private, adds authorized team
reading, and restricts suspended/inactive users from accessing bookings,
favorites or private uploads and from updating profiles. Profile images resolve
to one-hour signed URLs. Existing public avatar paths remain compatible through
authenticated resolution; no profile-image objects existed at inspection time.

Browser responses add CSP, HSTS and restrictive device permission headers.
Authentication and recovery pages disable caching and referrer transmission.
Supabase documents AES-256 encryption at rest and TLS transport. A live database
query confirmed the management connection uses SSL. This is provider-managed
encryption and access control, not end-to-end encryption or a guarantee that no
account can ever be compromised. Authorized studio staff can manage bookings.

## Validation

- TypeScript and production build.
- 24 offline Google lifecycle/security checks, including real SDK S256 PKCE
  generation, blocked arbitrary destinations, expiry, cancellation, duplicate
  callback rejection, sanitized errors and Google-token removal.
- Existing 187 authorization cases and 41 booking-email checks.
- Transactional production database rehearsal for customer creation, anonymous
  denial, cross-account isolation, privilege escalation, queue denial, suspended
  access and authorized team photo access; every fixture rolled back.

Production deployment and real Google return verification are recorded after
release below. No payment flow or booking-email business logic was changed.
