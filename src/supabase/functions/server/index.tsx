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

// 2. Booking Confirmation Email - Sent to customer when booking is created
app.post("/make-server-032fda65/send-booking-email", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth?.user?.email) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { booking } = await c.req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return c.json({ error: 'Email service not configured' }, 500);
    }

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
      <h1>✅ Booking Confirmed!</h1>
      <p>Thank you for choosing Tutok Pitik Studios</p>
    </div>
    <div class="content">
      <h2 style="color: white;">Hi ${booking.full_name}!</h2>
      <p>Your booking has been received and is currently being processed. We'll contact you shortly to confirm the details.</p>
      
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
          <span class="value total">₱${booking.total_price.toLocaleString()}</span>
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

    // Send to customer
    const customerResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tutok Pitik Studios <onboarding@resend.dev>',
        to: [auth.user.email],
        subject: '✅ Booking Confirmation - Tutok Pitik Studios',
        html: customerEmailHTML,
      }),
    });

    // Admin notification email
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
          <span class="value" style="color: #E63946; font-size: 18px;">₱${booking.total_price.toLocaleString()}</span>
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

    // Send to admin
    const adminResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tutok Pitik Studios <onboarding@resend.dev>',
        to: [Deno.env.get('BOOKING_NOTIFICATION_EMAIL') || Deno.env.get('SITE_OWNER_EMAIL') || 'admin@tutokpitik.com'],
        subject: `🔔 New Booking: ${booking.service} - ${new Date(booking.booking_date).toLocaleDateString()}`,
        html: adminEmailHTML,
      }),
    });

    const customerData = await customerResponse.json();
    const adminData = await adminResponse.json();

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
// BOOKINGS ROUTES - Supabase KV Store Integration
// ============================================================================

// Create a new booking
app.post("/make-server-032fda65/bookings", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const bookingData = await c.req.json();
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newBooking = {
      id: bookingId,
      userId: user.id,
      ...bookingData,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`booking:${bookingId}`, newBooking);
    
    // Add booking ID to user's bookings list
    const userBookings = await kv.get(`user_bookings:${user.id}`) || [];
    userBookings.push(bookingId);
    await kv.set(`user_bookings:${user.id}`, userBookings);

    console.log('Booking created successfully:', bookingId);
    return c.json({ success: true, booking: newBooking });

  } catch (error) {
    console.error('Create booking error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get user's bookings
app.get("/make-server-032fda65/bookings", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const bookingIds = await kv.get(`user_bookings:${user.id}`) || [];
    const bookings = await kv.mget(bookingIds.map(id => `booking:${id}`));

    console.log(`Retrieved ${bookings.length} bookings for user ${user.id}`);
    return c.json({ success: true, bookings: bookings.filter(b => b !== null) });

  } catch (error) {
    console.error('Get bookings error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all bookings (admin only)
app.get("/make-server-032fda65/bookings/all", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check user role from metadata
    const userData = await kv.get(`user:${user.id}`);
    if (!userData || !['superadmin', 'admin', 'staff'].includes(userData.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const allBookings = await kv.getByPrefix('booking:');
    console.log(`Retrieved ${allBookings.length} total bookings`);
    return c.json({ success: true, bookings: allBookings });

  } catch (error) {
    console.error('Get all bookings error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update booking status
app.put("/make-server-032fda65/bookings/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const bookingId = c.req.param('id');
    const updates = await c.req.json();
    
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Check if user owns the booking or is admin
    const userData = await kv.get(`user:${user.id}`);
    const isAdmin = userData && ['superadmin', 'admin', 'staff'].includes(userData.role);
    
    if (booking.userId !== user.id && !isAdmin) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const updatedBooking = {
      ...booking,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`booking:${bookingId}`, updatedBooking);
    console.log('Booking updated successfully:', bookingId);
    return c.json({ success: true, booking: updatedBooking });

  } catch (error) {
    console.error('Update booking error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete booking
app.delete("/make-server-032fda65/bookings/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const bookingId = c.req.param('id');
    const booking = await kv.get(`booking:${bookingId}`);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Check if user owns the booking or is admin
    const userData = await kv.get(`user:${user.id}`);
    const isAdmin = userData && ['superadmin', 'admin', 'staff'].includes(userData.role);
    
    if (booking.userId !== user.id && !isAdmin) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await kv.del(`booking:${bookingId}`);
    
    // Remove from user's bookings list
    const userBookings = await kv.get(`user_bookings:${booking.userId}`) || [];
    const updatedUserBookings = userBookings.filter(id => id !== bookingId);
    await kv.set(`user_bookings:${booking.userId}`, updatedUserBookings);

    console.log('Booking deleted successfully:', bookingId);
    return c.json({ success: true });

  } catch (error) {
    console.error('Delete booking error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// FAVORITES ROUTES - Supabase KV Store Integration
// ============================================================================

// Get user's favorites
app.get("/make-server-032fda65/favorites", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const favorites = await kv.get(`favorites:${user.id}`) || [];
    console.log(`Retrieved ${favorites.length} favorites for user ${user.id}`);
    return c.json({ success: true, favorites });

  } catch (error) {
    console.error('Get favorites error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Toggle favorite
app.post("/make-server-032fda65/favorites/toggle", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { imageId } = await c.req.json();
    const favorites = await kv.get(`favorites:${user.id}`) || [];
    
    let updatedFavorites;
    if (favorites.includes(imageId)) {
      updatedFavorites = favorites.filter(id => id !== imageId);
    } else {
      updatedFavorites = [...favorites, imageId];
    }

    await kv.set(`favorites:${user.id}`, updatedFavorites);
    console.log(`Toggled favorite ${imageId} for user ${user.id}`);
    return c.json({ success: true, favorites: updatedFavorites });

  } catch (error) {
    console.error('Toggle favorite error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Remove favorite
app.delete("/make-server-032fda65/favorites/:imageId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const imageId = c.req.param('imageId');
    const favorites = await kv.get(`favorites:${user.id}`) || [];
    const updatedFavorites = favorites.filter(id => id !== imageId);

    await kv.set(`favorites:${user.id}`, updatedFavorites);
    console.log(`Removed favorite ${imageId} for user ${user.id}`);
    return c.json({ success: true, favorites: updatedFavorites });

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
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (!userData || !['superadmin', 'admin', 'staff'].includes(userData.role)) {
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
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (!userData || !['superadmin', 'admin', 'staff'].includes(userData.role)) {
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
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (!userData || !['superadmin', 'admin', 'staff'].includes(userData.role)) {
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
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const updates = await c.req.json();
    const userData = await kv.get(`user:${user.id}`);
    
    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updatedUser = {
      ...userData,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`user:${user.id}`, updatedUser);
    console.log('User profile updated successfully:', user.id);
    return c.json({ success: true, user: updatedUser });

  } catch (error) {
    console.error('Update user profile error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all users (admin only)
app.get("/make-server-032fda65/users/all", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (!userData || !['superadmin', 'admin', 'staff'].includes(userData.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const allUsers = await kv.getByPrefix('user:');
    console.log(`Retrieved ${allUsers.length} total users`);
    return c.json({ success: true, users: allUsers });

  } catch (error) {
    console.error('Get all users error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete user (admin only)
app.delete("/make-server-032fda65/users/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (!userData || !['superadmin', 'admin'].includes(userData.role)) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    const targetUserId = c.req.param('id');
    
    // Delete user data
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