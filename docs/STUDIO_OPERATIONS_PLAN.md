# Authorized studio operations upgrade

User approved the complete enhancement plan on 2026-11-16. Implementation is isolated in codex/studio-operations; production baseline 2b5a4309. Preserve manual GCash, existing records, public Google sign-in, email branding and /admin/login.

## Implementation and acceptance checklist

- [x] Atomic scheduling, server-validated amounts, bounded availability and duplicate-submit protection
- [x] Version-checked booking edits, preserved drafts and archival instead of routine deletion
- [x] Private realtime invalidations, reconnect reconciliation and customer updates
- [x] Daily action queue, saved views, team assignment and personal work
- [x] Booking checklist, independent booking/payment/delivery states and due dates
- [x] Immutable payment ledger, final payments, refund records, reversals and proof replacement
- [x] Customer reschedule/cancellation requests with atomic approval and preserved original slot
- [x] Preparation details, private reference uploads and calendar download
- [x] Booking conversation, internal notes, notification centre and unread state
- [x] Correct email deep links, reminder/delivery/request templates, signed provider events and delivery visibility
- [x] Invited team accounts, enforced MFA, recovery and session controls
- [x] Permissions on every action, audited changes and restricted sensitive exports
- [x] Partial-day blocks, working hours and preparation/travel buffers
- [x] Server-paged searching/filtering, client history and matching report exports
- [x] Operational alerts, encrypted scheduled backups and isolated restoration check
- [x] Desktop and mobile-width browser checks, keyboard-accessible controls, draft retention and production release
- [ ] Physical-device and forced network-loss rehearsal (not claimed by the browser-width test)

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
- Initial production cutover completed at revision 7b9c0152; follow-up file/audit corrections are included with this document. Netlify runs the complete test gate before publishing.
- Live temporary accounts: 60 MFA, role, RLS, Edge, recovery and private realtime checks pass. The production browser reaches Overview with the Live indicator after password + TOTP.
- Final transactional regression: 36 checks pass, adding scoped file reads, immutable receipts, midnight clamping and owner-attributed account auditing. All SQL fixtures are rolled back.
- Live storage: 14 assertions pass across private PDF upload, expiring signed download, unrelated-user rejection, immutable bytes and public denial. Fixture objects are removed.
- Two simultaneous reservation attempts accept exactly one row; the database exclusion constraint rejects the other. Fixture mail jobs are removed in the inserting transaction, then the test row is deleted.
- The deployed account endpoint changes a fixture role and restores it; both audit entries identify the acting owner.
- Signed webhook fixture accepted; replay deduplicated into one event. Missing signatures rejected. This validates the receiving endpoint, not an actual provider email delivery. Synthetic health status is reset to configured/awaiting provider delivery after cleanup.
- Hosted encrypted backup downloaded and restored into isolated PostgreSQL WASM; first hosted copy included temporary verification accounts. A final clean copy and preserved-data comparison are part of release cleanup.
- Physical-device behavior, actual mailbox receipt, external gallery permissions and the next unattended scheduled-backup execution remain external acceptance checks. No live customer booking or email is created for verification.
