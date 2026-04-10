# 🚀 Netlify Deployment Guide - Tutok Pitik Studios

## **Your Production Credentials**

```
Site URL: https://tutokpitikstudios.netlify.app
Supabase Project: wztiuvgmxivogvhqaxvu
```

---

## **Step 1: Set Environment Variables in Netlify**

### **Go to Netlify Dashboard:**
1. Visit: https://app.netlify.com
2. Login to your account
3. Select your site: **Tutok Pitik Studios**

### **Navigate to Environment Variables:**
1. Click **Site settings** (top navigation)
2. Left sidebar → Click **Environment variables**
3. Or go directly to: `https://app.netlify.com/sites/[your-site-name]/settings/deploys#environment-variables`

### **Add These 3 Variables:**

Click **"Add a variable"** for each:

#### **1. VITE_SUPABASE_URL**
```
Key: VITE_SUPABASE_URL
Value: https://wztiuvgmxivogvhqaxvu.supabase.co
```
- Select: **All scopes** (production, preview, branch deploys)
- Click **"Create variable"**

#### **2. VITE_SUPABASE_ANON_KEY**
```
Key: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dGl1dmdteGl2b2d2aHFheHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjEzMzksImV4cCI6MjA5MTI5NzMzOX0.pb2UCCD1akv5e7uxfEzlxzj29kCOuB-N7HLE0glYMQk
```
- Select: **All scopes**
- Click **"Create variable"**

#### **3. VITE_NETLIFY_SITE_URL**
```
Key: VITE_NETLIFY_SITE_URL
Value: https://tutokpitikstudios.netlify.app
```
- Select: **All scopes**
- Click **"Create variable"**

### **Verify All 3 Variables:**
You should now see:
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `VITE_NETLIFY_SITE_URL`

---

## **Step 2: Configure Build Settings**

### **Build Settings:**
1. Go to: **Site settings → Build & deploy → Build settings**
2. Verify these settings:

```
Build command: npm run build
Publish directory: dist
```

### **Node Version (Optional):**
Create a `.nvmrc` file in your project root:
```
18
```

Or add to `netlify.toml`:
```toml
[build.environment]
  NODE_VERSION = "18"
```

---

## **Step 3: Deploy to Netlify**

### **Option A: Via Git (Recommended)**

1. **Push to Git:**
   ```bash
   git add .
   git commit -m "Update environment variables for production"
   git push origin main
   ```

2. **Automatic Deploy:**
   - Netlify will automatically detect the push
   - Build will start automatically
   - Check: **Deploys** tab in Netlify dashboard

3. **Monitor Build:**
   - Click on the deploy to see build logs
   - Wait for build to complete (usually 2-3 minutes)
   - Look for: ✅ **Published**

### **Option B: Manual Deploy**

1. **Build Locally:**
   ```bash
   npm run build
   ```

2. **Deploy via Netlify CLI:**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli
   
   # Login
   netlify login
   
   # Deploy
   netlify deploy --prod
   ```

3. **Or via Netlify Dashboard:**
   - Go to **Deploys** tab
   - Drag and drop your `dist` folder

---

## **Step 4: Verify Deployment**

### **1. Check Site is Live:**
- Visit: https://tutokpitikstudios.netlify.app
- Should load without errors
- Check browser console (F12) for errors

### **2. Test Environment Variables:**
Open browser console and run:
```javascript
// Should NOT show undefined
console.log(import.meta.env.VITE_SUPABASE_URL);
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log(import.meta.env.VITE_NETLIFY_SITE_URL);
```

If any show `undefined`:
- Environment variables not set correctly
- Rebuild the site after setting variables

### **3. Test Authentication:**
1. Click **Sign Up**
2. Create a test account
3. Check email for verification link
4. Click link → Should auto-login

### **4. Test Booking System:**
1. Go to **Book Now** section
2. Submit a test booking
3. Check email for booking confirmation
4. Login as admin, confirm booking
5. Check customer email for confirmation

---

## **Step 5: Set Up Supabase Redirects**

Your Supabase auth needs to know about your production domain.

### **Update Auth Settings:**

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu

2. **Navigate to Authentication:**
   - Left sidebar → **Authentication** → **URL Configuration**

3. **Add Site URL:**
   ```
   Site URL: https://tutokpitikstudios.netlify.app
   ```

4. **Add Redirect URLs:**
   Add these to **Redirect URLs**:
   ```
   https://tutokpitikstudios.netlify.app
   https://tutokpitikstudios.netlify.app/**
   https://tutokpitikstudios.netlify.app/reset-password
   http://localhost:5173
   http://localhost:5173/**
   ```

5. **Save Changes**

---

## **Step 6: Configure Email Templates (Optional)**

### **Update Email Links:**
Make sure all email templates use the correct production URL.

1. Go to: **Supabase Dashboard → Email Templates**
2. Update any hardcoded URLs to:
   ```
   https://tutokpitikstudios.netlify.app
   ```

---

## **Troubleshooting**

### **❌ Build Fails**

**Check build logs:**
1. Netlify Dashboard → Deploys → Click on failed deploy
2. Scroll to error message
3. Common issues:
   - Missing dependencies
   - TypeScript errors
   - Build command incorrect

**Fix:**
```bash
# Test build locally first
npm run build

