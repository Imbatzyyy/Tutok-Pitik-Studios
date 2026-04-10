# ⚡ Quick Start - 5 Minutes to Production

## **Your Credentials**

```
Supabase URL: https://wztiuvgmxivogvhqaxvu.supabase.co
Resend API Key: re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1
Production URL: https://tutokpitikstudios.netlify.app
```

---

## **Step 1: Set Supabase Secrets (2 minutes)** 🔐

### **Go to Supabase:**
👉 https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/functions

### **Click "Manage secrets"**

### **Add 2 secrets:**
```
Name: RESEND_API_KEY
Value: re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1

Name: SITE_URL
Value: https://tutokpitikstudios.netlify.app
```

### **Click Save**

✅ **Done!** Emails will now work.

---

## **Step 2: Configure Supabase Auth URLs (1 minute)** 🔗

### **Go to:**
👉 https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/auth/url-configuration

### **Set Site URL:**
```
https://tutokpitikstudios.netlify.app
```

### **Add Redirect URLs:**
```
https://tutokpitikstudios.netlify.app
https://tutokpitikstudios.netlify.app/**
https://tutokpitikstudios.netlify.app/reset-password
http://localhost:5173
http://localhost:5173/**
```

### **Click Save**

✅ **Done!** Auth redirects configured.

---

## **Step 3: Set Netlify Environment Variables (2 minutes)** 🚀

### **Go to Netlify:**
👉 https://app.netlify.com/sites/tutokpitikstudios/settings/deploys#environment

### **Add 3 variables:**

**Variable 1:**
```
Key: VITE_SUPABASE_URL
Value: https://wztiuvgmxivogvhqaxvu.supabase.co
Scopes: All
```

**Variable 2:**
```
Key: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dGl1dmdteGl2b2d2aHFheHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjEzMzksImV4cCI6MjA5MTI5NzMzOX0.pb2UCCD1akv5e7uxfEzlxzj29kCOuB-N7HLE0glYMQk
Scopes: All
```

**Variable 3:**
```
Key: VITE_NETLIFY_SITE_URL
Value: https://tutokpitikstudios.netlify.app
Scopes: All
```

✅ **Done!** Frontend configured.

---

## **Step 4: Deploy** 🎉

### **Option A: Git Push (Recommended)**
```bash
git add .
git commit -m "Production deployment"
git push origin main
```

Netlify will auto-deploy! ✅

### **Option B: Manual**
```bash
npm run build
netlify deploy --prod
```

---

## **Step 5: Test (1 minute)** 🧪

### **1. Visit site:**
👉 https://tutokpitikstudios.netlify.app

### **2. Test sign up:**
- Click "Sign Up"
- Create test account
- Check email for verification
- Click verification link
- Should auto-login ✅

### **3. Test booking:**
- Submit a booking
- Check email for confirmation
- Login as admin, confirm booking
- Check customer email for confirmation ✅

---

## **✅ Done!**

**Your site is LIVE!** 🎉

All 5 email systems working:
1. ✅ Welcome email with verification
2. ✅ Booking submission email
3. ✅ Booking confirmation email
4. ✅ Password reset email
5. ✅ Profile update email

---

## **Troubleshooting**

### **Emails not sending?**
- Check Supabase secrets are set
- Check Resend dashboard: https://resend.com/emails

### **Environment variables not working?**
- Must start with `VITE_`
- Redeploy after adding
- Clear browser cache

### **Need detailed help?**
- [FINAL_DEPLOYMENT_CHECKLIST.md](./FINAL_DEPLOYMENT_CHECKLIST.md) - Complete guide
- [SUPABASE_SECRETS_SETUP.md](./SUPABASE_SECRETS_SETUP.md) - Supabase setup
- [NETLIFY_DEPLOYMENT_GUIDE.md](./NETLIFY_DEPLOYMENT_GUIDE.md) - Netlify setup

---

**Total time: 5 minutes** ⚡  
**Result: Production-ready website** 🚀

**Go live now!** 🎉
