# 🗄️ Database Setup for Tutok Pitik Studios

## **Overview**

This folder contains the complete SQL schema and seed data for the Tutok Pitik Studios photography booking system.

---

## **📂 Files**

1. **`schema.sql`** - Complete database schema with tables, indexes, triggers, and RLS policies
2. **`seed_data.sql`** - Initial data including admin accounts and dummy client bookings

---

## **🚀 Quick Setup**

### **Method 1: Supabase Dashboard (Recommended)**

1. **Go to Supabase SQL Editor:**
   - https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/sql

2. **Create Tables:**
   - Click "New Query"
   - Copy contents of `schema.sql`
   - Click "Run"
   - ✅ Tables created!

3. **Insert Seed Data:**
   - Click "New Query"
   - Copy contents of `seed_data.sql`
   - Click "Run"
   - ✅ Data inserted!

---

### **Method 2: Supabase CLI**

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref wztiuvgmxivogvhqaxvu

# Run schema
supabase db push

# Or run SQL files directly
psql -h db.wztiuvgmxivogvhqaxvu.supabase.co -U postgres -d postgres -f database/schema.sql
psql -h db.wztiuvgmxivogvhqaxvu.supabase.co -U postgres -d postgres -f database/seed_data.sql
```

---

## **📊 Database Schema**

### **Tables Created:**

1. **`users`** - User accounts with roles
2. **`bookings`** - Photography booking records
3. **`portfolio_images`** - Portfolio image catalog
4. **`favorites`** - User favorites
5. **`user_sessions`** - Session tracking

---

## **👥 Default Accounts**

After running `seed_data.sql`, these accounts will be available:

### **Admin Accounts (3)**

| Email | Password | Role | Username |
|-------|----------|------|----------|
| `superadmin@tutokpitik.com` | `SuperAdmin123!` | Super Admin | superadmin |
| `admin@tutokpitik.com` | `Admin123!` | Admin | studioadmin |
| `staff@tutokpitik.com` | `Staff123!` | Staff | staffmember |

⚠️ **Important:** These passwords are for the **database records only**. You must also create these accounts in Supabase Auth!

---

### **Customer Accounts (5)**

| Name | Email | Bookings |
|------|-------|----------|
| Juan Dela Cruz | juan.delacruz@gmail.com | 2 bookings |
| Maria Santos | maria.santos@yahoo.com | 2 bookings |
| Pedro Reyes | pedro.reyes@outlook.com | 2 bookings |
| Ana Garcia | ana.garcia@gmail.com | 2 bookings |
| Carlos Mendoza | carlos.mendoza@hotmail.com | 2 bookings |

---

## **📅 Sample Bookings (10 Total)**

### **Booking Statistics:**
- **Pending:** 3 bookings
- **Confirmed:** 5 bookings
- **Completed:** 2 bookings
- **Cancelled:** 0 bookings
- **Total Revenue:** ₱33,000.00 (from completed bookings)

### **Booking Examples:**

1. **Juan Dela Cruz** - Wedding Photography (Confirmed)
   - Date: May 15, 2025
   - Location: Manila Hotel
   - Price: ₱27,000

2. **Maria Santos** - Birthday Photography (Confirmed)
   - Date: April 30, 2025
   - Location: The Peninsula Manila
   - Price: ₱9,000

3. **Pedro Reyes** - Corporate Event (Completed)
   - Date: April 10, 2025
   - Location: SMX Convention Center
   - Price: ₱19,500

---

## **🎨 Portfolio Categories**

### **5 Main Categories × 5 Subcategories = 25 Total**

#### **1. Wedding**
- Outdoor
- Indoor
- Church
- Beach
- Garden

#### **2. Birthday**
- Kids
- Adult
- Debut
- Themed
- Milestone

#### **3. Corporate**
- Conference
- Product
- Headshot
- Team
- Event

#### **4. Family**
- Portrait
- Reunion
- Newborn
- Maternity
- Extended

#### **5. Studio**
- Fashion
- Editorial
- Commercial
- Personal
- Creative

---

## **🔐 Creating Auth Accounts**

The seed data creates **database records**, but you also need to create accounts in **Supabase Auth**.

### **Method 1: Via Supabase Dashboard**

1. Go to: https://supabase.com/dashboard/project/wztiuvgmxivogvhqaxvu/auth/users

2. Click "Add user" → "Create new user"

3. Create each admin account:

   **Super Admin:**
   ```
   Email: superadmin@tutokpitik.com
   Password: SuperAdmin123!
   Auto-confirm: ✅ Yes
   ```

   **Admin:**
   ```
   Email: admin@tutokpitik.com
   Password: Admin123!
   Auto-confirm: ✅ Yes
   ```

   **Staff:**
   ```
   Email: staff@tutokpitik.com
   Password: Staff123!
   Auto-confirm: ✅ Yes
   ```

4. After creating, update the user metadata:
   - Click on each user
   - Edit "User Metadata" (raw JSON)
   - Add role:
   ```json
   {
     "role": "superadmin"
   }
   ```

---

### **Method 2: Via SQL Trigger (Automatic)**

Create a trigger that automatically creates user profiles:

```sql
-- Trigger to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## **📊 Viewing Data**

