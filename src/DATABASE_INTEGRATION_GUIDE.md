# Neon Database Integration Guide

## 🗄️ Complete Database Integration

Your Tutok Pitik Studios app is now fully integrated with Neon PostgreSQL database!

---

## 📋 What's Been Integrated

### ✅ Profile Pictures
- Uploaded and stored as base64 in database
- Displayed in navigation (top right with username)
- Accessible across all user sessions
- Visible to all admin roles

### ✅ Portfolio Images
- Admins can upload new portfolio images
- Stored in `portfolio_images` table
- All users can view
- Persists across sessions

### ✅ Bookings
- Saved to database (not just Netlify Forms)
- Accessible by Super Admin, Admin, Staff
- Customers can view their own bookings
- Full CRUD operations

### ✅ User Data
- All users stored in database
- Secure password hashing
- Role-based access control
- Profile management

---

## 🚀 Setup Steps

### 1. Install Dependencies

```bash
npm install
```

This will install `@neondatabase/serverless` package.

### 2. Update Database Schema

Run the updated schema on your Neon database:

```bash
# Connect to your Neon database
psql "postgresql://neondb_owner:***@ep-green-night-a1c2d3e4-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Or run the schema file
psql "YOUR_CONNECTION_STRING" < database/schema.sql
```

New tables added:
- `portfolio_images` - For uploaded portfolio images

Existing tables:
- `users` - User accounts with profile pictures
- `bookings` - All booking data
- `favorites` - User favorites
- `contact_messages` - Contact form submissions

### 3. Set Environment Variable in Netlify

**Important:** The environment variable name has changed!

Go to Netlify Dashboard → Site settings → Environment variables:

