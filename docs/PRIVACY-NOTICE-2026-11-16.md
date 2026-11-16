# Privacy notice and agreement update — November 16, 2026

The public `/privacy` and `/terms` pages now foreground the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), explain actual account and reservation data handling, and provide readable section navigation and a studio privacy contact. The same documents are available inside account dialogs. A reusable notice appears before account and booking decisions, and the footer uses descriptive policy links.

The notice covers the controller, collection, purposes and lawful bases, providers and overseas processing, retention criteria, security and incident reporting, data-subject rights, privacy requests, browser storage, minors, photo permissions and policy updates. It distinguishes provider-managed encryption and authorized access from end-to-end encryption. Private-file viewing links remain bearer links while valid and must be kept private. It does not claim absolute security or NPC certification.

The Terms explain pending versus confirmed bookings, the existing GCash QR and 50% downpayment, transportation fees, changes and cancellations, delivery, photo permissions and preserved statutory rights. They do not introduce an automatic downpayment forfeiture, blanket no-refund rule, fixed delivery deadline or compulsory marketing permission.

## Agreement behavior

- Email registration retains its required unchecked agreement box, with separate Terms acceptance and Privacy Notice acknowledgement wording.
- Google sign-in presents a review dialog with an unchecked agreement. Continue is disabled until checked; reopening the review resets it.
- Booking review requires the same unchecked acknowledgement. Both the button and submit handler enforce it; reopening review resets it.
- Privacy acknowledgement is not represented as blanket consent to every processing purpose. Marketing and public photo use require separate permission.
- These are client interface checks, not a new server-side consent ledger. No independently audited acceptance record or backend consent enforcement is claimed.

## Verification

- TypeScript and production build pass.
- Existing suites pass: 187 edge-access, 41 booking-email and 24 Google-auth checks (252 total; offline).
- Browser review at 1280×900 and 390×844: document hierarchy, law callout, section links, readable mobile layout, no horizontal overflow, full-page and modal notices.
- Google review: disabled before acknowledgement, enabled after checking, reset on reopening; nested notice can be read and closed without leaving the form. No Google redirect or account creation performed for this content release.
- Email registration: missing acknowledgement produces the required error. Opening the notice does not check the agreement box.
- Booking review: exercised the actual Contact component in a temporary local fixture with synthetic details and a logo placeholder image; network calls were stubbed and mutations blocked. Verified disabled/enabled/reset behavior and mobile layout. No real booking, payment, upload or email was created. Fixture files removed before staging.
- Production publication and visual checks are recorded in the completion report.

## Sources and operational boundaries

Reviewed official sources:

- https://privacy.gov.ph/data-privacy-act/
- https://privacy.gov.ph/data-subject-rights/
- https://privacy.gov.ph/the-right-to-be-informed/
- https://privacy.gov.ph/filing-a-complaint/
- https://supabase.com/security

This release changes public explanations and agreement presentation; it does not introduce new encryption algorithms, change database policies or constitute a legal compliance certification. Retention is described through service/legal criteria because no fixed operational retention schedule has been approved. The studio must apply those criteria, respond to privacy requests and obtain separate photo/marketing permissions in actual operations. No DPO identity, legal entity name, registration, exact street address or numerical retention period was invented.
