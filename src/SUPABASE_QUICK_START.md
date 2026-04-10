# ⚡ Supabase Quick Start - 5 Minutes

Get your app running with Supabase in 5 simple steps!

---

## Step 1: Create Supabase Project (2 min)

1. Go to https://supabase.com
2. Sign in → "New project"
3. Fill in:
   - Name: `tutok-pitik-studios`
   - Password: (save this!)
   - Region: Southeast Asia
4. Click "Create new project"
5. Wait 2-3 minutes ☕

---

## Step 2: Run Database Schema (1 min)

1. In Supabase → **SQL Editor** → "New query"
2. Open `/database/supabase-schema.sql` in your code editor
3. Copy ALL the SQL
4. Paste into Supabase SQL Editor
5. Click **RUN** (or Cmd/Ctrl + Enter)
6. See: ✅ Success!

---

## Step 3: Get Your Keys (30 sec)

1. In Supabase → **Settings** → **API**
2. Copy these two values:

```
Project URL: https://xxxxx.supabase.co
anon public: eyJhbGc...
```

---

## Step 4: Set Environment Variables (1 min)

### Local (Development)

Create `.env` file:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_NETLIFY_SITE_URL=http://localhost:3000
```

### Netlify (Production)

1. Netlify Dashboard → Your site → **Site settings** → **Environment variables**
2. Add these 3 variables:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   - `VITE_NETLIFY_SITE_URL` = your Netlify site URL

---

## Step 5: Deploy! (30 sec)

```bash
# Install dependencies
npm install

# Deploy
git add .
git commit -m "Integrate Supabase"
git push
```

Done! Netlify will auto-deploy.

---

## ✅ Test It Works

### Test 1: Register User

1. Go to your site
2. Click "Login" → "Create Account"
3. Fill form and submit
4. Check Supabase → **Authentication** → Users
5. See your new user! ✅

### Test 2: Upload Profile Picture

1. Login
2. Click profile icon → "Edit Profile"
3. Upload a picture
4. Check Supabase → **Storage** → profile-pictures
5. See your image! ✅

### Test 3: Create Booking

1. Fill booking form
2. Submit
3. Check Supabase → **Table Editor** → bookings
4. See your booking! ✅

---

## 🎉 That's It!

You now have:
- ✅ Supabase authentication
- ✅ PostgreSQL database
- ✅ File storage for images
- ✅ Row-level security
- ✅ Production deployment

**Total time: ~5 minutes!**

---

## 🐛 Quick Fixes

**Site shows "Invalid API key":**
- Check `.env` file exists
- Verify keys are correct
- Restart: `npm run dev`

**Can't upload images:**
- Check Storage buckets exist
- Re-run schema SQL
- Check browser console for errors

**Deployment failed:**
- Check Netlify environment variables set
- Trigger manual deploy

---

## 📚 Next Steps

- Read [SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md) for details
- Create admin account (see guide)
- Upload portfolio images
- Test all features

---

**Need help?** Check the full guide: [SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md)