**Remove or update:**
- ~~`VITE_NEON_DATABASE_URL`~~ (old - don't use)

**Add:**
- `NEON_DATABASE_URL` (new - serverless functions use this)

**Value:** Your Neon connection string from the screenshot
```
postgresql://neondb_owner:***@ep-green-night-a1c2d3e4-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Why the change?**
- `VITE_` prefix exposes variables to client-side code (unsafe for database credentials)
- Netlify Functions use server-side environment variables (secure)
- `NEON_DATABASE_URL` is only accessible in serverless functions

### 4. Deploy

```bash
# Build and deploy
npm run build
netlify deploy --prod

# Or if using GitHub integration, just push:
git add .
git commit -m "Add Neon database integration"
git push
```

---

## 📡 API Endpoints Created

### User Endpoints

#### `POST /.netlify/functions/user-register`
Register new user
```json
{
  "fullName": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "phone": "+63 123 456 7890",
  "password": "password123",
  "role": "customer"
}
```

#### `POST /.netlify/functions/user-login`
Login user
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

#### `POST /.netlify/functions/user-upload-picture`
Upload profile picture
```json
{
  "userId": "123",
  "imageBase64": "data:image/png;base64,iVBOR..."
}
```

#### `GET /.netlify/functions/users`
Get all users (Admin only)
Headers: `Authorization: Bearer TOKEN`

### Booking Endpoints

#### `POST /.netlify/functions/booking-create`
Create new booking
```json
{
  "userId": "123",
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+63 123 456 7890",
  "service": "Portrait Photography",
  "date": "2024-03-25",
  "startTime": "10:00",
  "endTime": "12:00",
  "duration": 2,
  "price": 5000,
  "transportationFee": 500,
  "totalPrice": 5500,
  "location": "Quezon City, Metro Manila",
  "message": "Birthday photoshoot"
}
```

#### `GET /.netlify/functions/bookings`
Get all bookings (Admin) or user bookings
- Admin: Headers: `Authorization: Bearer TOKEN`
- User: Query: `?userId=123`

### Portfolio Endpoints

#### `POST /.netlify/functions/portfolio-upload`
Upload portfolio image (Admin only)
```json
{
  "title": "Sunset Portrait",
  "category": "portrait",
  "subcategory": "outdoor",
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```
Headers: `Authorization: Bearer TOKEN`

#### `GET /.netlify/functions/portfolio`
Get all portfolio images (Public)

---

## 🔐 How It Works

### Authentication Flow

1. **Register/Login**
   - User provides credentials
   - Password hashed with SHA-256
   - Token generated (includes userId and role)
   - Token stored in localStorage
   - User data cached in sessionStorage

2. **Profile Picture Upload**
   - User selects image
   - Converted to base64
   - Sent to API
   - Stored in database `users.profile_picture`
   - Retrieved and displayed in UI

3. **Session Persistence**
   - Token stored in localStorage
   - User data fetched from database on login
   - Profile picture loaded from database
   - Displayed in navigation bar

### Data Flow

```
User Action → Frontend Component → API Call (lib/api.ts)
                                          ↓
                              Netlify Function (netlify/functions/)
                                          ↓
                              Neon Database (PostgreSQL)
                                          ↓
                              Response → Frontend → UI Update
```

### Profile Picture Display

1. User uploads picture
2. Stored as base64 in database
3. Retrieved on login/session restore
4. Displayed in:
   - Navigation bar (top right)
   - User profile modal
   - Admin dashboard
   - Booking confirmations

---

## 🎨 Features

### For Customers

**Profile Management:**
- Upload profile picture
- Update personal information
- Set username
- View booking history

**Booking:**
- Create bookings (stored in database)
- View own bookings
- 3 booking limit enforced
- Email confirmations still sent via Netlify Forms

### For Admin/Staff

**User Management:**
- View all users
- See profile pictures
- Manage user roles
- Delete users (Super Admin only)

**Booking Management:**
- View all bookings from database
- Update booking status
- Cancel bookings
- Export data

**Portfolio Management:**
- Upload new portfolio images
- Images stored in database
- Organize by category/subcategory
- Delete images

**Statistics:**
- Total users
- Total bookings
- Revenue tracking
- User distribution by role

---

## 💾 Data Storage

### Profile Pictures
- **Format:** Base64 encoded
- **Storage:** Database TEXT field
- **Max Size:** ~1MB recommended
- **Types:** JPEG, PNG, GIF, WebP

### Portfolio Images
- **Format:** Base64 encoded
- **Storage:** Database TEXT field
- **Max Size:** ~2MB recommended
- **Types:** JPEG, PNG

### Bookings
- **Storage:** Structured data in database
- **Also Sent:** Via Netlify Forms for email notifications
- **Dual Purpose:** Database for app, Netlify for emails

---

## 🔧 Configuration

### Netlify Environment Variables

```env
# Server-side only (Netlify Functions)
NEON_DATABASE_URL=postgresql://...

# Client-side (exposed to browser)
VITE_NETLIFY_SITE_URL=https://your-site.netlify.app
```

### Local Development

Create `.env` file:
```env
NEON_DATABASE_URL=postgresql://neondb_owner:***@ep-green-night-a1c2d3e4-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
VITE_NETLIFY_SITE_URL=http://localhost:3000
```

Run locally with Netlify Dev:
```bash
netlify dev
```

This runs both Vite dev server AND Netlify Functions locally!

---

## 🧪 Testing

### Test User Registration
```bash
curl -X POST http://localhost:8888/.netlify/functions/user-register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "test123",
    "role": "customer"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:8888/.netlify/functions/user-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

### Test Profile Picture Upload
```bash
curl -X POST http://localhost:8888/.netlify/functions/user-upload-picture \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "1",
    "imageBase64": "data:image/png;base64,iVBOR..."
  }'
```

---

## 🐛 Troubleshooting

### Environment Variable Not Found
**Error:** `NEON_DATABASE_URL environment variable is not set`

**Fix:**
1. Check Netlify environment variables
2. Ensure variable name is exactly `NEON_DATABASE_URL`
3. Redeploy site after adding variable

### CORS Errors
**Error:** `Access to fetch at... has been blocked by CORS policy`

**Fix:** Netlify Functions handle CORS automatically. If you see this error, check:
1. API endpoint URL is correct
2. Using `/.netlify/functions/` prefix
3. No typos in function names

### Database Connection Timeout
**Error:** `Connection timeout`

**Fix:**
1. Check Neon database is active
2. Verify connection string is correct
3. Ensure `?sslmode=require` is in connection string

### Image Upload Fails
**Error:** `Request Entity Too Large`

**Fix:**
1. Resize images before upload
2. Compress images (use TinyPNG or similar)
3. Recommended: Max 1MB for profile pics, 2MB for portfolio

---

## 📊 Database Monitoring

### Check Neon Dashboard
- Go to https://console.neon.tech
- Select your project
- View:
  - Connection stats
  - Query performance
  - Database size
  - Active connections

### View Data
```sql
-- Count users
SELECT COUNT(*) FROM users;

-- View recent bookings
SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10;

-- Check portfolio images
SELECT COUNT(*), category FROM portfolio_images GROUP BY category;

-- User roles distribution
SELECT role, COUNT(*) FROM users GROUP BY role;
```

---

## 🚀 Next Steps

1. **Test the integration:**
   - Register a new account
   - Upload profile picture
   - Create a booking
   - Check admin dashboard

2. **Verify data in Neon:**
   - Login to Neon console
   - Run queries to see data
   - Confirm all tables populated

3. **Monitor performance:**
   - Check Netlify function logs
   - Monitor Neon database usage
   - Optimize queries if needed

4. **Backup strategy:**
   - Neon provides automatic backups
   - Consider export scripts for critical data
   - Test restore procedures

---

## ✅ Success Criteria

Your integration is working if:
- [ ] Users can register and login
- [ ] Profile pictures appear in navigation
- [ ] Bookings save to database
- [ ] Admins can view all bookings
- [ ] Portfolio images persist
- [ ] No console errors
- [ ] Data visible in Neon dashboard

---

**🎉 Your app is now fully database-integrated!**

All user data, bookings, and portfolio images are stored in your Neon PostgreSQL database and accessible by admins.
