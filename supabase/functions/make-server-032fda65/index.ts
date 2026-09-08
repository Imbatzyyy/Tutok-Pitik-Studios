import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js";
import nodemailer from "npm:nodemailer";

const app = new Hono();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const allowedOrigins = [
  Deno.env.get('SITE_URL'),
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
].filter(Boolean) as string[];

const getAccessToken = (authorization?: string | null) => authorization?.replace(/^Bearer\s+/i, '').trim();

const adminRoles = ['superadmin', 'admin', 'staff'];
const contentAdminRoles = ['superadmin', 'admin'];

async function requireAuthenticatedUser(c: any) {
  const accessToken = getAccessToken(c.req.header('Authorization'));
  if (!accessToken) {
    return null;
  }

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return null;
  }

  return { user, accessToken };
}

function normalizePhoneNumber(rawPhone: string) {
  const trimmed = String(rawPhone || '').trim();
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) return '';
  if (trimmed.startsWith('+') && digits.length >= 10 && digits.length <= 15) return '+' + digits;
  if (digits.startsWith('09') && digits.length === 11) return '+63' + digits.slice(1);
  if (digits.startsWith('9') && digits.length === 10) return '+63' + digits;
  if (digits.startsWith('63') && digits.length === 12) return '+' + digits;
  if (digits.length >= 10 && digits.length <= 15) return '+' + digits;
  return '';
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getInfobipConfig() {
  const apiKey = Deno.env.get('INFOBIP_API_KEY');
  const baseUrl = Deno.env.get('INFOBIP_BASE_URL');
  const sender = Deno.env.get('INFOBIP_SENDER') || 'TUTOKPITIK';

  if (!apiKey || !baseUrl) {
    return null;
  }

  return {
    apiKey,
    baseUrl: baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl,
    sender,
  };
}

async function sendInfobipOtpSms(phone: string, code: string) {
  const config = getInfobipConfig();
  if (!config) {
    return { ok: false, status: 500, data: { message: 'Infobip configuration missing. Set INFOBIP_API_KEY, INFOBIP_BASE_URL, and if required INFOBIP_SENDER.' } };
  }

  const response = await fetch(config.baseUrl + '/sms/3/messages', {
    method: 'POST',
    headers: {
      Authorization: 'App ' + config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      messages: [{
        from: config.sender,
        destinations: [{ to: phone }],
        text: 'Your Tutok Pitik Studios verification code is ' + code + '. It expires in 5 minutes.',
      }],
    }),
  });

  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    console.error('Infobip OTP send error:', data);
  }

  return { ok: response.ok, status: response.status, data };
}

async function getDatabaseUser(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Database user lookup error:', error);
    return null;
  }

  return data;
}

const getSmtpConfig = () => {
  const host = Deno.env.get('SMTP_HOST');
  const port = Number(Deno.env.get('SMTP_PORT') || '587');
  const username = Deno.env.get('SMTP_USERNAME');
  const password = Deno.env.get('SMTP_PASSWORD');
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || Deno.env.get('MAILGUN_FROM_EMAIL') || 'noreply@tutokpitikstudios.com';
  const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Tutok Pitik Studios';

  if (!host || !port || !username || !password) {
    return null;
  }

  return {
    host,
    port,
    username,
    password,
    from: `${fromName} <${fromEmail}>`,
    secure: port === 465,
  };
};

async function sendMailgunEmail({ to, subject, html }: { to: string | string[]; subject: string; html: string }) {
  const config = getSmtpConfig();
  if (!config) {
    console.error('SMTP configuration missing');
    return { ok: false, status: 500, data: { message: 'SMTP configuration missing' } };
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });

    const info = await transporter.sendMail({
      from: config.from,
      to: recipients.join(', '),
      subject,
      html,
    });

    return { ok: true, status: 200, data: { messageId: info.messageId, response: info.response } };
  } catch (error) {
    console.error('SMTP send error:', error);
    return { ok: false, status: 500, data: { message: error instanceof Error ? error.message : 'SMTP send failed' } };
  }
}

async function requireAuthenticatedProfile(c: any) {
  const auth = await requireAuthenticatedUser(c);
  if (!auth) {
    return null;
  }

  const profile = await getDatabaseUser(auth.user.id);
  if (!profile) {
    return null;
  }

  return { ...auth, profile };
}

