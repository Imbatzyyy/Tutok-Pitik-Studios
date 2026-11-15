export const STUDIO_EMAIL = "tutokpitikstudios@gmail.com";
export const SITE = "https://tutokpitikstudios.com";
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

/** contentHtml must be composed from fixed markup and escaped customer values. */
export function renderEmail({
  heading,
  preheader,
  contentHtml,
  action,
  actionUrl = SITE,
  footnote = "Manage your account and bookings securely on our website.",
}: {
  heading: string;
  preheader: string;
  contentHtml: string;
  action?: string;
  actionUrl?: string;
  footnote?: string;
}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(heading)} · Tutok Pitik Studios</title></head>
<body style="margin:0;padding:0;background:#f2f1ef;color:#262525;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f1ef"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e2dfdc;border-radius:16px;overflow:hidden">
<tr><td style="height:5px;background:#c72b38;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="background:#1b1b1d;padding:30px 28px"><p style="margin:0 0 6px;color:#fff;font-size:16px;font-weight:700;letter-spacing:2px">TUTOK PITIK</p><p style="margin:0;color:#e9a4a9;font-size:10px;letter-spacing:5px">S T U D I O S</p></td></tr>
<tr><td style="padding:30px 28px 12px"><p style="margin:0 0 12px;color:#a6202b;font-size:11px;font-weight:700;letter-spacing:2px">A NOTE FROM YOUR STUDIO</p><h1 style="margin:0 0 22px;font-size:27px;line-height:1.25;letter-spacing:-0.5px;color:#1b1b1d">${escapeHtml(heading)}</h1><div style="font-size:15px;line-height:1.8;color:#525052">${contentHtml}</div>
${action ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0"><tr><td bgcolor="#b82331" style="border-radius:7px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:15px 24px;border:1px solid #b82331;border-radius:7px;color:#fff;font-size:14px;font-weight:700;text-decoration:none">${escapeHtml(action)}</a></td></tr></table>` : ""}
<p style="margin:20px 0 14px;padding:16px;background:#f7f5f3;border-radius:8px;font-size:12px;line-height:1.7;color:#676164">${escapeHtml(footnote)}</p></td></tr>
<tr><td style="padding:20px 28px 26px;border-top:1px solid #eee9e6"><p style="margin:0 0 6px;color:#292527;font-size:12px;font-weight:700">Tutok Pitik Studios</p><p style="margin:0;color:#777173;font-size:12px;line-height:1.8">Need a hand? <a href="mailto:${STUDIO_EMAIL}" style="color:#a6202b;text-decoration:underline;overflow-wrap:anywhere">${STUDIO_EMAIL}</a><br><a href="${SITE}" style="color:#777173;text-decoration:none">tutokpitikstudios.com</a></p></td></tr>
</table></td></tr></table></body></html>`;
}
export function detailRows(rows: [string, unknown][]) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin-top:20px;font-size:13px;table-layout:fixed">${rows.map(([label, value]) => `<tr><td width="36%" style="padding:12px 8px 12px 0;border-bottom:1px solid #eee9e6;vertical-align:top;color:#777173">${escapeHtml(label)}</td><td style="padding:12px 0 12px 8px;border-bottom:1px solid #eee9e6;vertical-align:top;color:#292527;font-weight:600;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</td></tr>`).join("")}</table>`;
}
export function accountContent(kind: "welcome" | "profile", name: unknown) {
  const heading =
    kind === "welcome" ? "Welcome to the studio" : "Your profile was updated";
  const message =
    kind === "welcome"
      ? "Your Tutok Pitik Studios account is ready. Explore the portfolio, save your favorite photographs, and request a session whenever you are ready."
      : "Your latest profile details have been saved. You can review them securely in your account.";
  const footnote =
    kind === "welcome"
      ? "Booking requests are reviewed by the studio. GCash payment and your reservation are confirmed separately."
      : "If you did not update your profile, secure your account and contact the studio using the address below.";
  return {
    subject: `${heading} · Tutok Pitik Studios`,
    text: `${heading}\n\nHi ${String(name || "there")},\n\n${message}\n\n${footnote}\n\n${SITE}`,
    html: renderEmail({
      heading,
      preheader: message,
      contentHtml: `<p style="margin:0 0 12px">Hi ${escapeHtml(name || "there")},</p><p style="margin:0">${message}</p>`,
      action: kind === "welcome" ? "Explore the studio" : "Review my profile",
      footnote,
    }),
  };
}
