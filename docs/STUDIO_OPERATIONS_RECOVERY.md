# Studio operations and recovery

## Access and daily use

Use `https://tutokpitikstudios.com/admin/login`. Team accounts sign in with their own password and an authenticator. On first use, enroll an authenticator; then open **Security & health** and save the eight recovery codes privately. Generating new codes invalidates the old set. Recovery requires a fresh password sign-in and one unused code; it revokes every workspace session before resetting the lost authenticator. Studio bindings expire after eight hours.

Staff see their assigned shoots, editing and support work. Admins manage scheduling, finances, content and reports. Super admins additionally invite team members, change roles, suspend accounts and grant staff permission to verify payments. A role or status change revokes the account's existing workspace bindings.

Start with **Overview**, then use the booking views or calendar. Each booking has independent reservation, payment and gallery states, a preparation brief, private files, a conversation, an internal team note channel and a change history. A stale save fails without discarding the draft. Requests hold the existing slot until an approved reschedule commits. A pending booking is never automatically discarded merely because a client already submitted a GCash receipt.

## Team password recovery and sign-out

The workspace sign-in page has no public Forgot password action. In **Accounts & roles**, a verified super admin selects **Send password reset** for an active team account and confirms the recipient. The server derives the recipient from the Auth account, validates the super admin's MFA and workspace binding, enforces a one-minute target cooldown, five sends per target per hour and twenty per sender per hour, and records the outcome in the activity history. The existing global Auth email limit remains 100 per hour.

The branded email opens the studio's HTTPS reset page. The unused recovery link expires after one hour and can be redeemed only once. Its token is kept in the URL fragment, cleared from browser history on arrival, and redeemed only after **Continue securely**. The recovery session lives in memory and does not replace customer or workspace sessions. Accounts with an enrolled authenticator must verify it before changing the password. A successful password change revokes all earlier studio session bindings; the account signs in through the workspace again.

The signed `studio-auth-email` Supabase Send Email hook blocks public recovery requests for team profiles. Customer self-service recovery remains available. Keep this hook enabled when restoring or moving the project; hiding a button alone does not enforce this policy. Its `STUDIO_AUTH_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` belong only in server secrets. Configure the matching signed hook in Supabase Auth, with `mailer_otp_exp=3600` and `rate_limit_email_sent=100`. The hook renders the shared branded Auth templates; regenerate the manifest using `npm run email:templates` after template changes. The separate super-admin endpoint generates and sends authorized team recovery links without calling public recovery.

If the only super admin loses their password, recovery requires the verified Supabase project owner or another active super admin. Do not add a public team reset shortcut or disable MFA. Loss of both password and authenticator requires an account-owner assisted recovery procedure through the provider.

**Sign out** opens a confirmation dialog, defaults keyboard focus to Cancel, and warns when there are unsaved changes. Cancel and Escape preserve the current workspace; confirmed sign-out ends the session.

## Branded PDF exports

Booking receipts, bookings reports, account directories and operations reports share the studio logo, business email/domain, A4 layout, consistent headings, currency formatting and page numbers. Table headers and branding repeat on subsequent pages. Large tables wrap long values, and empty selections state that no records match. Receipts distinguish verified payments, refunds and the outstanding balance; report booking values are not proof that money has been collected. Exported files contain private records and should be shared only with intended recipients. Downloaded PDFs are not password-encrypted.

## Payments and communications

Payments remain manual GCash / external transactions. Verify the actual incoming transaction before approving its proof. A screenshot alone is not proof of settled money. Older embedded receipt images remain visible as imported proof; new images/PDFs use private storage with a 10 MB limit and expiring viewing links. Existing proof objects cannot be overwritten. Record final payments and completed refunds in the ledger. Corrections use reversal entries rather than deleting financial history. Approving a refund request does not transfer money.

Email delivery is queued transactionally with deduplication and bounded retries. **Sent** means Resend accepted the message. **Delivered** means a signed provider delivery event was received; it does not prove that a person read the email. Bounces, failures and complaints are visible in Notifications. An ambiguous send beyond the provider's safe retry window requires delivery review.

## Owner reminders for unopened bookings

