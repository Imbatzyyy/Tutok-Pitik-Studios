import { Hono } from "npm:hono@4.13.17";
import { cors } from "npm:hono@4.13.17/cors";
import { logger } from "npm:hono@4.13.17/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js";
import { accountContent, STUDIO_EMAIL } from "../_shared/email.ts";

import { hasPortalSession } from "../_shared/admin-session.ts";

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

async function sendAccountEmail(to: string, kind: 'welcome' | 'profile', name: string, idempotencyKey: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  if (!key || !from) throw new Error('Email service unavailable');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from, to: [to], reply_to: STUDIO_EMAIL, ...accountContent(kind, name) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Email delivery unavailable');
  return (await response.json()).id;
}

async function requireAuthenticatedProfile(c: any) {
  const auth = await requireAuthenticatedUser(c);
  if (!auth) {
    return null;
  }

  const profile = await getDatabaseUser(auth.user.id);
  if (!profile || (profile.status ?? 'active') !== 'active') {
    return null;
  }

  if (['superadmin','super_admin','admin','staff'].includes(profile.role) && !(await hasPortalSession(supabase,auth.accessToken,auth.user.id))) return null;

  return {
    ...auth,
    profile: { ...profile, role: profile.role === 'super_admin' ? 'superadmin' : profile.role },
  };
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

// The current website uses Supabase Auth directly, preserving verification and
// provider rate limits. The legacy service-role signup bypass is retired.
app.post('/make-server-032fda65/auth/signup', c => c.json({ error: 'Use the website signup form to verify your email address.' }, 410));

for (const [path, kind] of [['send-welcome-email', 'welcome'], ['send-profile-update-email', 'profile']] as const) {
  app.post(`/make-server-032fda65/${path}`, async c => {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth?.user?.email || !auth.user.email_confirmed_at) return c.json({ error: 'Verified account required' }, 401);
    try {
      // Names and recipients are read from the authenticated account, not JSON.
      const version = kind === 'welcome' ? 'initial' : auth.profile.updated_at;
      const messageId = await sendAccountEmail(auth.user.email, kind, auth.profile.full_name,
        `tps-account/${kind}/${auth.user.id}/${version}`);
      return c.json({ success: true, messageId });
    } catch {
      return c.json({ error: 'Email delivery is temporarily unavailable' }, 503);
    }
  });
}

async function dispatchBookingEmails(bookingId: string, accessToken: string) {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/booking-emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ bookingId }),
  });
  return response.ok;
}

// Compatibility routes for existing clients. Recipients, content and send-once
// state come exclusively from the database queue, never the posted booking.
for (const path of ['/send-booking-email', '/send-booking-confirmation-email']) {
  app.post(`/make-server-032fda65${path}`, async (c) => {
    const auth = await requireAuthenticatedProfile(c);
    if (!auth) return c.json({ error: 'Unauthorized' }, 401);
    let payload: any;
    try { payload = await c.req.json(); } catch { return c.json({ error: 'Invalid request' }, 400); }
    const id = payload?.bookingId || payload?.booking?.id;
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return c.json({ error: 'Booking ID required' }, 400);
    const { data: booking } = await supabase.from('bookings').select('user_id').eq('id', id).maybeSingle();
    if (!booking || (booking.user_id !== auth.user.id && !adminRoles.includes(auth.profile.role))) return c.json({ error: 'Booking not found' }, 404);
    try { await dispatchBookingEmails(id, auth.accessToken); } catch { /* scheduled queue retries */ }
    return c.json({ success: true, queued: true });
  });
}

app.post("/make-server-032fda65/send-password-reset-email", async (c) => {
  return c.json({
    error: 'Deprecated endpoint. Use supabase.auth.resetPasswordForEmail from the client application.'
  }, 410);
});

app.post("/make-server-032fda65/bookings", async (c) => {
 const auth=await requireAuthenticatedProfile(c);if(!auth)return c.json({error:'Unauthorized'},401);
 return c.json({error:'This legacy action is retired. Use the studio workspace and its validated booking or account actions.'},410);
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
 const auth=await requireAuthenticatedProfile(c);if(!auth)return c.json({error:'Unauthorized'},401);
 return c.json({error:'This legacy action is retired. Use the studio workspace and its validated booking or account actions.'},410);
});

app.put("/make-server-032fda65/bookings/:id", async (c) => {
 const auth=await requireAuthenticatedProfile(c);if(!auth)return c.json({error:'Unauthorized'},401);
 return c.json({error:'This legacy action is retired. Use the studio workspace and its validated booking or account actions.'},410);
});

app.delete("/make-server-032fda65/bookings/:id", async (c) => {
 const auth=await requireAuthenticatedProfile(c);if(!auth)return c.json({error:'Unauthorized'},401);
 return c.json({error:'This legacy action is retired. Use the studio workspace and its validated booking or account actions.'},410);
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

    if (!contentAdminRoles.includes(auth.profile.role)) {
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

    if (!contentAdminRoles.includes(auth.profile.role)) {
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

    if (!contentAdminRoles.includes(auth.profile.role)) {
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

    if (auth.profile.role !== 'superadmin') {
      return c.json({ error: 'Forbidden - Superadmin access required' }, 403);
    }

    const { email, fullName, role, username } = await c.req.json();

    if (typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||typeof fullName!=='string'||fullName.trim().length<2||fullName.length>200) {
      return c.json({ error: 'A valid email and full name are required' }, 400);
    }

    if (!['staff','admin','superadmin'].includes(role)) return c.json({error:'Invalid role'},400);

    const { data: createdAuthUser, error: createError } = await supabase.auth.admin.inviteUserByEmail(email.trim(),{
      redirectTo:'https://tutokpitikstudios.com/reset-password?studio=1',
      data:{full_name:fullName.trim(),username:username||undefined}
    });

    if (createError || !createdAuthUser.user) {
      return c.json({ error: createError?.message || 'Failed to create user' }, 500);
    }

    const { data: createdUser, error: profileError } = await supabase
      .from('users')
      .update({
        username: username || null,
        role,
        status:'active',
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

    if (auth.profile.role !== 'superadmin') {
      return c.json({ error: 'Forbidden - Superadmin access required' }, 403);
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

    if (auth.profile.role !== 'superadmin') {
      return c.json({ error: 'Forbidden - Superadmin access required' }, 403);
    }

    const targetUserId = c.req.param('id');
    const updates = await c.req.json();
    if ('password' in updates) return c.json({error:'The account owner must reset their own password.'},400);

    if (updates.role !== undefined && !['customer','staff','admin','superadmin'].includes(updates.role)) return c.json({error:'Invalid role'},400);
    if (updates.status !== undefined && !['active','inactive','suspended'].includes(updates.status)) return c.json({error:'Invalid status'},400);
    if (targetUserId === auth.user.id && ((updates.role && updates.role !== 'superadmin') || (updates.status && updates.status !== 'active'))) return c.json({error:'You cannot remove your own superadmin access'},400);

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
    // Passwords are set only by the account owner through provider recovery/invitation.
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
 const auth=await requireAuthenticatedProfile(c);if(!auth)return c.json({error:'Unauthorized'},401);
 return c.json({error:'This legacy action is retired. Use the studio workspace and its validated booking or account actions.'},410);
});

Deno.serve(app.fetch);
