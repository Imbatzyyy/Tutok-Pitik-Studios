# 🚀 Supabase Integration Guide

## Complete Setup for Tutok Pitik Studios with Supabase + Netlify

Your app now uses Supabase for:
- ✅ **Authentication** - Secure user login/registration
- ✅ **Database** - PostgreSQL for all data
- ✅ **Storage** - Real file storage for images (not base64!)
- ✅ **Real-time** - Live updates (optional)
- ✅ **Row Level Security** - Automatic permission control

---

## 🎯 Step 1: Create Supabase Project

### 1.1 Sign Up for Supabase

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign in with GitHub (recommended)
4. Click "New project"

### 1.2 Create Project

Fill in:
- **Name**: `tutok-pitik-studios`
- **Database Password**: (save this - you'll need it)
- **Region**: Choose closest to your users (e.g., Southeast Asia)
- **Pricing Plan**: Free tier works great!

Click "Create new project" - wait 2-3 minutes for setup.

---

## 🎯 Step 2: Get Supabase Credentials

### 2.1 Find Your Project URL and Keys

1. In Supabase Dashboard, click your project
2. Go to **Settings** (gear icon) → **API**
3. Copy these values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:** 
- `anon public` key is SAFE to use in frontend
- Don't use `service_role` key in frontend (it bypasses RLS)

### 2.2 Save for Later

You'll need:
- ✅ Project URL
- ✅ anon public key

---

## 🎯 Step 3: Run Database Schema

### 3.1 Open SQL Editor

1. In Supabase Dashboard → **SQL Editor**
2. Click "New query"

### 3.2 Run Schema

Copy ALL contents from `/database/supabase-schema.sql` and paste into SQL Editor.

Click **RUN** (or Ctrl/Cmd + Enter)

You should see: ✅ Success. No rows returned

### 3.3 Verify Tables Created

Go to **Table Editor** - you should see:
- `users`
- `bookings`
- `portfolio_images`
- `favorites`
- `contact_messages`

### 3.4 Verify Storage Buckets

Go to **Storage** - you should see:
- `profile-pictures` (public)
- `portfolio` (public)

---

## 🎯 Step 4: Configure Environment Variables

### 4.1 Local Development

Create `.env` file in your project root:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_NETLIFY_SITE_URL=http://localhost:3000
```

Replace with YOUR values from Step 2.

### 4.2 Netlify Production

1. Go to Netlify Dashboard
2. Select your site
3. **Site settings** → **Environment variables**
4. Click "Add a variable"

Add these THREE variables:

**Variable 1:**
- Key: `VITE_SUPABASE_URL`
- Value: `https://xxxxxxxxxxxxx.supabase.co`

**Variable 2:**
- Key: `VITE_SUPABASE_ANON_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Variable 3:**
- Key: `VITE_NETLIFY_SITE_URL`
- Value: `https://your-site.netlify.app`

**Why VITE_ prefix?**
- These are safe public keys designed for frontend use
- Supabase RLS (Row Level Security) handles permissions
- No sensitive data exposed

---

## 🎯 Step 5: Install Dependencies

```bash
npm install
```

This installs `@supabase/supabase-js` package.

---

## 🎯 Step 6: Deploy to Netlify

### Option A: GitHub Auto-Deploy (Recommended)

```bash
git add .
git commit -m "Integrate Supabase database"
git push
```

Netlify will automatically build and deploy!

### Option B: Manual Deploy

```bash
npm run build
netlify deploy --prod
```

---

## 🎯 Step 7: Test the Integration

### 7.1 Test User Registration

1. Go to your deployed site
2. Click "Login" → "Create Account"
3. Fill in:
   - Full Name: `Test User`
   - Email: `test@example.com`
   - Password: `test123456` (min 6 chars)
   - Role: `Customer`
4. Click "Create Account"

**Verify in Supabase:**
1. Go to Supabase → **Authentication** → **Users**
2. You should see your new user!
3. Go to **Table Editor** → **users**
4. You should see user profile with role!

### 7.2 Test Profile Picture Upload

1. Login with account from 7.1
2. Click profile icon (top right)
3. Click "Edit Profile"
4. Click "Change Picture"
5. Select an image
6. Click "Upload"

**Verify in Supabase:**
1. Go to **Storage** → **profile-pictures**
2. You should see your uploaded image!
3. Click image to view it

### 7.3 Test Booking Creation

1. Stay logged in as customer
2. Scroll to "Book a Session"
3. Fill booking form
4. Submit

**Verify in Supabase:**
1. Go to **Table Editor** → **bookings**
2. You should see your booking!

---

## 🎨 What You Get with Supabase

### ✅ Authentication

**Built-in Features:**
- Email/password authentication
- Email confirmation (optional)
- Password reset
- Session management
- JWT tokens
- Social auth (Google, Facebook, etc.) - optional

**How it works in your app:**
```typescript
// Register
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      full_name: 'John Doe',
      role: 'customer'
    }
  }
});

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// Get current user
const { data: { user } } = await supabase.auth.getUser();
```

### ✅ Database

**Features:**
- PostgreSQL database
- Row Level Security (RLS)
- Automatic timestamps
- Foreign keys and constraints
- Indexes for performance

**How to query:**
```typescript
// Get all bookings (automatically filtered by RLS)
const { data, error } = await supabase
  .from('bookings')
  .select('*')
  .order('created_at', { ascending: false });

// Create booking
const { data, error } = await supabase
  .from('bookings')
  .insert({
    full_name: 'John Doe',
    service: 'Portrait Photography',
    // ...
  });
```

### ✅ Storage

**Features:**
- Real file storage (not base64!)
- Public/private buckets
- CDN distribution
- Image transformations
- Access control

**How to upload:**
```typescript
// Upload profile picture
const file = event.target.files[0];
const { data, error } = await supabase.storage
  .from('profile-pictures')
  .upload(`${userId}/avatar.jpg`, file);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('profile-pictures')
  .getPublicUrl(`${userId}/avatar.jpg`);
```

---

## 🔐 Row Level Security (RLS)

Supabase automatically enforces permissions!

### How it Works:

**Users Table:**
- ✅ Users can view/edit their own profile
- ✅ Admins can view all profiles
- ❌ Customers cannot view other customers

**Bookings Table:**
- ✅ Users can view their own bookings
- ✅ Users can create bookings
- ✅ Admins can view/edit all bookings
- ❌ Customers cannot see others' bookings

**Portfolio Images:**
- ✅ Everyone can view
- ✅ Admins can upload/delete
- ❌ Customers cannot upload

**Storage:**
- ✅ Users can upload their own profile picture
- ✅ Admins can upload portfolio images
- ✅ Everyone can view public images

**This is automatic!** No code needed - defined in SQL schema.

---

## 📊 Database Schema

### users Table
```sql
id                  UUID (links to auth.users)
username            VARCHAR(50) UNIQUE
full_name           VARCHAR(100) NOT NULL
email               VARCHAR(255) UNIQUE NOT NULL
phone               VARCHAR(20)
role                VARCHAR(20) (super_admin, admin, staff, customer, guest)
profile_picture_url TEXT (Supabase Storage URL)
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

### bookings Table
```sql
id                  UUID PRIMARY KEY
user_id             UUID (references users)
full_name           VARCHAR(100) NOT NULL
email               VARCHAR(255) NOT NULL
phone               VARCHAR(20) NOT NULL
service             VARCHAR(100) NOT NULL
booking_date        DATE NOT NULL
start_time          TIME NOT NULL
end_time            TIME NOT NULL
duration            DECIMAL(4,2) NOT NULL
price               DECIMAL(10,2) NOT NULL
transportation_fee  DECIMAL(10,2)
total_price         DECIMAL(10,2) NOT NULL
location            TEXT NOT NULL
message             TEXT
status              VARCHAR(20) (pending, confirmed, completed, cancelled)
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

### portfolio_images Table
```sql
id          UUID PRIMARY KEY
title       VARCHAR(255) NOT NULL
category    VARCHAR(100) NOT NULL
subcategory VARCHAR(100) NOT NULL
image_url   TEXT (Supabase Storage URL)
created_at  TIMESTAMP
```

---

## 🎯 Key Features

### Profile Pictures
- **Upload**: Users select image → Uploaded to Supabase Storage
- **Storage**: Stored in `profile-pictures/{userId}/avatar.jpg`
- **Display**: Public URL displayed in navigation
- **Size**: Recommend max 2MB
- **Format**: JPEG, PNG, WebP, GIF

### Portfolio Images
- **Upload**: Admins upload → Supabase Storage
- **Storage**: `portfolio/{category}/{imageId}.jpg`
- **Display**: Public CDN URLs
- **Categories**: 5 main × 5 sub = 25 total
- **Management**: Full CRUD for admins

### Bookings
- **Create**: Customers fill form → Saved to database
- **View**: Users see theirs, admins see all
- **Update**: Admins change status
- **Limit**: 3 active bookings per user (checked via RLS)
- **Email**: Still uses Netlify Forms for notifications

---

## 🐛 Troubleshooting

### Error: "Invalid API key"

**Fix:**
1. Check `.env` file has correct `VITE_SUPABASE_ANON_KEY`
2. Verify you copied `anon public` key (not service_role)
3. Restart dev server: `npm run dev`

### Error: "Row Level Security policy violation"

**Fix:**
1. User not logged in (RLS blocks anonymous users)
2. User doesn't have permission (check role)
3. Re-run schema SQL to create policies

### Profile Picture Not Uploading

**Fix:**
1. Check Storage → profile-pictures bucket exists
2. Verify storage policies were created
3. Check browser console for errors
4. Ensure user is logged in

### Can't See Other Users' Data

**This is correct!** RLS is working. Users should only see their own data unless they're admins.

### Schema Error When Running SQL

**Fix:**
1. Make sure you ran entire schema file
2. Check for error messages in SQL Editor
3. Try running in sections if needed
4. Ensure UUID extension enabled

---

## 📈 Monitoring

### Supabase Dashboard

**Database:**
- Table Editor - View/edit data
- SQL Editor - Run queries
- Database - See size and activity

**Authentication:**
- Users - All registered users
- Policies - RLS rules

**Storage:**
- Browse buckets
- View file sizes
- Check public URLs

**API:**
- API docs (auto-generated!)
- Usage statistics

### Netlify Dashboard

**Functions:**
- Not needed! Supabase handles everything
- Only use Netlify Forms for email

**Analytics:**
- See site traffic
- Form submissions

---

## ✅ Success Checklist

Your Supabase integration is working when:

- [ ] Supabase project created
- [ ] Schema executed successfully
- [ ] Storage buckets exist
- [ ] Environment variables set (local + Netlify)
- [ ] Site deployed
- [ ] Users can register
- [ ] Users can login
- [ ] Profile pictures upload and display
- [ ] Bookings save to database
- [ ] Admins can access dashboard
- [ ] RLS blocks unauthorized access
- [ ] Images stored in Storage (not database)

---

## 🎓 Admin Account Setup

### Create Super Admin

Run this SQL in Supabase SQL Editor:

```sql
-- First, sign up normally through the UI with admin@tutokpitik.com
-- Then update the role:

UPDATE public.users
SET role = 'super_admin'
WHERE email = 'admin@tutokpitik.com';
```

Or use the Supabase UI:
1. Register: `admin@tutokpitik.com` / `admin123456`
2. Go to Table Editor → users
3. Find your user row
4. Change `role` to `super_admin`
5. Click checkmark to save

---

## 🔥 Advantages Over Neon

✅ **Built-in Authentication** - No custom JWT needed
✅ **Real File Storage** - No base64 in database
✅ **Row Level Security** - Automatic permissions
✅ **Storage CDN** - Fast image delivery
✅ **Real-time Updates** - Optional live data
✅ **Better DX** - Great dashboard and docs
✅ **More Features** - Auth, storage, functions, more
✅ **Free Tier** - Very generous limits

---

## 📞 Support

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **Email**: tutokpitikstudios@gmail.com

---

## 🎉 You're All Set!

Your app now has:
- ✅ Supabase authentication
- ✅ PostgreSQL database
- ✅ Real file storage
- ✅ Row-level security
- ✅ Automatic permissions
- ✅ Production-ready setup

**No serverless functions needed - Supabase handles everything!**

Start building! 🚀
