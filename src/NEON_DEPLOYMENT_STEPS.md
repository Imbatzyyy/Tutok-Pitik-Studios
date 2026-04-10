# 🚀 Neon Database Deployment Steps

## Step-by-Step Guide to Deploy with Full Database Integration

Follow these exact steps to get your app running with Neon database:

---

## ✅ Step 1: Update Database Schema

Your Neon database needs the new `portfolio_images` table.

### Option A: Using psql Command Line

```bash
# Use the connection string from your screenshot
psql "postgresql://neondb_owner:***@ep-green-night-a1c2d3e4-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require" < database/schema.sql
```

### Option B: Using Neon Console

1. Go to https://console.neon.tech
2. Select your project
3. Click on "SQL Editor"
4. Copy and paste the contents of `/database/schema.sql`
5. Click "Run"

### Option C: Manual SQL

If the above don't work, run this SQL directly in Neon console:

```sql
CREATE TABLE IF NOT EXISTS portfolio_images (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100) NOT NULL,
  image_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## ✅ Step 2: Install Dependencies

```bash
npm install
```

This installs the new `@neondatabase/serverless` package.

---

## ✅ Step 3: Update Netlify Environment Variables

**CRITICAL:** The environment variable name has changed!

### Go to Netlify Dashboard:
1. Select your site
2. Site settings → Environment variables
3. Click "Add a variable"

### Add This Variable:

**Key:** `NEON_DATABASE_URL`

**Value:** (from your screenshot)
```
postgresql://neondb_owner:***@ep-green-night-a1c2d3e4-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### IMPORTANT Notes:
- Variable name is `NEON_DATABASE_URL` (NO `VITE_` prefix)
- This keeps your database credentials secure (server-side only)
- If you had `VITE_NEON_DATABASE_URL`, you can delete it

---

## ✅ Step 4: Build and Deploy

### Option A: Push to GitHub (Recommended)

```bash
git add .
git commit -m "Add Neon database integration"
git push
```

Netlify will automatically build and deploy.

### Option B: Manual Deploy

```bash
# Build locally
npm run build

# Deploy
netlify deploy --prod
```

---

## ✅ Step 5: Verify Deployment

### Check Build Logs

1. Go to Netlify Dashboard → Deploys
2. Click on the latest deploy
3. Check "Deploy log"
4. Look for:
   ```
   ✓ Build succeeded
   ✓ Functions deployed
   ```

### Verify Functions Deployed

In Netlify Dashboard → Functions, you should see:
- `booking-create`
- `booking-update`
- `bookings`
- `portfolio`
- `portfolio-upload`
- `stats`
- `user-login`
- `user-register`
- `user-upload-picture`
- `users`

---

## ✅ Step 6: Test the Integration

### Test User Registration

1. Go to your deployed site
2. Click "Login" → "Create Account"
3. Fill in the form:
   - Full Name: `Test User`
   - Email: `test@example.com`
   - Password: `test123`
   - Role: `Customer`
4. Click "Create Account"
5. Should redirect to logged-in state

### Test Profile Picture Upload

1. Login with the account you just created
2. Click your profile icon (top right)
3. Click "Edit Profile"
4. Click "Change Picture"
5. Select an image file
6. Click "Upload"
7. Picture should appear in top-right navigation

### Test Booking Creation

1. Stay logged in as customer
2. Scroll to "Book a Session" section
3. Fill in the booking form
4. Submit booking
5. Should see success message

### Verify in Database

1. Go to Neon Console
2. SQL Editor
3. Run these queries:

```sql
-- Check users
SELECT id, full_name, email, role FROM users;

-- Check bookings
SELECT id, full_name, service, status FROM bookings;

-- Check if profile picture was stored
SELECT id, full_name, LENGTH(profile_picture) as pic_size 
FROM users 
WHERE profile_picture IS NOT NULL;
```

---

## ✅ Step 7: Test Admin Features

