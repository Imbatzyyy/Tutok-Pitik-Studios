# ✅ Final Deployment Checklist - Tutok Pitik Studios

## **Your Production Credentials**

```
Production URL: https://tutokpitikstudios.netlify.app
Supabase Project: wztiuvgmxivogvhqaxvu
Supabase URL: https://wztiuvgmxivogvhqaxvu.supabase.co
```

---

## **Phase 1: Supabase Configuration** ⚙️

### **1.1 Set Supabase Edge Function Secrets** 🔐

**CRITICAL - Without this, emails will NOT work!**

#### **Method A: Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/functions
2. Click **"Manage secrets"**
3. Add these secrets:

```
Name: RESEND_API_KEY
Value: re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1

Name: SITE_URL
Value: https://tutokpitikstudios.netlify.app
```

4. Click **Save**

#### **Method B: Supabase CLI**
```bash
supabase login
supabase link --project-ref wztiuvgmxivogvhqaxvu
supabase secrets set RESEND_API_KEY=re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1
supabase secrets set SITE_URL=https://tutokpitikstudios.netlify.app
```

**Verification:**
- [ ] `RESEND_API_KEY` is set
- [ ] `SITE_URL` is set
- [ ] Secrets appear in Supabase dashboard

---

### **1.2 Configure Authentication URLs** 🔗

1. Go to: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/auth/url-configuration

2. **Set Site URL:**
   ```
   https://tutokpitikstudios.netlify.app
   ```

3. **Add Redirect URLs:**
   ```
   https://tutokpitikstudios.netlify.app
   https://tutokpitikstudios.netlify.app/**
   https://tutokpitikstudios.netlify.app/reset-password
   http://localhost:5173
   http://localhost:5173/**
   ```

4. Click **Save**

**Verification:**
- [ ] Site URL is set
- [ ] All redirect URLs added
- [ ] Both production and localhost URLs included

---

### **1.3 Verify Database Schema** 🗄️

1. Go to: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/editor

2. Check these tables exist:
   - [ ] `auth.users` (automatically created by Supabase)
   - [ ] KV Store enabled for Edge Functions

3. If using SQL tables (optional):
   - [ ] `users` table
   - [ ] `bookings` table
   - [ ] `portfolio_images` table
   - [ ] `favorites` table

---

## **Phase 2: Netlify Configuration** 🚀

### **2.1 Set Environment Variables**

1. Go to: https://app.netlify.com/sites/tutokpitikstudios/settings/deploys#environment

2. Add these 3 variables:

```
Key: VITE_SUPABASE_URL
Value: https://wztiuvgmxivogvhqaxvu.supabase.co
Scopes: All

Key: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dGl1dmdteGl2b2d2aHFheHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjEzMzksImV4cCI6MjA5MTI5NzMzOX0.pb2UCCD1akv5e7uxfEzlxzj29kCOuB-N7HLE0glYMQk
Scopes: All

Key: VITE_NETLIFY_SITE_URL
Value: https://tutokpitikstudios.netlify.app
Scopes: All
```

**Verification:**
- [ ] All 3 variables are set
- [ ] No typos in variable names
- [ ] All scopes selected

---

### **2.2 Configure Build Settings**

1. Go to: https://app.netlify.com/sites/tutokpitikstudios/settings/deploys

2. Verify:
   ```
   Build command: npm run build
   Publish directory: dist
   Node version: 18.x
   ```

**Verification:**
- [ ] Build command is correct
- [ ] Publish directory is `dist`
- [ ] Node version is 18 or higher

---

### **2.3 Deploy Site**

#### **Option A: Git Deploy (Recommended)**
```bash
git add .
git commit -m "Production deployment with environment variables"
git push origin main
```

#### **Option B: Manual Deploy**
```bash
npm run build
netlify deploy --prod
```

**Verification:**
- [ ] Deploy started
- [ ] Build completed successfully
- [ ] Site is published
- [ ] No build errors

---

## **Phase 3: Testing** 🧪

### **3.1 Basic Site Tests**

1. **Visit site:** https://tutokpitikstudios.netlify.app
   - [ ] Site loads without errors
   - [ ] No console errors (F12)
   - [ ] All images load
   - [ ] Navigation works

2. **Test environment variables:**
   ```javascript
   // Open console (F12) and run:
   console.log(import.meta.env.VITE_SUPABASE_URL)
   console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
   console.log(import.meta.env.VITE_NETLIFY_SITE_URL)
   ```
   - [ ] All 3 variables show correct values
   - [ ] None are `undefined`