### **Check Users:**
```sql
SELECT id, email, full_name, role, created_at 
FROM users 
ORDER BY created_at DESC;
```

### **Check Bookings:**
```sql
SELECT 
  b.id,
  b.full_name,
  b.service,
  b.booking_date,
  b.total_price,
  b.status
FROM bookings b
ORDER BY b.booking_date DESC;
```

### **Check Booking Statistics:**
```sql
SELECT * FROM booking_statistics;
```

### **Check User Statistics:**
```sql
SELECT * FROM user_statistics;
```

---

## **🔧 Maintenance**

### **Reset Database:**
```sql
-- Drop all tables (⚠️ WARNING: This deletes ALL data!)
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS portfolio_images CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP VIEW IF EXISTS booking_statistics;
DROP VIEW IF EXISTS user_statistics;
DROP VIEW IF EXISTS portfolio_statistics;

-- Then run schema.sql again
```

### **Clear Seed Data Only:**
```sql
-- Delete bookings
DELETE FROM bookings;

-- Delete users (except auth users)
DELETE FROM users WHERE email LIKE '%@tutokpitik.com' OR email LIKE '%@gmail.com';

-- Then run seed_data.sql again
```

---

## **✅ Verification Checklist**

After setup, verify:

- [ ] All 5 tables created
- [ ] 3 admin accounts in `users` table
- [ ] 5 customer accounts in `users` table
- [ ] 10 bookings in `bookings` table
- [ ] Admin accounts created in Supabase Auth
- [ ] Can login as superadmin, admin, staff
- [ ] Can view bookings in Admin Dashboard
- [ ] Can export bookings to PDF
- [ ] RLS policies active

---

## **📈 Expected Data Count**

After running both SQL files:

```sql
SELECT 
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM users WHERE role IN ('superadmin', 'admin', 'staff')) AS admin_users,
  (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customer_users,
  (SELECT COUNT(*) FROM bookings) AS total_bookings,
  (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending_bookings,
  (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS confirmed_bookings,
  (SELECT COUNT(*) FROM bookings WHERE status = 'completed') AS completed_bookings;
```

**Expected Result:**
```
total_users: 8
admin_users: 3
customer_users: 5
total_bookings: 10
pending_bookings: 3
confirmed_bookings: 5
completed_bookings: 2
```

---

## **🎯 Testing PDF Export**

After setup:

1. Login as admin: `admin@tutokpitik.com`
2. Open Admin Dashboard
3. Go to "Bookings" tab
4. Click "Export PDF" button
5. PDF should download with all 10 bookings
6. Go to "Users" tab
7. Click "Export PDF" button
8. PDF should download with all 8 users

---

## **🚨 Troubleshooting**

### **Error: "relation already exists"**
- Tables already created
- Run the reset commands above first

### **Error: "duplicate key value"**
- Data already inserted
- Run clear seed data commands above

### **Error: "permission denied"**
- Check RLS policies
- Make sure you're authenticated
- Check user role has correct permissions

### **Bookings not visible in dashboard**
- Check user is authenticated
- Check user role is admin/staff
- Check RLS policies are enabled
- Check data exists: `SELECT * FROM bookings;`

---

## **📚 Related Documentation**

- [QUICK_START.md](../QUICK_START.md) - Deployment guide
- [SETUP_COMPLETE.md](../SETUP_COMPLETE.md) - What's been configured
- [ARCHITECTURE_DIAGRAM.md](../ARCHITECTURE_DIAGRAM.md) - System architecture

---

**Your database is now ready with admin accounts and sample data!** 🎉
