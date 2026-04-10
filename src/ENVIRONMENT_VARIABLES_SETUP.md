# 🔐 Environment Variables Setup Guide

## **Required Environment Variables**

Your Tutok Pitik Studios website requires **4 environment variables** to function properly:

### **1. VITE_SUPABASE_URL**
- **What it is**: Your Supabase project URL
- **Where to find it**: Supabase Dashboard → Project Settings → API → Project URL
- **Example**: `https://ljncerpxmxwcejjoqojg.supabase.co`

### **2. VITE_SUPABASE_ANON_KEY**
- **What it is**: Your Supabase anonymous public key
- **Where to find it**: Supabase Dashboard → Project Settings → API → Project API keys → anon public
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### **3. RESEND_API_KEY**
- **What it is**: Your Resend email service API key
- **Where to find it**: [Resend Dashboard](https://resend.com/api-keys) → API Keys
- **Example**: `re_123456789abcdefgh`
- **⚠️ CRITICAL**: This must be set in **Supabase Edge Functions Secrets**, NOT in `.env` file!

### **4. VITE_NETLIFY_SITE_URL**
- **What it is**: Your website's public URL
- **Development**: `http://localhost:5173`
- **Production**: `https://your-site.netlify.app`

---

## **Setup Instructions**

### **Step 1: Create `.env` File (Local Development)**

Create a `.env` file in the root of your project:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://ljncerpxmxwcejjoqojg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqbmNlcnB4bXh3Y2Vqam9xb2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzAxMjIsImV4cCI6MjA5MTMwNjEyMn0.ScvywJLOkWkkcqZ9opuByufcqgxl4TQHUkkKmxc2LbA

# Email Service (Resend) - NOT USED IN FRONTEND
# RESEND_API_KEY=re_your_key_here

# Site URL
VITE_NETLIFY_SITE_URL=http://localhost:5173
```

> **⚠️ IMPORTANT**: The `RESEND_API_KEY` should **NOT** be in your `.env` file for security reasons. It must be set in Supabase Edge Functions Secrets (see Step 2).

---

### **Step 2: Set Supabase Edge Function Secrets**

#### **Option A: Via Supabase Dashboard (Easiest)**

1. Go to: **Supabase Dashboard** → **Edge Functions** → **Manage Secrets**
2. Add these secrets:
   ```
   RESEND_API_KEY = re_your_actual_api_key_here
   SITE_URL = http://localhost:5173
   ```
3. Click **Save**

#### **Option B: Via Supabase CLI**

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref ljncerpxmxwcejjoqojg

# Set secrets
supabase secrets set RESEND_API_KEY=re_your_actual_api_key_here
supabase secrets set SITE_URL=http://localhost:5173
```

---

### **Step 3: Deploy to Netlify (Production)**

When deploying to Netlify, you need to set environment variables in the Netlify Dashboard:

1. Go to: **Netlify Dashboard** → **Your Site** → **Site Settings** → **Environment Variables**
2. Add these variables:
   ```
   VITE_SUPABASE_URL = https://ljncerpxmxwcejjoqojg.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_NETLIFY_SITE_URL = https://your-site.netlify.app
   ```
3. **Redeploy** your site for changes to take effect

> **Note**: `RESEND_API_KEY` is NOT needed in Netlify because emails are sent from Supabase Edge Functions, not from Netlify.

---

## **Email Functionality Overview**

Your website has **5 email notification systems**:

### **1. Welcome Email (Sign Up)**
- ✅ **Trigger**: User creates account
- ✅ **Requires email confirmation**: YES
- ✅ **Action**: User must click link in email to verify account before login
- ✅ **Auto-login**: After verification, user is automatically logged in

### **2. Booking Submission Email**
- ✅ **Trigger**: Customer submits booking
- ✅ **Content**: Booking details, confirmation number, pending status
- ✅ **Recipient**: Customer email

### **3. Booking Confirmation Email**
- ✅ **Trigger**: Admin confirms booking in Admin Dashboard
- ✅ **Content**: Booking confirmed, session details, photographer info
- ✅ **Recipient**: Customer email

### **4. Password Reset Email**
- ✅ **Trigger**: User requests password reset
- ✅ **Content**: Reset link with expiration (1 hour)
- ✅ **Recipient**: User email

### **5. Profile Update Email**
- ✅ **Trigger**: User updates profile information
- ✅ **Content**: Summary of changes made
- ✅ **Recipient**: User email

---

## **Portfolio Images in Database**

✅ **Portfolio images are stored in Supabase KV Store**

### **How It Works:**

1. **Admin uploads image** → Saved to Supabase KV (`portfolio_images` key)
2. **Frontend fetches images** → Loads from Supabase KV
3. **Admin edits/deletes** → Updates/removes from Supabase KV

### **Database Structure:**

```typescript
{
  id: string;
  title: string;
  category: string;
  subcategory: string;
  url: string (base64 or URL);
  created_at: timestamp;
  created_by: string (admin email);
}
```

All portfolio operations (Create, Read, Update, Delete) go through:
```
https://ljncerpxmxwcejjoqojg.supabase.co/functions/v1/make-server-032fda65/portfolio
```

---

## **Testing Your Setup**

### **1. Test Supabase Connection**
Open browser console and run:
```javascript
console.log(import.meta.env.VITE_SUPABASE_URL)
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
```
Should output your Supabase URL and key.

### **2. Test Email Service**
1. Create a test account
2. Check your email for welcome/verification email
3. Click verification link
4. Should auto-login to website

### **3. Test Booking System**
1. Submit a test booking
2. Check email for booking confirmation
3. Login as admin, confirm booking
4. Check customer email for confirmation email

---

## **Troubleshooting**

### **❌ "Supabase URL not configured"**
- Check `.env` file exists in project root
- Verify `VITE_SUPABASE_URL` is set
- Restart dev server: `npm run dev`

### **❌ "Email service not configured"**
- Check Supabase Edge Function secrets
- Verify `RESEND_API_KEY` is set in Supabase Dashboard
- Redeploy Edge Functions

### **❌ "Failed to fetch"**
- Check Supabase project is active
- Verify anon key is correct
- Check network connection

### **❌ Emails not sending**
- Verify Resend API key is valid
- Check Resend dashboard for send logs
- Ensure sender email is verified in Resend

---

## **Security Best Practices**

✅ **DO:**
- Store `RESEND_API_KEY` in Supabase Edge Function secrets
- Use environment variables for all configs
- Keep `.env` file in `.gitignore`
- Use different keys for dev/production

❌ **DON'T:**
- Commit `.env` file to Git
- Share API keys publicly
- Use production keys in development
- Store sensitive data in frontend code

---

## **Quick Reference**

| Variable | Frontend (.env) | Supabase Secrets | Netlify |
|----------|----------------|------------------|---------|
| `VITE_SUPABASE_URL` | ✅ YES | ❌ NO | ✅ YES |
| `VITE_SUPABASE_ANON_KEY` | ✅ YES | ❌ NO | ✅ YES |
| `RESEND_API_KEY` | ❌ NO | ✅ YES | ❌ NO |
| `VITE_NETLIFY_SITE_URL` | ✅ YES | ❌ NO | ✅ YES |

---

**Need help? Check the [SUPABASE_QUICK_START.md](./SUPABASE_QUICK_START.md) for complete setup instructions!**