---

### **3.2 Authentication Tests**

#### **Test Sign Up with Email Verification:**

1. Click **Sign Up**
2. Fill in form:
   ```
   Name: Test User
   Email: your-test-email@gmail.com
   Password: Test123!
   ```
3. Submit form

**Expected:**
- [ ] "Please verify your email" message appears
- [ ] Email received within 1 minute
- [ ] Email has verification link
- [ ] Email design matches brand (#E63946 color)

4. Click verification link in email

**Expected:**
- [ ] Redirects to website
- [ ] **Automatically logged in** (no need to sign in again)
- [ ] User profile accessible
- [ ] Welcome message shows

---

#### **Test Sign In:**

1. Sign out
2. Click **Sign In**
3. Enter credentials
4. Submit

**Expected:**
- [ ] Login successful
- [ ] Redirects to homepage
- [ ] User profile accessible
- [ ] Name shows in header

---

#### **Test Password Reset:**

1. Click **Sign In** → **Forgot Password**
2. Enter email
3. Submit

**Expected:**
- [ ] Success message shows
- [ ] Email received within 1 minute
- [ ] Email has reset link
- [ ] Link redirects to reset password page
- [ ] Can set new password
- [ ] Can login with new password

---

### **3.3 Booking System Tests**

#### **Test Booking Submission:**

1. Click **Book Now**
2. Fill booking form:
   ```
   Service: Wedding Photography
   Date: Tomorrow
   Time: 2:00 PM
   Duration: 4 hours
   Location: Manila
   ```
3. Submit

**Expected:**
- [ ] Success message shows
- [ ] **Email received** with booking details
- [ ] Email shows "Pending" status
- [ ] Email has all booking information
- [ ] Confirmation number included

---

#### **Test Admin Booking Confirmation:**

1. Login as admin:
   ```
   Email: admin@tutokpitik.com
   Password: (your admin password)
   ```

2. Open **Admin Dashboard**
3. Go to **Bookings** tab
4. Find pending booking
5. Click **Confirm** button

**Expected:**
- [ ] Booking status changes to "Confirmed"
- [ ] **Customer receives confirmation email**
- [ ] Confirmation email has all details
- [ ] Email says "Your booking is confirmed!"

---

#### **Test Customer Booking View:**

1. Login as customer (the test account)
2. Click profile icon
3. Go to **Bookings** tab

**Expected:**
- [ ] Booking appears in list
- [ ] Shows confirmed status
- [ ] All details visible (date, time, price)
- [ ] Can see booking history

---

### **3.4 Portfolio Tests**

#### **Test Portfolio Viewing:**

1. Go to **Portfolio** section
2. Click on different categories

**Expected:**
- [ ] Images load from database
- [ ] Filtering works
- [ ] Lightbox opens when clicking image
- [ ] All categories have images

---

#### **Test Favorites (Customer):**

1. Login as customer
2. Go to Portfolio
3. Click heart icon on image

**Expected:**
- [ ] Heart fills in (favorited)
- [ ] Saved to database
- [ ] Appears in profile → Favorites tab
- [ ] Can remove from favorites

---

#### **Test Admin Portfolio Management:**

1. Login as admin
2. Open **Admin Dashboard**
3. Go to **Portfolio** tab
4. Click **Add Image**
5. Upload test image
6. Fill details:
   ```
   Title: Test Wedding
   Category: Wedding
   Subcategory: Outdoor
   ```
7. Click **Save**

**Expected:**
- [ ] Image appears in portfolio grid
- [ ] Saved to database
- [ ] Visible on frontend immediately
- [ ] Can edit image details
- [ ] Can delete image

---

### **3.5 Email Notification Tests**

#### **Test All 5 Email Types:**

1. **Welcome Email:**
   - [ ] ✅ Received on sign up
   - [ ] Has verification link
   - [ ] Auto-login after verification

2. **Booking Submission Email:**
   - [ ] ✅ Received after booking
   - [ ] Shows "Pending" status
   - [ ] Has all booking details

3. **Booking Confirmation Email:**
   - [ ] ✅ Received when admin confirms
   - [ ] Shows "Confirmed" status
   - [ ] Has session details

4. **Password Reset Email:**
   - [ ] ✅ Received on reset request
   - [ ] Reset link works
   - [ ] Expires after 1 hour

5. **Profile Update Email:**
   - [ ] ✅ Received on profile edit
   - [ ] Shows updated fields
   - [ ] Security notification

---

## **Phase 4: Resend Configuration** 📧

### **4.1 Verify Resend Setup**

1. Go to: https://resend.com/emails

2. Check:
   - [ ] API key is active
   - [ ] Sender domain is verified (or using Resend domain)
   - [ ] Recent emails appear in logs

---

### **4.2 Verify Sender Email**

**Option A: Use Resend Default Domain**
```
From: onboarding@resend.dev
```
- [ ] No setup needed, works immediately

**Option B: Custom Domain**
1. Add your domain in Resend
2. Add DNS records
3. Verify domain
4. Update sender email

---

## **Phase 5: Performance & Security** 🔒

### **5.1 Security Checklist**

- [ ] `.env` file in `.gitignore`
- [ ] No API keys in frontend code
- [ ] Supabase RLS policies enabled (if using SQL tables)
- [ ] HTTPS enabled (automatic on Netlify)
- [ ] CORS configured in Supabase

---

### **5.2 Performance Checklist**

- [ ] Images optimized
- [ ] Lazy loading enabled
- [ ] Bundle size under 500KB (check in build output)
- [ ] No console errors
- [ ] Fast page load (< 3 seconds)

---

## **Phase 6: Go Live** 🎉

### **6.1 Final Pre-Launch Checks**

- [ ] All environment variables set
- [ ] All emails working
- [ ] All features tested
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Cross-browser tested (Chrome, Firefox, Safari)

---

### **6.2 Launch Announcement**

- [ ] Announce to users
- [ ] Share on social media
- [ ] Update all links
- [ ] Monitor for issues

---

### **6.3 Post-Launch Monitoring**

#### **Day 1:**
- [ ] Check Netlify Analytics
- [ ] Monitor Supabase logs
- [ ] Check Resend email logs
- [ ] Verify no errors

#### **Week 1:**
- [ ] Review user feedback
- [ ] Check email deliverability
- [ ] Monitor performance
- [ ] Fix any bugs

---

## **Troubleshooting Quick Reference** 🔧

### **Emails Not Sending:**
1. Check `RESEND_API_KEY` in Supabase secrets
2. Check Resend dashboard logs
3. Verify sender email
4. Check Supabase Edge Function logs

### **Environment Variables Not Working:**
1. Verify exact variable names (case-sensitive)
2. Must start with `VITE_`
3. Redeploy after adding variables
4. Clear browser cache

### **Auth Not Working:**
1. Check Supabase redirect URLs
2. Verify environment variables
3. Check Supabase auth logs
4. Verify email verification is enabled

### **Database Errors:**
1. Check Supabase project is active
2. Verify API keys are correct
3. Check Supabase logs
4. Verify KV Store is enabled

---

## **Support Resources** 📚

### **Documentation:**
- [SUPABASE_SECRETS_SETUP.md](./SUPABASE_SECRETS_SETUP.md) - Supabase secrets guide
- [NETLIFY_DEPLOYMENT_GUIDE.md](./NETLIFY_DEPLOYMENT_GUIDE.md) - Netlify deployment
- [ENVIRONMENT_VARIABLES_SETUP.md](./ENVIRONMENT_VARIABLES_SETUP.md) - Environment variables
- [COMPLETE_MIGRATION_SUMMARY.md](./COMPLETE_MIGRATION_SUMMARY.md) - Full migration details

### **External Links:**
- **Supabase Dashboard**: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu
- **Netlify Dashboard**: https://app.netlify.com/sites/tutokpitikstudios
- **Resend Dashboard**: https://resend.com/emails
- **Live Site**: https://tutokpitikstudios.netlify.app

---

## **Success Criteria** ✅

Your deployment is successful when:

- ✅ Site loads at https://tutokpitikstudios.netlify.app
- ✅ No console errors
- ✅ Sign up works with email verification
- ✅ Email verification auto-logs in user
- ✅ Bookings can be submitted
- ✅ Booking submission email received
- ✅ Admin can confirm bookings
- ✅ Booking confirmation email sent to customer
- ✅ Customer sees confirmed booking in profile
- ✅ Portfolio images load from database
- ✅ Admin can upload/edit/delete images
- ✅ All 5 email types working
- ✅ Mobile responsive
- ✅ Fast page loads

---

**Congratulations! Your Tutok Pitik Studios website is now live in production!** 🎉📸

**Need help? Check the documentation links above or contact support.**
