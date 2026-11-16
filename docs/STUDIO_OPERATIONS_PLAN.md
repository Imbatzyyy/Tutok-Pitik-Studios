# Authorized studio operations upgrade

User approved the complete enhancement plan on 2026-11-16. Implementation is isolated in codex/studio-operations; production baseline 2b5a4309. Preserve manual GCash, existing records, public Google sign-in, email branding and /admin/login.

## Implementation and acceptance checklist

- [ ] Atomic scheduling, server-validated amounts, bounded availability and duplicate-submit protection
- [ ] Version-checked booking edits, preserved drafts and archival instead of routine deletion
- [ ] Private realtime invalidations, reconnect reconciliation and customer updates
- [ ] Daily action queue, saved views, team assignment and personal work
- [ ] Booking checklist, independent booking/payment/delivery states and due dates
- [ ] Immutable payment ledger, final payments, refund records, reversals and proof replacement
- [ ] Customer reschedule/cancellation requests with atomic approval and preserved original slot
- [ ] Preparation details, private reference uploads and calendar download
- [ ] Booking conversation, internal notes, notification centre and unread state
- [ ] Correct email deep links, reminder/delivery/request templates, signed provider events and delivery visibility
- [ ] Invited team accounts, enforced MFA, recovery and session controls
- [ ] Permissions on every action, audited changes and restricted sensitive exports
- [ ] Partial-day blocks, working hours and preparation/travel buffers
- [ ] Server-paged searching/filtering, client history and matching report exports
- [ ] Operational alerts, encrypted scheduled backups and isolated restoration check
- [ ] Desktop/mobile/keyboard/offline tests and staged production release

## Boundaries and practical defaults

No real payment is executed by the application; payment/refund actions record studio verification. No new paid subscription is purchased. Calendar integration starts with standard calendar-file export, requiring no Google account permissions. External Google Drive sharing is not silently changed; delivery requires a staff access-check acknowledgement. MFA enrollment and recovery-code safekeeping are performed by the account holder through the product. Private event messages contain refresh signals rather than customer records; RLS checks govern fresh reads.

## Release evidence

Record automated checks, live role and transaction tests, exact deployment revisions, preserved-data checks and remaining external/provider/account-holder steps here as work progresses. Do not mark an item complete based only on a UI control or untested configuration.

## Pre-release verification (2026-11-16)

- Four schema migrations execute together inside a rollback-only verification transaction. 28 business-rule and role/MFA assertions pass. No test notifications are committed.
- 206 Edge authorization cases plus retired booking-route checks pass; 89 booking-email checks and workflow template/recipient cases pass.
- 29 Google-auth checks, 40 database-health tests, 11 admin-login tests and 8 webhook/backup tests pass. TypeScript and production build pass.
- Baseline: five bookings, 11 public profiles/auth accounts, 12 portfolio records, zero pending email jobs.
- Encrypted baseline snapshot restored into isolated PostgreSQL WASM: 15 tables, 61 rows, 48 constraints. Source storage contains no objects; object encryption/hash recovery is covered with a fixture.
- Resend webhook approved by the owner and created for seven delivery events. Signing credential saved as a production Netlify secret. Backup encryption public key and trigger secret configured.
- Browser preview: desktop booking details, payment-review controls, refresh preserves a draft, save works; 390px iframe verifies responsive layout. This is viewport testing, not a physical-device test.
- Production cutover, live role/realtime checks, final encrypted backup and hosted endpoint verification remain pending.
