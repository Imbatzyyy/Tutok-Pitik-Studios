import { hasPortalSession } from "../_shared/admin-session.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { drain } from "./core.ts";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const key = Deno.env.get("RESEND_API_KEY") || "";
const from = Deno.env.get("RESEND_FROM_EMAIL") || "";
const workerToken = Deno.env.get("BOOKING_EMAIL_WORKER_TOKEN") || "";
const origins = new Set([
  "https://tutokpitikstudios.com",
  "https://www.tutokpitikstudios.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (origin && origins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization,content-type,apikey";
    headers["Access-Control-Allow-Methods"] = "POST,OPTIONS";
  }
  const reply = (status: number, body: any) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.has(origin))
    return reply(403, { error: "Origin not allowed" });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    let bookingId: string | null = null;
    const worker = req.headers.get("x-worker-token");
    if (!workerToken || worker !== workerToken) {
      const token = req.headers
        .get("Authorization")
        ?.replace(/^Bearer\s+/i, "");
      if (!token) return reply(401, { error: "Sign in required" });
      const {
        data: { user },
        error,
      } = await db.auth.getUser(token);
      if (error || !user) return reply(401, { error: "Sign in required" });
      const { data: profile } = await db
        .from("users")
        .select("role,status")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile || profile.status !== "active")
        return reply(403, { error: "Active account required" });
      if (["staff","admin","superadmin","super_admin"].includes(profile.role) && !(await hasPortalSession(db,token,user.id))) return reply(403,{error:"Studio sign-in required"});
      const raw = await req.text();
      if (raw.length > 1024) return reply(413, { error: "Request too large" });
      const body = JSON.parse(raw);
      if (
        typeof body.bookingId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.bookingId)
      )
        return reply(400, { error: "Valid booking ID required" });
      bookingId = body.bookingId;
      const { data: booking } = await db
        .from("bookings")
        .select("user_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (
        !booking ||
        (booking.user_id !== user.id &&
          !["staff", "admin", "superadmin", "super_admin"].includes(
            profile.role,
          ))
      )
        return reply(404, { error: "Booking not found" });
    }
    if (!key || !from)
      return reply(503, {
        error: "Email service is unavailable; notifications remain queued",
      });
    const result = await drain(db, { key, from }, bookingId);
    return reply(200, { success: true, ...result });
  } catch (error) {
    console.error(
      "Booking email worker failed",
      error instanceof SyntaxError ? "invalid_json" : "queue_or_provider_error",
    );
    return reply(error instanceof SyntaxError ? 400 : 503, {
      error: "Notifications remain queued for retry",
    });
  }
});