async function sendBookingConfirmationEmail(booking: any) {
  if (!getMailgunConfig() || !booking?.email) {
    return null;
  }

  const bookingDate = booking.booking_date
    ? new Date(booking.booking_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'To be announced';

  const formatTime = (value?: string) => {
    if (!value) return 'TBD';
    const [rawHours = '0', rawMinutes = '00'] = String(value).split(':');
    const hours = Number(rawHours);
    const minutes = String(rawMinutes).slice(0, 2);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${suffix}`;
  };

  const bookingTime = `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`;
  const totalAmount = Number(booking.total_price || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const confirmationEmailHTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Booking Confirmed</title>
  </head>
  <body style="margin:0;padding:0;background:#09090b;font-family:Arial,sans-serif;color:#f4f4f5;">
    <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
      <div style="background:linear-gradient(180deg,#1b1214 0%,#111113 100%);border:1px solid rgba(230,57,70,0.25);border-radius:28px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.35);">
        <div style="padding:34px 32px 22px;background:radial-gradient(circle at top, rgba(230,57,70,0.28), transparent 60%);text-align:center;">
          <img src="https://tutokpitikstudios.com/favicon.png" alt="Tutok Pitik Studios" style="width:76px;height:76px;border-radius:20px;display:block;margin:0 auto 18px;" />
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(230,57,70,0.16);color:#ffb4ba;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Booking Approved</div>
          <h1 style="margin:18px 0 10px;font-size:34px;line-height:1.1;color:#ffffff;">Your Shoot Is Confirmed</h1>
          <p style="margin:0 auto;max-width:470px;color:#d4d4d8;font-size:16px;line-height:1.7;">Hi ${booking.full_name || 'there'}, your booking request has been approved. Your status is now confirmed in Tutok Pitik Studios.</p>
        </div>
        <div style="padding:0 32px 34px;">
          <div style="background:#18181b;border:1px solid #2b2b31;border-radius:22px;padding:24px;">
            <h2 style="margin:0 0 18px;color:#ffffff;font-size:18px;">Confirmed Booking Details</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr><td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">Service</td><td style="padding:10px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #27272a;">${booking.service || 'Photography Session'}</td></tr>
              <tr><td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">Date</td><td style="padding:10px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #27272a;">${bookingDate}</td></tr>
              <tr><td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">Time</td><td style="padding:10px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #27272a;">${bookingTime}</td></tr>
              <tr><td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">Location</td><td style="padding:10px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #27272a;">${booking.location || 'To be confirmed'}</td></tr>
              <tr><td style="padding:14px 0 0;color:#ffb4ba;font-size:13px;font-weight:700;">Confirmed Total</td><td style="padding:14px 0 0;color:#ffffff;font-size:26px;font-weight:800;text-align:right;">PHP ${totalAmount}</td></tr>
            </table>
          </div>
          <div style="margin-top:18px;background:#131316;border:1px solid #26262b;border-radius:18px;padding:18px 20px;color:#d4d4d8;font-size:14px;line-height:1.7;">
            Please review your updated booking status in your <strong>Profile &gt; Bookings</strong> tab. If you need to request changes, kindly contact the studio as soon as possible.
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const emailResult = await sendMailgunEmail({
    to: booking.email,
    subject: 'Booking Confirmed | Tutok Pitik Studios',
    html: confirmationEmailHTML,
  });

  return emailResult.ok ? emailResult.data : null;
}

app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return allowedOrigins[0] || '';
      }

      return allowedOrigins.includes(origin) ? origin : '';
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-032fda65/health", (c) => {
  return c.json({ status: "ok" });
});

app.post("/make-server-032fda65/users/send-phone-otp", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { phone } = await c.req.json();
    const normalizedPhone = normalizePhoneNumber(phone || '');
    if (!normalizedPhone) {
      return c.json({ error: 'Please enter a valid mobile number.' }, 400);
    }

    const code = generateOtpCode();
    const expiresAt = Date.now() + (5 * 60 * 1000);

    await kv.set('phone-otp:' + auth.user.id, {
      code,
      phone: normalizedPhone,
      expiresAt,
      attempts: 0,
    });

    const smsResult = await sendInfobipOtpSms(normalizedPhone, code);
    if (!smsResult.ok) {
      return c.json({ error: smsResult.data?.requestError?.serviceException?.text || smsResult.data?.message || 'Unable to send OTP right now.' }, 500);
    }

    return c.json({ success: true, message: 'OTP sent to ' + normalizedPhone });
  } catch (error) {
    console.error('Send phone OTP error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unable to send OTP' }, 500);
  }
});

app.post("/make-server-032fda65/users/verify-phone-otp", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { phone, code } = await c.req.json();
    const normalizedPhone = normalizePhoneNumber(phone || '');
    const trimmedCode = String(code || '').trim();

    if (!normalizedPhone || !trimmedCode) {
      return c.json({ error: 'Phone number and OTP code are required.' }, 400);
    }

    const storedOtp = await kv.get('phone-otp:' + auth.user.id);
    if (!storedOtp) {
      return c.json({ error: 'No OTP request found. Please request a new code.' }, 400);
    }

    if (storedOtp.expiresAt < Date.now()) {
      await kv.del('phone-otp:' + auth.user.id);
      return c.json({ error: 'OTP expired. Please request a new code.' }, 400);
    }

    if (storedOtp.phone !== normalizedPhone) {
      return c.json({ error: 'The OTP was requested for a different mobile number.' }, 400);
    }

    if (storedOtp.code !== trimmedCode) {
      await kv.set('phone-otp:' + auth.user.id, { ...storedOtp, attempts: Number(storedOtp.attempts || 0) + 1 });
      return c.json({ error: 'Invalid OTP code.' }, 400);
    }

    await kv.del('phone-otp:' + auth.user.id);

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ phone: normalizedPhone, updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
      .select('*')
      .single();

    if (updateError) {
      return c.json({ error: updateError.message }, 500);
    }

    const metadata = {
      ...(auth.user.user_metadata || {}),
      phone: normalizedPhone,
      phone_verified: true,
    };

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(auth.user.id, {
      user_metadata: metadata,
    });

    if (authUpdateError) {
      return c.json({ error: authUpdateError.message }, 500);
    }

    return c.json({ success: true, phone: normalizedPhone, user: updatedUser, phoneVerified: true });
  } catch (error) {
    console.error('Verify phone OTP error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unable to verify OTP' }, 500);
  }
});

app.post("/make-server-032fda65/auth/signup", async (c) => {
  try {
    const payload = await c.req.json();
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';
    const firstName = typeof payload.firstName === 'string' ? payload.firstName.trim() : '';
    const lastName = typeof payload.lastName === 'string' ? payload.lastName.trim() : '';
    const username = typeof payload.username === 'string' ? payload.username.trim() : '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

    if (!email || !password || !firstName || !lastName || !username) {
      return c.json({ error: 'Missing required signup fields.' }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username,
        role: 'customer',
      },
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    let profile = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: profileRow } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileRow) {
        profile = profileRow;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }

    return c.json({ success: true, user: data.user, profile });
  } catch (error) {
    console.error('Direct signup error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unable to create account' }, 500);
  }
});


app.post("/make-server-032fda65/send-welcome-email", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user?.email) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { fullName } = await c.req.json();
    const email = auth.user.email;

    if (!getSmtpConfig()) {
      console.error('SMTP configuration missing');
      return c.json({ error: 'Email service not configured' }, 500);
    }

    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Inter', Arial, sans-serif; background-color: #000; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #18181b; }
    .header { background: linear-gradient(135deg, #E63946 0%, #c62e3a 100%); padding: 40px 30px; text-align: center; }
    .header h1 { color: white; font-size: 28px; margin: 0 0 10px 0; font-weight: 800; }
    .header p { color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; }
    .content { padding: 40px 30px; color: #e4e4e7; }
    .content h2 { color: white; font-size: 24px; margin: 0 0 20px 0; }
    .content p { line-height: 1.6; margin-bottom: 15px; color: #d4d4d8; }
    .button { display: inline-block; background-color: #E63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #09090b; color: #71717a; text-align: center; padding: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📸 Welcome to Tutok Pitik Studios!</h1>
      <p>Your photography journey starts here</p>
    </div>
    <div class="content">
      <h2>Hi ${fullName}!</h2>
      <p>Thank you for joining Tutok Pitik Studios. We're excited to have you as part of our community!</p>
      <p>With your account, you can:</p>
      <ul style="color: #d4d4d8; line-height: 1.8;">
        <li>Book photography sessions online</li>
        <li>Save your favorite portfolio images</li>
        <li>Manage your bookings and profile</li>
        <li>Access exclusive photography content</li>
      </ul>
      <p>Ready to get started? Explore our portfolio and book your first session!</p>
      <a href="${Deno.env.get('SITE_URL') || 'https://tutokpitik.com'}" class="button">Visit Website</a>
    </div>
    <div class="footer">
      <p><strong>Tutok Pitik Studios</strong></p>
      <p>Professional Photography Services</p>
      <p style="margin-top: 10px;">© ${new Date().getFullYear()} Tutok Pitik Studios. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    const emailResult = await sendMailgunEmail({
      to: email,
      subject: '📸 Welcome to Tutok Pitik Studios!',
      html: emailHTML,
    });

    if (!emailResult.ok) {
      return c.json({ error: 'Failed to send email', details: emailResult.data }, 500);
    }

    console.log('Welcome email sent successfully:', emailResult.data);
    return c.json({ success: true, messageId: emailResult.data?.id || emailResult.data?.message });

  } catch (error) {
    console.error('Send welcome email error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-032fda65/send-booking-email", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user?.email) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { booking } = await c.req.json();
    if (!booking?.email) {
      return c.json({ error: 'Booking email is required' }, 400);
    }

    
    if (!getSmtpConfig()) {
      return c.json({ error: 'Email service not configured' }, 500);
    }
    const bookingDate = booking.booking_date
      ? new Date(booking.booking_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'To be announced';

    const formatTime = (value?: string) => {
      if (!value) return 'TBD';
      const [rawHours = '0', rawMinutes = '00'] = String(value).split(':');
      const hours = Number(rawHours);
      const minutes = String(rawMinutes).slice(0, 2);
      const suffix = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${suffix}`;
    };

    const bookingTime = `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`;
    const totalAmount = Number(booking.total_price || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const customerEmailHTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Booking Request Received</title>
  </head>
  <body style="margin:0;padding:0;background:#09090b;font-family:Arial,sans-serif;color:#f4f4f5;">
    <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
      <div style="background:linear-gradient(180deg,#1b1214 0%,#111113 100%);border:1px solid rgba(230,57,70,0.25);border-radius:28px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.35);">
        <div style="padding:34px 32px 22px;background:radial-gradient(circle at top, rgba(230,57,70,0.28), transparent 60%);text-align:center;">
          <img src="https://tutokpitikstudios.com/favicon.png" alt="Tutok Pitik Studios" style="width:76px;height:76px;border-radius:20px;display:block;margin:0 auto 18px;" />
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(230,57,70,0.16);color:#ffb4ba;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Booking Request Received</div>
          <h1 style="margin:18px 0 10px;font-size:34px;line-height:1.1;color:#ffffff;">Your Booking Is In Review</h1>
          <p style="margin:0 auto;max-width:470px;color:#d4d4d8;font-size:16px;line-height:1.7;">Hi ${booking.full_name || 'there'}, thank you for choosing Tutok Pitik Studios. Your request has been submitted and is now waiting for admin approval.</p>
        </div>
        <div style="padding:0 32px 34px;">
          <div style="background:#18181b;border:1px solid #2b2b31;border-radius:22px;padding:24px;">
            <h2 style="margin:0 0 18px;color:#ffffff;font-size:18px;">Booking Summary</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr><td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">Service</td><td style="padding:10px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #27272a;">${booking.service || 'Photography Session'}</td></tr>
              <tr><td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">Date</td><td style="padding:10px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #27272a;">${bookingDate}</td></tr>
              <tr><td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">Time</td><td style="padding:10px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #27272a;">${bookingTime}</td></tr>
              <tr><td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">Location</td><td style="padding:10px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #27272a;">${booking.location || 'To be confirmed'}</td></tr>
              <tr><td style="padding:14px 0 0;color:#ffb4ba;font-size:13px;font-weight:700;">Estimated Total</td><td style="padding:14px 0 0;color:#ffffff;font-size:26px;font-weight:800;text-align:right;">PHP ${totalAmount}</td></tr>
            </table>
          </div>
          <div style="margin-top:18px;background:#131316;border:1px solid #26262b;border-radius:18px;padding:18px 20px;color:#d4d4d8;font-size:14px;line-height:1.7;">
            You can track the latest booking status anytime in your <strong>Profile &gt; Bookings</strong> tab. Once our team confirms your schedule, you will receive a second confirmation email.
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

    const customerResult = await sendMailgunEmail({
      to: booking.email || auth.user.email,
      subject: 'Booking Request Received | Tutok Pitik Studios',
      html: customerEmailHTML,
    });

    const customerData = customerResult.data;
    if (!customerResult.ok) {
      console.error('Customer booking email failed:', customerData);
      return c.json({ error: 'Failed to send customer booking email', details: customerData }, 500);
    }

    const adminEmailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Inter', Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background-color: #E63946; padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .booking-card { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .booking-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .label { color: #64748b; font-size: 14px; }
    .value { color: #1e293b; font-weight: 600; }
    .alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 New Booking Received</h1>
    </div>
    <div class="content">
      <div class="alert">
        <strong>Action Required:</strong> A new booking needs your attention.
      </div>
      
      <div class="booking-card">
        <h3 style="margin-top: 0; color: #E63946;">Customer Information</h3>
        <div class="booking-row">
          <span class="label">Name:</span>
          <span class="value">${booking.full_name}</span>
        </div>
        <div class="booking-row">
          <span class="label">Email:</span>
          <span class="value">${booking.email}</span>
        </div>
        <div class="booking-row">
          <span class="label">Phone:</span>
          <span class="value">${booking.phone}</span>
        </div>
      </div>
      
      <div class="booking-card">
        <h3 style="margin-top: 0; color: #E63946;">Booking Details</h3>
        <div class="booking-row">
          <span class="label">Service:</span>
          <span class="value">${booking.service}</span>
        </div>
        <div class="booking-row">
          <span class="label">Date:</span>
          <span class="value">${new Date(booking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div class="booking-row">
          <span class="label">Time:</span>
          <span class="value">${booking.start_time} - ${booking.end_time} (${booking.duration}h)</span>
        </div>
        <div class="booking-row">
          <span class="label">Location:</span>
          <span class="value">${booking.location}</span>
        </div>
        <div class="booking-row">
          <span class="label">Total Amount:</span>
          <span class="value" style="color: #E63946; font-size: 18px;">₱${Number(booking.total_price || 0).toLocaleString()}</span>
        </div>
        ${booking.message ? `
        <div class="booking-row" style="flex-direction: column; align-items: flex-start;">
          <span class="label">Message:</span>
          <span class="value" style="margin-top: 8px;">${booking.message}</span>
        </div>` : ''}
      </div>
      
      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Contact the customer to confirm availability</li>
        <li>Discuss any special requirements</li>
        <li>Update booking status in the dashboard</li>
      </ul>
    </div>
  </div>
</body>
</html>`;

    const adminResult = await sendMailgunEmail({
      to: Deno.env.get('BOOKING_NOTIFICATION_EMAIL') || Deno.env.get('SITE_OWNER_EMAIL') || 'admin@tutokpitik.com',
      subject: '🔔 New Booking: ' + booking.service + ' - ' + new Date(booking.booking_date).toLocaleDateString(),
      html: adminEmailHTML,
    });

    const adminData = adminResult.data;
    if (!adminResult.ok) {
      console.error('Admin booking notification failed:', adminData);
      return c.json({ success: true, customerEmail: customerData, adminWarning: adminData });
    }

    return c.json({ 
      success: true, 
      customerEmail: customerData,
      adminEmail: adminData 
    });

  } catch (error) {
    console.error('Send booking email error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-032fda65/send-booking-confirmation-email", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth?.user?.email) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!adminRoles.includes(auth.profile.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { booking } = await c.req.json();
    if (!booking?.email) {
      return c.json({ error: 'Booking email is required' }, 400);
    }

    if (!getSmtpConfig()) {
      return c.json({ error: 'Email service not configured' }, 500);
    }

    const result = await sendBookingConfirmationEmail(booking);
    return c.json({ success: true, confirmationEmail: result });
  } catch (error) {
    console.error('Send booking confirmation email error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-032fda65/send-password-reset-email", async (c) => {
  return c.json({
    error: 'Deprecated endpoint. Use supabase.auth.resetPasswordForEmail from the client application.'
  }, 410);
});

app.post("/make-server-032fda65/send-profile-update-email", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user?.email) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { fullName, updatedFields } = await c.req.json();
    const email = auth.user.email;

    if (!getSmtpConfig()) {
      return c.json({ error: 'Email service not configured' }, 500);
    }

    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Inter', Arial, sans-serif; background-color: #000; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #18181b; }
    .header { background: linear-gradient(135deg, #E63946 0%, #c62e3a 100%); padding: 40px 30px; text-align: center; }
    .header h1 { color: white; font-size: 28px; margin: 0 0 10px 0; }
    .content { padding: 40px 30px; color: #e4e4e7; }
    .update-list { background-color: #27272a; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .update-list li { padding: 8px 0; color: #d4d4d8; }
    .footer { background-color: #09090b; color: #71717a; text-align: center; padding: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Profile Updated</h1>
    </div>
    <div class="content">
      <h2 style="color: white;">Hi ${fullName}!</h2>
      <p>Your profile information has been successfully updated.</p>
      
      <div class="update-list">
        <h3 style="color: #E63946; margin-top: 0;">Updated Fields:</h3>
        <ul>
          ${updatedFields.map(field => `<li>${field}</li>`).join('')}
        </ul>
      </div>
      
      <p>Updated on: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 30px;">If you didn't make these changes, please contact us immediately.</p>
    </div>
    <div class="footer">
      <p><strong>Tutok Pitik Studios</strong></p>
      <p>© ${new Date().getFullYear()} Tutok Pitik Studios. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    const emailResult = await sendMailgunEmail({
      to: email,
      subject: '✅ Profile Updated - Tutok Pitik Studios',
      html: emailHTML,
    });

    if (!emailResult.ok) {
      return c.json({ error: 'Failed to send email', details: emailResult.data }, 500);
    }

    return c.json({ success: true, messageId: emailResult.data?.id || emailResult.data?.message });

  } catch (error) {
    console.error('Send profile update email error:', error);
    return c.json({ error: error.message }, 500);
  }
});


app.post("/make-server-032fda65/bookings", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const bookingData = await c.req.json();
    const payload = {
      user_id: auth.user.id,
      full_name: bookingData.full_name,
      email: bookingData.email || auth.user.email,
      phone: bookingData.phone,
      service: bookingData.service,
      booking_date: bookingData.booking_date,
      start_time: bookingData.start_time,
      end_time: bookingData.end_time,
      duration: bookingData.duration,
      price: bookingData.price,
      transportation_fee: bookingData.transportation_fee ?? bookingData.transportation ?? 0,
      total_price: bookingData.total_price,
      location: bookingData.location,
      message: bookingData.message || '',
      status: 'pending',
    };

    const { data: newBooking, error } = await supabase
      .from('bookings')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    console.log('Booking created successfully:', newBooking.id);
    return c.json({ success: true, booking: newBooking });
  } catch (error) {
    console.error('Create booking error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-032fda65/bookings", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, bookings: bookings || [] });
  } catch (error) {
    console.error('Get bookings error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-032fda65/bookings/all", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!adminRoles.includes(auth.profile.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const { data: allBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, bookings: allBookings || [] });
  } catch (error) {
    console.error('Get all bookings error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-032fda65/bookings/:id", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const bookingId = c.req.param('id');
    const updates = await c.req.json();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) {
      return c.json({ error: bookingError.message }, 500);
    }

    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const isAdmin = adminRoles.includes(auth.profile.role);
    if (booking.user_id !== auth.user.id && !isAdmin) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    ['status', 'service', 'booking_date', 'start_time', 'end_time', 'duration', 'price', 'transportation_fee', 'total_price', 'location', 'message'].forEach((field) => {
      if (updates[field] !== undefined) {
        updatePayload[field] = updates[field];
      }
    });

    const previousStatus = booking.status;
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .select('*')
      .single();

    if (updateError) {
      return c.json({ error: updateError.message }, 500);
    }

    if (isAdmin && updates.status === 'confirmed' && previousStatus !== 'confirmed') {
      try {
        await sendBookingConfirmationEmail(updatedBooking);
      } catch (emailError) {
        console.error('Booking confirmation email error:', emailError);
      }
    }

    return c.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('Update booking error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-032fda65/bookings/:id", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const bookingId = c.req.param('id');
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) {
      return c.json({ error: bookingError.message }, 500);
    }

    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const isAdmin = adminRoles.includes(auth.profile.role);
    if (booking.user_id !== auth.user.id && !isAdmin) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (deleteError) {
      return c.json({ error: deleteError.message }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete booking error:', error);
    return c.json({ error: error.message }, 500);
  }
});


app.get("/make-server-032fda65/favorites", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data, error } = await supabase
      .from('favorites')
      .select('image_id, created_at')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    const favorites = (data || []).map((item) => item.image_id);
    return c.json({ success: true, favorites });
  } catch (error) {
    console.error('Get favorites error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-032fda65/favorites/toggle", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { imageId } = await c.req.json();
    if (!imageId) {
      return c.json({ error: 'imageId is required' }, 400);
    }

    const { data: existingFavorite, error: lookupError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('image_id', imageId)
      .maybeSingle();

    if (lookupError) {
      return c.json({ error: lookupError.message }, 500);
    }

    if (existingFavorite?.id) {
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('id', existingFavorite.id);

      if (deleteError) {
        return c.json({ error: deleteError.message }, 500);
      }
    } else {
      const { error: insertError } = await supabase
        .from('favorites')
        .insert({
          user_id: auth.user.id,
          image_id: imageId,
        });

      if (insertError) {
        return c.json({ error: insertError.message }, 500);
      }
    }

    const { data: updatedFavorites, error: refreshError } = await supabase
      .from('favorites')
      .select('image_id, created_at')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (refreshError) {
      return c.json({ error: refreshError.message }, 500);
    }

    return c.json({ success: true, favorites: (updatedFavorites || []).map((item) => item.image_id) });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-032fda65/favorites/:imageId", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const imageId = c.req.param('imageId');
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('image_id', imageId);

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    const { data: updatedFavorites, error: refreshError } = await supabase
      .from('favorites')
      .select('image_id, created_at')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (refreshError) {
      return c.json({ error: refreshError.message }, 500);
    }

    return c.json({ success: true, favorites: (updatedFavorites || []).map((item) => item.image_id) });
  } catch (error) {
    console.error('Remove favorite error:', error);
    return c.json({ error: error.message }, 500);
  }
});


app.get("/make-server-032fda65/portfolio", async (c) => {
  try {
    const portfolioItems = await kv.getByPrefix('portfolio:');
    console.log(`Retrieved ${portfolioItems.length} portfolio items`);
    return c.json({ success: true, items: portfolioItems });
  } catch (error) {
    console.error('Get portfolio error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-032fda65/portfolio", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!adminRoles.includes(auth.profile.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const itemData = await c.req.json();
    const itemId = `portfolio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newItem = {
      id: itemId,
      ...itemData,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`portfolio:${itemId}`, newItem);
    console.log('Portfolio item created successfully:', itemId);
    return c.json({ success: true, item: newItem });

  } catch (error) {
    console.error('Create portfolio item error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-032fda65/portfolio/:id", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!adminRoles.includes(auth.profile.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const itemId = c.req.param('id');
    const updates = await c.req.json();
    
    const item = await kv.get(`portfolio:${itemId}`);
    if (!item) {
      return c.json({ error: 'Portfolio item not found' }, 404);
    }

    const updatedItem = {
      ...item,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`portfolio:${itemId}`, updatedItem);
    console.log('Portfolio item updated successfully:', itemId);
    return c.json({ success: true, item: updatedItem });

  } catch (error) {
    console.error('Update portfolio item error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-032fda65/portfolio/:id", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!adminRoles.includes(auth.profile.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const itemId = c.req.param('id');
    await kv.del(`portfolio:${itemId}`);
    
    console.log('Portfolio item deleted successfully:', itemId);
    return c.json({ success: true });

  } catch (error) {
    console.error('Delete portfolio item error:', error);
    return c.json({ error: error.message }, 500);
  }
});


app.put("/make-server-032fda65/users/profile", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const updates = await c.req.json();
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    const metadataUpdates: Record<string, unknown> = {
      ...(auth.user.user_metadata || {}),
    };
    let shouldUpdateAuthMetadata = false;

    if (typeof updates.firstName === 'string' || typeof updates.lastName === 'string' || typeof updates.fullName === 'string') {
      const fullName = updates.fullName || [updates.firstName, updates.lastName].filter(Boolean).join(' ').trim();
      if (fullName) payload.full_name = fullName;
    }
    if (typeof updates.phone === 'string') {
      const normalizedPhone = normalizePhoneNumber(updates.phone) || String(updates.phone).trim();
      payload.phone = normalizedPhone;
      metadataUpdates.phone = normalizedPhone;
      metadataUpdates.phone_verified = false;
      shouldUpdateAuthMetadata = true;
    }
    if (typeof updates.username === 'string') {
      payload.username = updates.username;
      metadataUpdates.username = updates.username;
      shouldUpdateAuthMetadata = true;
    }
    if (typeof updates.profilePicture === 'string') {
      payload.profile_picture_url = updates.profilePicture;
      metadataUpdates.profile_picture_url = updates.profilePicture;
      shouldUpdateAuthMetadata = true;
    }
    if (typeof updates.profile_picture_url === 'string') {
      payload.profile_picture_url = updates.profile_picture_url;
      metadataUpdates.profile_picture_url = updates.profile_picture_url;
      shouldUpdateAuthMetadata = true;
    }
    if (typeof updates.address === 'string') payload.address = updates.address;

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(payload)
      .eq('id', auth.user.id)
      .select('*')
      .single();

    if (updateError) {
      return c.json({ error: updateError.message }, 500);
    }

    if (payload.full_name) {
      metadataUpdates.full_name = updatedUser.full_name;
      shouldUpdateAuthMetadata = true;
    }


    if (shouldUpdateAuthMetadata) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(auth.user.id, {
        user_metadata: metadataUpdates,
      });
      if (authUpdateError) {
        return c.json({ error: authUpdateError.message }, 500);
      }
    }

    console.log('User profile updated successfully:', auth.user.id);
    return c.json({ success: true, user: updatedUser, phoneVerified: Boolean(metadataUpdates.phone_verified) });

  } catch (error) {
    console.error('Update user profile error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-032fda65/users", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!contentAdminRoles.includes(auth.profile.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const { email, password, fullName, role, username, status } = await c.req.json();

    if (!email || !password || !fullName) {
      return c.json({ error: 'Email, password, and full name are required' }, 400);
    }

    const { data: createdAuthUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username,
        role: role || 'customer',
      },
    });

    if (createError || !createdAuthUser.user) {
      return c.json({ error: createError?.message || 'Failed to create user' }, 500);
    }

    const { data: createdUser, error: profileError } = await supabase
      .from('users')
      .update({
        username: username || null,
        role: role || 'customer',
        status: status || 'active',
      })
      .eq('id', createdAuthUser.user.id)
      .select('*')
      .single();

    if (profileError) {
      return c.json({ error: profileError.message }, 500);
    }

    return c.json({ success: true, user: createdUser });
  } catch (error) {
    console.error('Create user error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-032fda65/users/all", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!adminRoles.includes(auth.profile.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const { data: allUsers, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    console.log(`Retrieved ${allUsers?.length || 0} total users`);
    return c.json({ success: true, users: allUsers || [] });

  } catch (error) {
    console.error('Get all users error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-032fda65/users/:id", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!contentAdminRoles.includes(auth.profile.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const targetUserId = c.req.param('id');
    const updates = await c.req.json();

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof updates.fullName === 'string' && updates.fullName) dbUpdates.full_name = updates.fullName;
    if (typeof updates.username === 'string') dbUpdates.username = updates.username;
    if (typeof updates.role === 'string') dbUpdates.role = updates.role;
    if (typeof updates.status === 'string') dbUpdates.status = updates.status;
    if (typeof updates.phone === 'string') dbUpdates.phone = updates.phone;

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', targetUserId)
      .select('*')
      .single();

    if (updateError) {
      return c.json({ error: updateError.message }, 500);
    }

    const authUpdates: Record<string, unknown> = {};
    if (typeof updates.password === 'string' && updates.password) authUpdates.password = updates.password;
    if (typeof updates.fullName === 'string' || typeof updates.username === 'string' || typeof updates.role === 'string') {
      authUpdates.user_metadata = {
        full_name: updatedUser.full_name,
        username: updatedUser.username,
        role: updatedUser.role,
      };
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(targetUserId, authUpdates);
      if (authUpdateError) {
        return c.json({ error: authUpdateError.message }, 500);
      }
    }

    return c.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-032fda65/users/:id", async (c) => {
  try {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!contentAdminRoles.includes(auth.profile.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const targetUserId = c.req.param('id');

    if (targetUserId === auth.user.id) {
      return c.json({ error: 'You cannot delete your own account' }, 400);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      return c.json({ error: deleteError.message }, 500);
    }

    await kv.del(`user:${targetUserId}`);
    await kv.del(`favorites:${targetUserId}`);
    await kv.del(`user_bookings:${targetUserId}`);
    
    console.log('User deleted successfully:', targetUserId);
    return c.json({ success: true });

  } catch (error) {
    console.error('Delete user error:', error);
    return c.json({ error: error.message }, 500);
  }
});

Deno.serve(app.fetch);