The studio still receives the initial new-booking email. In addition, the database checks every 15 minutes for future pending bookings that no admin has opened for **2 hours**. Eligible alerts go only to **tutokpitikstudios@gmail.com** through the existing branded Resend email worker, even when nobody has the website open. Normal delivery is shortly after the two-hour threshold (up to the next quarter-hour check plus the worker/provider delay).

Follow-ups are limited to once per booking per 24 hours. There is never another reminder queued while an earlier one is awaiting delivery, retry or operator review. Admins can adjust the initial threshold from **Availability → Owner email after** (1–168 hours). This is separate from the existing pending-review target. The official recipient is selected on the server and cannot be changed by a customer request.

When an admin or super admin opens a booking successfully, the page records it as seen and displays a confirmation. Staff and customers cannot acknowledge on the owner's behalf. Acknowledgement does not approve payment, confirm a reservation, modify its version or overwrite an unsaved draft. Marking a notification read or loading the bookings list alone does not count as opening the booking. If acknowledgement fails, the page displays a retry action.

Confirmed, completed, cancelled, archived, past-start bookings and bookings marked waiting for client information do not generate these owner alerts. The worker rechecks eligibility before sending a queued reminder and cancels obsolete ones; email already handed to the provider cannot be recalled. Reminder content includes the booking reference, client name, service, schedule and waiting time, with a sign-in-protected link. Receipts, contact details and private notes stay in the workspace. Delivery is visible in **Notifications → Emails**, and the periodic check appears under **Security & health**. Acknowledgements are included in encrypted recovery snapshots.

## Encrypted recovery copies

A daily Netlify schedule runs at **03:23 Asia/Manila** (19:23 UTC). It stores encrypted application snapshots and uploaded storage objects in the site's `studio-encrypted-backups` Netlify Blobs store. Fourteen snapshots are retained. Content-addressed encrypted objects are retained while any saved snapshot references them.

Each object uses a fresh AES-256-GCM key and nonce. An RSA-OAEP public key wraps that data key. Only the public encryption key is deployed. The private recovery key is held locally outside the Git repository in the owner's private migration directory. Back up that private key separately in a trusted password manager or offline location; losing it makes these copies unreadable. Never upload it to the website or paste it into a support ticket.

The snapshots contain application records, account identities/password hashes, MFA records and storage metadata, plus schema descriptions, functions, policies and triggers. They intentionally exclude provider API credentials, provider settings and ephemeral login sessions. A replacement Supabase project needs its own provider configuration, migrations and secrets. MFA records depend on provider encryption context; users may need to re-enroll their authenticators after recovery into a different project. This is an application recovery copy, not Supabase point-in-time recovery.

## Isolated restoration rehearsal

Run the following only with an encrypted snapshot, its matching recovery key and the downloaded encrypted `objects/` directory, all outside the repository:

```sh
node scripts/verify-studio-restore.mjs /private/path/snapshot.tpsbackup /private/path/recovery-private.pem /private/path/backup-root
```

The verifier decrypts in memory into an isolated PostgreSQL WASM database, rebuilds typed tables, restores rows, validates keys/checks and available foreign keys, and verifies each uploaded object's SHA-256 hash and byte count. It never connects to the production database or sends emails. Auth/storage provider enum values are represented as text for the isolated data rehearsal. It reports only counts and sanitized errors.

For an actual disaster recovery, provision an isolated Supabase project, apply the reviewed schema/migrations and provider configuration, restore account/application rows in dependency order, restore object bytes through Storage, reset sequences, and validate RLS and end-to-end behavior before a separate cutover. Keep restored email jobs and schedulers disabled during rehearsal so old notifications are not resent. Revoke old sessions and rotate provider credentials as appropriate to the incident.

## Operational limits

The current hosting plans and their quotas still apply. A scheduled health check is not an uptime guarantee or a replacement for an always-on paid database plan. No paid upgrade or new payment gateway is purchased by this release. Review **Security & health** for failed or overdue backup/reminder checks and provider dashboards for quota or infrastructure incidents. External gallery sharing requires a manual access check for the intended client; the website cannot prove a Google Drive folder's sharing settings.
