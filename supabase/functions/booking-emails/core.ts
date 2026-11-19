import {
  STUDIO_EMAIL,
  SITE,
  renderEmail,
  detailRows,
  escapeHtml,
} from "../_shared/email.ts";
export { STUDIO_EMAIL } from "../_shared/email.ts";
const money = (value: unknown) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value) || 0,
  );
export function emailContent(job: any) {
  const b = job.payload;
  const ownerReminder = job.kind === "owner_booking_unseen";
  const studio = ownerReminder || job.kind === "studio_requested" || b.studio===true;
  const confirmed = job.kind === "customer_confirmed";
  const reference = `TPS-${String(b.id).slice(0, 6).toUpperCase()}`;
  const headings: Record<string,string>={owner_booking_unseen:"A booking has not been opened yet",booking_cancelled:"Your booking was cancelled",request_received:"A booking request needs review",request_resolved:"Your booking request was updated",booking_message:"You have a new booking message",payment_rejected:"Your payment proof needs attention",gallery_ready:"Your gallery is ready",shoot_reminder:"Your photography session is coming up",delivery_overdue:"A gallery delivery needs attention"};
  const heading = headings[job.kind] || (studio
    ? "New booking request"
    : confirmed
      ? "Your booking is confirmed"
      : "We received your booking request");
  const messages:Record<string,string>={owner_booking_unseen:"No admin has opened this booking in the studio workspace. Please review the request. Opening it marks it as seen; it does not confirm the reservation or payment.",booking_cancelled:"This reservation is now cancelled. Open your booking for the decision and any refund request status.",request_received:"Review the requested change in the studio workspace. The existing reservation remains in place until an approved change is saved.",request_resolved:"Open your booking to see the studio response and your current schedule.",booking_message:"There is a new message about your booking. Sign in to read and reply securely.",payment_rejected:"The submitted proof could not be verified. Review the explanation below and submit corrected proof from your booking.",gallery_ready:"Your photographs are ready to view. Open your booking to access the gallery and share any revision request.",shoot_reminder:"Your session is within the next 24 hours. Review your schedule, venue and preparation details.",delivery_overdue:"The delivery due date has passed. Review the gallery progress and contact the client with an update."};
  const message = messages[job.kind] || (studio
    ? "A new booking is ready for review in your studio dashboard. Check the submitted GCash receipt before approving it."
    : confirmed
      ? "The studio has approved your booking. Your confirmed session details are below."
      : "Your booking request and GCash receipt have been submitted. The studio will review your payment and availability, then send a separate confirmation. This acknowledgment does not confirm payment.");
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
  if (b.notice) rows.push(["Update",b.notice]);
  if (["customer_requested","studio_requested"].includes(job.kind) && b.total_price != null) {
    const deposit = Math.max(0, Number(b.total_price) - Number(b.transportation_fee || 0)) / 2;
    rows.push(["Deposit submitted for review",money(deposit)],["Balance if deposit is verified",money(Number(b.total_price)-deposit)]);
  } else if (job.kind !== "booking_cancelled" && b.status !== "cancelled" && b.remaining_balance!==undefined)rows.push(["Outstanding balance",money(b.remaining_balance)]);
  if (b.delivery_due)rows.push(["Delivery due",b.delivery_due]);
  if (ownerReminder) {
    rows.splice(5); // Keep repeat alerts brief; private notes and contact details stay in the workspace.
    if (b.waiting_hours !== undefined) rows.push(["Waiting for attention", `${b.waiting_hours} hours`]);
  }
  if (studio && !ownerReminder)
    rows.push(
      ["Customer email", b.email],
      ["Phone", b.phone],
      ["Notes", b.message],
    );
  const text = [
    heading,
    message,
    ...rows.map(([k, v]) => `${k}: ${String(v ?? "")}`),
    `Open ${studio ? "the admin dashboard" : "Profile → Bookings"}: ${studio ? `${SITE}/admin/bookings/${b.id}` : `${SITE}/account/bookings?booking=${encodeURIComponent(b.id)}`}`,
    `Questions? ${STUDIO_EMAIL}`,
  ].join("\n\n");
  const html = renderEmail({
    heading,
    preheader: message,
    contentHtml: `<p style="margin:0">${escapeHtml(message)}</p>${detailRows(rows)}`,
    actionUrl: studio ? `${SITE}/admin/bookings/${b.id}` : `${SITE}/account/bookings?booking=${encodeURIComponent(b.id)}`,
    action: studio ? "Open studio dashboard" : "View my bookings",
    footnote: `Sign in ${studio ? "through the studio workspace" : "to your account"} to view this booking. Payment receipts are available only through your authenticated account.`,
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
      to: [["studio_requested","owner_booking_unseen"].includes(job.kind) || job.payload.studio===true ? STUDIO_EMAIL : job.recipient],
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
    failed = 0, skipped = 0;
  for (const job of jobs || []) {
    let result: any;
    try {
      if (job.kind === 'owner_booking_unseen') {
        const checked = await db.rpc('studio_prepare_owner_reminder', { p_job: job.id });
        if (checked.error) throw new Error('Could not recheck booking attention');
        if (checked.data !== true) { skipped++; continue; }
      }
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
  return { sent, failed, skipped };
}