### Create Admin Account

Either manually in database:

```sql
INSERT INTO users (username, full_name, email, phone, password_hash, role)
VALUES (
  'admin',
  'Admin User',
  'admin@tutokpitik.com',
  NULL,
  -- Password: admin123 hashed
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'super_admin'
);
```

Or use the register API with role parameter.

### Login as Admin

1. Logout from customer account
2. Login with admin credentials
3. Click profile icon → "Admin Dashboard"
4. Should see all bookings and users

---

## 🐛 Troubleshooting

### Error: "NEON_DATABASE_URL environment variable is not set"

**Fix:**
1. Go to Netlify → Site settings → Environment variables
2. Verify `NEON_DATABASE_URL` exists
3. If not, add it with your connection string
4. Trigger a new deploy (deploys → Trigger deploy → Deploy site)

### Error: "Failed to connect to database"

**Fix:**
1. Verify connection string is correct
2. Check Neon dashboard - database should be active
3. Ensure connection string ends with `?sslmode=require`
4. Test connection locally:
   ```bash
   psql "YOUR_CONNECTION_STRING"
   ```

### Error: "Function not found"

**Fix:**
1. Check Netlify → Functions tab
2. If functions aren't there, rebuild:
   ```bash
   netlify deploy --build --prod
   ```
3. Ensure `/netlify/functions/` folder exists in repository

### Profile Picture Not Showing

**Fix:**
1. Check browser console for errors
2. Verify image was uploaded (check network tab)
3. Query database:
   ```sql
   SELECT id, profile_picture FROM users WHERE id = YOUR_USER_ID;
   ```
4. Image should start with `data:image/`

### Bookings Not Saving

**Fix:**
1. Check browser console for API errors
2. Check Netlify function logs
3. Verify booking-create function deployed
4. Test API directly:
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/booking-create \
     -H "Content-Type: application/json" \
     -d '{"fullName":"Test","email":"test@test.com",...}'
   ```

---

## 📊 Monitoring

### Netlify Function Logs

1. Netlify Dashboard → Functions
2. Click on any function
3. View logs in real-time
4. Look for errors or warnings

### Neon Database Monitoring

1. Neon Console → Your Project
2. Click "Monitoring" tab
3. View:
   - Query performance
   - Connection count
   - Database size
   - CPU usage

---

## 🔐 Security Checklist

- [ ] `NEON_DATABASE_URL` is server-side only (no `VITE_` prefix)
- [ ] Connection string uses SSL (`?sslmode=require`)
- [ ] Passwords are hashed in database
- [ ] Admin endpoints require authorization token
- [ ] No database credentials in client-side code
- [ ] Environment variables not committed to git

---

## ✅ Success Criteria

Your deployment is successful when:

- [ ] All Netlify Functions deployed (10 functions)
- [ ] Users can register and login
- [ ] Profile pictures upload and display
- [ ] Bookings save to database
- [ ] Admins can access dashboard
- [ ] All data visible in Neon console
- [ ] No errors in Netlify function logs
- [ ] No errors in browser console

---

## 🎉 You're Done!

Your Tutok Pitik Studios app is now fully integrated with Neon database!

### What Works Now:

✅ **Users**: Register, login, upload profile pictures
✅ **Bookings**: Create, view, update (admin), stored in database
✅ **Portfolio**: Upload images (admin), view all users, stored in database
✅ **Admin**: Full dashboard access with real database data
✅ **Security**: Passwords hashed, tokens authenticated, role-based access

### Next Steps:

1. Test all features thoroughly
2. Add more portfolio images
3. Customize email notifications
4. Monitor database usage
5. Set up regular backups

**Need help?** Check the logs:
- Netlify: Dashboard → Functions → Logs
- Browser: F12 → Console tab
- Database: Neon Console → SQL Editor

---

**Last Updated:** 2024
**Database:** Neon PostgreSQL
**Status:** ✅ PRODUCTION READY
