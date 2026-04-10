# 🔐 Supabase Edge Functions Secrets Setup

## **CRITICAL: Set RESEND_API_KEY in Supabase**

Your `RESEND_API_KEY` **MUST** be set in Supabase Edge Functions Secrets for emails to work!

---

## **Method 1: Supabase Dashboard (Recommended)**

### **Step-by-Step:**

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Login to your account

2. **Select Your Project**
   - Click on: **Tutok Pitik Studios** project
   - Or go directly to: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu

3. **Navigate to Edge Functions**
   - Left sidebar → Click **Edge Functions**
   - Or go to: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/functions

4. **Manage Secrets**
   - Click on **"Manage secrets"** button (top right)
   - Or click the **Settings** icon

5. **Add Secrets**
   - Click **"Add new secret"**
   - Enter the following:

   ```
   Name: RESEND_API_KEY
   Value: re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1
   ```

   - Click **"Save"**

6. **Add Site URL (Optional but Recommended)**
   - Click **"Add new secret"** again
   - Enter:

   ```
   Name: SITE_URL
   Value: https://tutokpitikstudios.netlify.app
   ```

   - Click **"Save"**

7. **Verify Secrets**
   - You should see both secrets listed
   - ✅ `RESEND_API_KEY`
   - ✅ `SITE_URL`

---

## **Method 2: Supabase CLI**

### **Prerequisites:**
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login
```

### **Link Your Project:**
```bash
supabase link --project-ref wztiuvgmxivogvhqaxvu
```

### **Set Secrets:**
```bash
# Set Resend API Key
supabase secrets set RESEND_API_KEY=re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1

# Set Site URL
supabase secrets set SITE_URL=https://tutokpitikstudios.netlify.app
```

### **Verify Secrets:**
```bash
supabase secrets list
```

You should see:
```
RESEND_API_KEY
SITE_URL
SUPABASE_URL (automatically available)
SUPABASE_SERVICE_ROLE_KEY (automatically available)
```

---

## **What These Secrets Do**

### **RESEND_API_KEY**
- **Purpose**: Send email notifications
- **Used for**:
  1. ✅ Welcome email with verification link
  2. ✅ Booking submission confirmation
  3. ✅ Booking confirmation from admin
  4. ✅ Password reset emails
  5. ✅ Profile update notifications

### **SITE_URL**
- **Purpose**: Generate correct links in emails
- **Used for**:
  - Email verification links
  - Password reset links
  - Booking management links
  - Back to website buttons

---

## **Testing Your Setup**

### **1. Check Edge Function is Deployed**

Go to: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/functions

You should see:
- ✅ `make-server-032fda65` function deployed

### **2. Test Email Sending**

#### **Option A: Test Sign Up**
1. Go to your website: https://tutokpitikstudios.netlify.app
2. Click "Sign Up"
3. Create a test account
4. Check your email inbox
5. You should receive a welcome email

#### **Option B: Test via Supabase Logs**
1. Go to: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/logs/edge-functions
2. Submit a booking on your website
3. Check logs for email sending activity
4. Look for success messages

---

## **Troubleshooting**

### **❌ "Email service not configured"**

**Cause**: `RESEND_API_KEY` not set in Supabase Secrets

**Fix**:
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Verify `RESEND_API_KEY` is listed
3. If not, add it using Method 1 above
4. Redeploy Edge Function if needed

---

### **❌ "Failed to send email"**

**Cause**: Invalid Resend API key or sender email not verified

**Fix**:
1. Verify Resend API key is correct
2. Go to: https://resend.com/api-keys
3. Check if key is active
4. Verify sender email in Resend Dashboard

---

### **❌ Emails not arriving**

**Possible causes**:
1. Check spam folder
2. Verify Resend sender email is verified
3. Check Resend dashboard logs: https://resend.com/emails
4. Check Supabase Edge Function logs

**Fix**:
1. Go to Resend Dashboard → Domains
2. Add and verify your domain
3. Or use Resend's default sending domain
4. Test sending a manual email from Resend dashboard

---

## **Security Notes**

### **✅ DO:**
- Store `RESEND_API_KEY` only in Supabase Secrets
- Use environment variables for all sensitive data
- Keep API keys secure and never commit to Git
- Rotate API keys regularly

### **❌ DON'T:**
- Put `RESEND_API_KEY` in `.env` file
- Commit secrets to version control
- Share API keys publicly
- Use production keys in development (create separate keys)

---

## **Quick Reference**

| Secret Name | Value | Required? |
|-------------|-------|-----------|
| `RESEND_API_KEY` | `re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1` | ✅ YES |
| `SITE_URL` | `https://tutokpitikstudios.netlify.app` | ⚠️ Optional |
| `SUPABASE_URL` | Auto-available | ✅ Auto |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-available | ✅ Auto |

---

## **Next Steps**

1. ✅ Set secrets in Supabase (completed above)
2. ✅ Deploy Edge Function (if not already deployed)
3. ✅ Test email sending
4. ✅ Deploy to Netlify
5. ✅ Go live!

---

**Your Supabase secrets are now configured! Emails will work once Edge Functions are deployed.** 🎉
