import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exported = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../supabase/functions/_shared/email.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports: exported },
);
const { renderEmail } = exported;
const auth = [
  [
    "confirmation",
    "Confirm your email",
    "Welcome to Tutok Pitik Studios. Confirm your email address to finish setting up your account.",
    "Confirm email address",
  ],
  [
    "invite",
    "You are invited to the studio",
    "You have been invited to create a Tutok Pitik Studios account. Accept your invitation to get started.",
    "Accept invitation",
  ],
  [
    "magic_link",
    "Your secure sign-in link",
    "Use the button below to sign in to your Tutok Pitik Studios account. This link can only be used once.",
    "Sign in securely",
  ],
  [
    "email_change",
    "Confirm your email change",
    "Confirm the requested email change for your Tutok Pitik Studios account. If you did not request this change, do not use the link.",
    "Confirm email change",
  ],
  [
    "recovery",
    "Reset your password",
    "We received a request to reset your Tutok Pitik Studios password. Use the secure link below to choose a new password.",
    "Reset password",
  ],
  [
    "reauthentication",
    "Verify your identity",
    "Enter this verification code in the studio website to continue your sensitive account action.",
    null,
  ],
  [
    "password_changed_notification",
    "Your password was changed",
    "The password for your Tutok Pitik Studios account was changed.",
    null,
  ],
  [
    "email_changed_notification",
    "Your email address was changed",
    "The email address for your Tutok Pitik Studios account was changed.",
    null,
  ],
  [
    "phone_changed_notification",
    "Your phone number was changed",
    "The phone number for your Tutok Pitik Studios account was changed.",
    null,
  ],
  [
    "mfa_factor_enrolled_notification",
    "A verification method was added",
    "A new sign-in verification method was added to your Tutok Pitik Studios account.",
    null,
  ],
  [
    "mfa_factor_unenrolled_notification",
    "A verification method was removed",
    "A sign-in verification method was removed from your Tutok Pitik Studios account.",
    null,
  ],
  [
    "identity_linked_notification",
    "A sign-in method was linked",
    "An additional sign-in method was linked to your Tutok Pitik Studios account.",
    null,
  ],
  [
    "identity_unlinked_notification",
    "A sign-in method was removed",
    "A sign-in method was removed from your Tutok Pitik Studios account.",
    null,
  ],
];
const dir = new URL("../supabase/templates/", import.meta.url);
mkdirSync(dir, { recursive: true });
const manifest = { rate_limit_email_sent: 100 };
for (const [kind, heading, message, action] of auth) {
  const security = kind.endsWith("_notification");
  const code =
    kind === "reauthentication"
      ? '<p style="margin:24px 0;padding:20px;text-align:center;font-size:30px;font-weight:700;letter-spacing:6px;border:1px solid #e5deda;border-radius:8px;color:#1b1b1d">{{ .Token }}</p>'
      : "";
  const html = renderEmail({
    heading,
    preheader: message,
    contentHtml: `<p style="margin:0">${message}</p>${code}`,
    action: action || (security ? "Review my account" : undefined),
    actionUrl: action ? "{{ .ConfirmationURL }}" : undefined,
    footnote: security
      ? "If you did not make this change, secure your account and contact the studio immediately."
      : kind === "reauthentication"
        ? "Never share this code. It expires after one hour. If you did not request it, ignore this email."
        : "This link is private and time limited. If you did not request this email, you can safely ignore it. Never forward a sign-in or password-reset link.",
  });
  writeFileSync(new URL(kind + ".html", dir), html + "\n");
  manifest[`mailer_subjects_${kind}`] = `${heading} · Tutok Pitik Studios`;
  manifest[`mailer_templates_${kind}_content`] = html;
}
writeFileSync(
  new URL("auth-config.json", dir),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Generated ${auth.length} branded Auth templates and rate-limit configuration (100/hour).`,
);