# Fix any errors
# Then push to Git
git add .
git commit -m "Fix build errors"
git push
```

---

### **❌ Environment Variables Not Working**

**Symptoms:**
- Console shows `undefined` for env vars
- Supabase connection errors
- "Invalid API key" errors

**Fix:**
1. Verify variables are set in Netlify
2. Check variable names are EXACT (case-sensitive)
3. **Must start with `VITE_`** for Vite to pick them up
4. **Redeploy** after adding variables
5. Clear browser cache

---

### **❌ Emails Not Sending**

**Cause:** `RESEND_API_KEY` not in Supabase

**Fix:**
1. Go to: Supabase Dashboard → Edge Functions → Secrets
2. Add `RESEND_API_KEY`
3. Value: `re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1`
4. Redeploy Edge Function

**See:** [SUPABASE_SECRETS_SETUP.md](./SUPABASE_SECRETS_SETUP.md)

---

### **❌ Auth Redirects Not Working**

**Cause:** Supabase doesn't recognize your domain

**Fix:**
1. Supabase Dashboard → Authentication → URL Configuration
2. Add production URL to **Redirect URLs**
3. Save changes
4. Test sign up flow again

---

### **❌ 404 Errors on Routes**

**Cause:** Netlify doesn't know about React Router

**Fix:**
Create `public/_redirects` file:
```
/*    /index.html   200
```

Or add to `netlify.toml`:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## **Performance Optimization**

### **Add netlify.toml:**

Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

---

## **Custom Domain (Optional)**

### **Add Your Own Domain:**

1. **Buy Domain** (e.g., tutokpitik.com)

2. **Add to Netlify:**
   - Netlify Dashboard → **Domain settings**
   - Click **"Add custom domain"**
   - Enter: `tutokpitik.com`
   - Follow DNS instructions

3. **Update Environment Variables:**
   ```
   VITE_NETLIFY_SITE_URL = https://tutokpitik.com
   ```

4. **Update Supabase:**
   - Add `https://tutokpitik.com` to redirect URLs
   - Update Site URL

5. **Redeploy**

---

## **Monitoring**

### **Check Site Status:**
- Netlify Dashboard → **Analytics**
- See visitor stats, build history, errors

### **Error Tracking:**
- Netlify Dashboard → **Functions** (if using)
- Check logs for Edge Function errors

### **Supabase Logs:**
- Supabase Dashboard → **Logs**
- Monitor database queries, auth events

---

## **Deployment Checklist**

### **Before Deploy:**
- ✅ All 3 Netlify environment variables set
- ✅ Supabase secrets configured
- ✅ Local build succeeds (`npm run build`)
- ✅ All tests passing
- ✅ `.gitignore` includes `.env`

### **After Deploy:**
- ✅ Site loads at production URL
- ✅ Environment variables working
- ✅ Sign up flow works
- ✅ Email verification works
- ✅ Booking system works
- ✅ Admin dashboard accessible
- ✅ Portfolio images loading

---

## **Quick Reference**

### **Netlify Environment Variables:**
```env
VITE_SUPABASE_URL=https://wztiuvgmxivogvhqaxvu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_NETLIFY_SITE_URL=https://tutokpitikstudios.netlify.app
```

### **Supabase Edge Function Secrets:**
```env
RESEND_API_KEY=re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1
SITE_URL=https://tutokpitikstudios.netlify.app
```

### **Important URLs:**
- **Live Site**: https://tutokpitikstudios.netlify.app
- **Netlify Dashboard**: https://app.netlify.com/sites/tutokpitikstudios
- **Supabase Dashboard**: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu
- **Resend Dashboard**: https://resend.com/emails

---

**Your site is ready for production deployment! Follow these steps and you'll be live in minutes.** 🚀
