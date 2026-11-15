import {
  STUDIO_EMAIL,
  SITE,
  renderEmail,
  detailRows,
} from "../_shared/email.ts";
export { STUDIO_EMAIL } from "../_shared/email.ts";
const money = (value: unknown) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value) || 0,
  );
export function emailContent(job: any) {
  const b = job.payload;
  const studio = job.kind === "studio_requested";
  const confirmed = job.kind === "customer_confirmed";
  const reference = `TPS-${String(b.id).slice(0, 6).toUpperCase()}`;
  const heading = studio
    ? "New booking request"
    : confirmed
      ? "Your booking is confirmed"
      : "We received your booking request";
  const message = studio
    ? "A new booking is ready for review in your studio dashboard. Check the submitted GCash receipt before approving it."
    : confirmed
      ? "The studio has approved your booking. Your confirmed session details are below."
      : "Your booking request and GCash receipt have been submitted. The studio will review your payment and availability, then send a separate confirmation. This acknowledgment does not confirm payment.";
  const rows: [string, unknown][] = [
    ["Reference", reference],
    ["Client", b.full_name],
    ["Service", b.service],
    ["Date", b.booking_date],
    [
      "Time (Philippines)",
      `${String(b.start_time).slice(0, 5)} – ${String(b.end_time).slice(0, 5)}`,
    ],
    ["Location", b.location],
    ["Session total", money(b.total_price)],
    ["Transportation included", money(b.transportation_fee)],
  ];
  if (studio)
    rows.push(
      ["Customer email", b.email],
      ["Phone", b.phone],
      ["Notes", b.message],
    );
  const text = [
    heading,
    message,
    ...rows.map(([k, v]) => `${k}: ${String(v ?? "")}`),
    `Open ${studio ? "the admin dashboard" : "Profile → Bookings"}: ${SITE}`,
    `Questions? ${STUDIO_EMAIL}`,
  ].join("\n\n");
  const html = renderEmail({
    heading,
    preheader: message,
    contentHtml: `<p style="margin:0">${message}</p>${detailRows(rows)}`,
    action: studio ? "Open studio dashboard" : "View my bookings",
    footnote: `Sign in, then open ${studio ? "Admin" : "Profile → Bookings"}. Payment receipts are available only through your authenticated account.`,
  });
  return { subject: `${heading} · ${reference}`, html, text };
}
export function safeFailure(status: number) {
  return status === 429 || status >= 500
    ? "Email provider temporarily unavailable"
    : "Email provider rejected delivery; check sender and recipient";
}
export async function sendJob(
  job: any,
  config: { key: string; from: string },
  fetcher: typeof fetch = fetch,
) {
  const content = emailContent(job);
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `tps-booking/${job.id}`,
    },
    body: JSON.stringify({
      from: config.from,
      to: [job.kind === "studio_requested" ? STUDIO_EMAIL : job.recipient],
      reply_to: STUDIO_EMAIL,
      ...content,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return { ok: false, error: safeFailure(response.status) };
  const body = await response.json();
  return typeof body.id === "string"
    ? { ok: true, id: body.id }
    : { ok: false, error: "Email provider returned no delivery identifier" };
}
export async function drain(
  db: any,
  config: { key: string; from: string },
  bookingId: string | null,
  fetcher: typeof fetch = fetch,
) {
  const { data: jobs, error } = await db.rpc("claim_booking_emails", {
    p_booking: bookingId,
    p_limit: 10,
  });
  if (error) throw new Error("Email queue unavailable");
  let sent = 0,
    failed = 0;
  for (const job of jobs || []) {
    let result: any;
    try {
      result = await sendJob(job, config, fetcher);
    } catch {
      result = { ok: false, error: "Email delivery temporarily unavailable" };
    }
    const patch = result.ok
      ? {
          state: "sent",
          provider_id: result.id,
          sent_at: new Date().toISOString(),
          last_error: null,
        }
      : {
          state: "failed",
          last_error: result.error,
          next_attempt_at: new Date(
            Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000,
          ).toISOString(),
        };
    const saved = await db
      .from("booking_email_outbox")
      .update(patch)
      .eq("id", job.id)
      .eq("state", "sending");
    if (saved.error) throw new Error("Could not record delivery result");
    if (result.ok) sent++;
    else failed++;
  }
  return { sent, failed };
}
