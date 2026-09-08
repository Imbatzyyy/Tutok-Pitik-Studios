import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js";

const app = new Hono();

// Initialize Supabase client
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
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY || !booking?.email) {
    return null;
  }

  const confirmationEmailHTML = `
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
    .booking-card { background-color: #27272a; border-left: 4px solid #E63946; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .booking-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #3f3f46; }
    .booking-row:last-child { border-bottom: none; }
    .label { color: #a1a1aa; font-size: 13px; }
    .value { color: white; font-weight: 600; }
    .total { font-size: 20px; color: #E63946; }
    .footer { background-color: #09090b; color: #71717a; text-align: center; padding: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Booking Approved!</h1>
      <p>Your schedule with Tutok Pitik Studios is now confirmed</p>
    </div>
    <div class="content">
      <h2 style="color: white;">Hi ${booking.full_name || 'there'}!</h2>
      <p>Your booking request has been approved by our team. We look forward to working with you.</p>
      <div class="booking-card">
        <h3 style="color: #E63946; margin-top: 0;">Confirmed Booking Details</h3>
        <div class="booking-row"><span class="label">Service:</span><span class="value">${booking.service}</span></div>
        <div class="booking-row"><span class="label">Date:</span><span class="value">${new Date(booking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
        <div class="booking-row"><span class="label">Time:</span><span class="value">${booking.start_time} - ${booking.end_time}</span></div>
        <div class="booking-row"><span class="label">Location:</span><span class="value">${booking.location}</span></div>
        <div class="booking-row"><span class="label">Total Amount:</span><span class="value total">₱${Number(booking.total_price || 0).toLocaleString()}</span></div>
      </div>
      <p>If you need to make any changes, please reply to this email as soon as possible.</p>
    </div>
    <div class="footer">
      <p><strong>Tutok Pitik Studios</strong></p>
      <p>Thank you for trusting our team with your shoot.</p>
    </div>
  </div>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Tutok Pitik Studios <onboarding@resend.dev>',
      to: [booking.email],
      subject: '✅ Booking Approved - Tutok Pitik Studios',
      html: confirmationEmailHTML,
    }),
  });

  return response.ok ? await response.json() : null;
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for trusted frontend origins
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

// Health check endpoint
app.get("/make-server-032fda65/health", (c) => {
  return c.json({ status: "ok" });
});

// ============================================================================
// EMAIL NOTIFICATION ROUTES - Version 123
// ============================================================================

// 1. Welcome Email - Sent on user signup
app.post("/make-server-032fda65/send-welcome-email", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user?.email) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { fullName } = await c.req.json();
    const email = auth.user.email;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
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

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tutok Pitik Studios <onboarding@resend.dev>',
        to: [email],
        subject: '📸 Welcome to Tutok Pitik Studios!',
        html: emailHTML,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Resend API error:', data);
      return c.json({ error: 'Failed to send email', details: data }, 500);
    }

    console.log('Welcome email sent successfully:', data);
    return c.json({ success: true, messageId: data.id });

  } catch (error) {
    console.error('Send welcome email error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// 2. Booking Receipt Email - Sent to customer when booking is created
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

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'Tutok Pitik Studios <onboarding@resend.dev>';
    if (!RESEND_API_KEY) {
      return c.json({ error: 'Email service not configured' }, 500);
    }

    const parseResendResponse = async (response: Response) => {
      const raw = await response.text();
      try {
        return raw ? JSON.parse(raw) : null;
      } catch {
        return { raw };
      }
    };

    // Customer confirmation email
    const customerEmailHTML = `
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
    .booking-card { background-color: #27272a; border-left: 4px solid #E63946; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .booking-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #3f3f46; }
    .booking-row:last-child { border-bottom: none; }
    .label { color: #a1a1aa; font-size: 13px; }
    .value { color: white; font-weight: 600; }
    .total { font-size: 20px; color: #E63946; }
    .footer { background-color: #09090b; color: #71717a; text-align: center; padding: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📝 Booking Received</h1>
      <p>Thank you for sending your request to Tutok Pitik Studios</p>
    </div>
    <div class="content">
      <h2 style="color: white;">Hi ${booking.full_name}!</h2>
      <p>Your booking request has been received and is now waiting for admin approval. We will send another email once your schedule is officially confirmed.</p>
      
      <div class="booking-card">
        <h3 style="color: #E63946; margin-top: 0;">Booking Details</h3>
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
          <span class="value">${booking.start_time} - ${booking.end_time}</span>
        </div>
        <div class="booking-row">
          <span class="label">Duration:</span>
          <span class="value">${booking.duration} hours</span>
        </div>
        <div class="booking-row">
          <span class="label">Location:</span>
          <span class="value">${booking.location}</span>
        </div>
        <div class="booking-row">
          <span class="label">Total Amount:</span>
          <span class="value total">₱${Number(booking.total_price || 0).toLocaleString()}</span>
        </div>
      </div>
      
      <p><strong>What's Next?</strong></p>
      <p>Our team will review your booking and contact you within 24 hours to confirm availability and discuss any special requirements.</p>
      <p>If you have any questions, feel free to reply to this email or contact us directly.</p>
    </div>
    <div class="footer">
      <p><strong>Tutok Pitik Studios</strong></p>
      <p>Email: contact@tutokpitik.com | Phone: +63 XXX XXX XXXX</p>
    </div>
  </div>
</body>
</html>`;

    const customerResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [booking.email || auth.user.email],
        subject: '✅ Booking Confirmation - Tutok Pitik Studios',
        html: customerEmailHTML,
      }),
    });

    const customerData = await parseResendResponse(customerResponse);
    if (!customerResponse.ok) {
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

    const adminResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [Deno.env.get('BOOKING_NOTIFICATION_EMAIL') || Deno.env.get('SITE_OWNER_EMAIL') || 'admin@tutokpitik.com'],
        subject: `🔔 New Booking: ${booking.service} - ${new Date(booking.booking_date).toLocaleDateString()}`,
        html: adminEmailHTML,
      }),
    });

    const adminData = await parseResendResponse(adminResponse);
    if (!adminResponse.ok) {
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

// 3. Password Reset Email
app.post("/make-server-032fda65/send-password-reset-email", async (c) => {
  return c.json({
    error: 'Deprecated endpoint. Use supabase.auth.resetPasswordForEmail from the client application.'
  }, 410);
});

// 4. Profile Update Notification Email
app.post("/make-server-032fda65/send-profile-update-email", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user?.email) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { fullName, updatedFields } = await c.req.json();
    const email = auth.user.email;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
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

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tutok Pitik Studios <onboarding@resend.dev>',
        to: [email],
        subject: '✅ Profile Updated - Tutok Pitik Studios',
        html: emailHTML,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return c.json({ error: 'Failed to send email' }, 500);
    }

    return c.json({ success: true, messageId: data.id });

  } catch (error) {
    console.error('Send profile update email error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// BOOKINGS ROUTES - Supabase Database Integration
// ============================================================================

// Create a new booking
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

// Get user's bookings
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

// Get all bookings (admin only)
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

// Update booking status
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

// Delete booking
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

// ============================================================================
// FAVORITES ROUTES - Supabase Database Integration
// ============================================================================

// Get user's favorites
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

// Toggle favorite
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

// Remove favorite
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

// ============================================================================
// PORTFOLIO ROUTES - Supabase KV Store Integration
// ============================================================================

// Get all portfolio items
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

// Create portfolio item (admin only)
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

// Update portfolio item (admin only)
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

// Delete portfolio item (admin only)
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

// ============================================================================
// USER PROFILE ROUTES - Supabase KV Store Integration
// ============================================================================

// Update user profile
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

    if (typeof updates.firstName === 'string' || typeof updates.lastName === 'string' || typeof updates.fullName === 'string') {
      const fullName = updates.fullName || [updates.firstName, updates.lastName].filter(Boolean).join(' ').trim();
      if (fullName) payload.full_name = fullName;
    }
    if (typeof updates.email === 'string' && updates.email) payload.email = updates.email;
    if (typeof updates.phone === 'string') payload.phone = updates.phone;
    if (typeof updates.username === 'string') payload.username = updates.username;
    if (typeof updates.profilePicture === 'string') payload.profile_picture_url = updates.profilePicture;
    if (typeof updates.profile_picture_url === 'string') payload.profile_picture_url = updates.profile_picture_url;
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

    console.log('User profile updated successfully:', auth.user.id);
    return c.json({ success: true, user: updatedUser });

  } catch (error) {
    console.error('Update user profile error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create user (admin only)
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

// Get all users (admin only)
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

// Update user (admin only)
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
    if (typeof updates.email === 'string' && updates.email) dbUpdates.email = updates.email;
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
    if (typeof updates.email === 'string' && updates.email) authUpdates.email = updates.email;
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

// Delete user (admin only)
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