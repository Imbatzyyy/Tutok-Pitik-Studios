# Studio operations and recovery

## Access and daily use

Use `https://tutokpitikstudios.com/admin/login`. Team accounts sign in with their own password and an authenticator. On first use, enroll an authenticator; then open **Security & health** and save the eight recovery codes privately. Generating new codes invalidates the old set. Recovery requires a fresh password sign-in and one unused code; it revokes every workspace session before resetting the lost authenticator. Studio bindings expire after eight hours.

Staff see their assigned shoots, editing and support work. Admins manage scheduling, finances, content and reports. Super admins additionally invite team members, change roles, suspend accounts and grant staff permission to verify payments. A role or status change revokes the account's existing workspace bindings.

Start with **Overview**, then use the booking views or calendar. Each booking has independent reservation, payment and gallery states, a preparation brief, private files, a conversation, an internal team note channel and a change history. A stale save fails without discarding the draft. Requests hold the existing slot until an approved reschedule commits. A pending booking is never automatically discarded merely because a client already submitted a GCash receipt.

## Payments and communications

Payments remain manual GCash / external transactions. Verify the actual incoming transaction before approving its proof. A screenshot alone is not proof of settled money. Older embedded receipt images remain visible as imported proof; new images/PDFs use private storage with a 10 MB limit and expiring viewing links. Existing proof objects cannot be overwritten. Record final payments and completed refunds in the ledger. Corrections use reversal entries rather than deleting financial history. Approving a refund request does not transfer money.

Email delivery is queued transactionally with deduplication and bounded retries. **Sent** means Resend accepted the message. **Delivered** means a signed provider delivery event was received; it does not prove that a person read the email. Bounces, failures and complaints are visible in Notifications. An ambiguous send beyond the provider's safe retry window requires delivery review.

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
