# 🏗️ System Architecture - Tutok Pitik Studios

## **Complete System Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ENVIRONMENT                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│                  │         │                  │         │                  │
│  NETLIFY         │◄────────│  USERS           │────────►│  SUPABASE        │
│  (Frontend)      │         │  (Browsers)      │         │  (Backend)       │
│                  │         │                  │         │                  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
        │                            │                            │
        │                            │                            │
        ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  React App       │         │  5 User Roles    │         │  PostgreSQL DB   │
│  Tailwind CSS    │         │  - Super Admin   │         │  + KV Store      │
│  TypeScript      │         │  - Admin         │         │  Auth System     │
│                  │         │  - Staff         │         │                  │
│  Vite Build      │         │  - Customer      │         │  Edge Functions  │
│                  │         │  - Guest         │         │                  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
                                                                   │
                                                                   │
                                                                   ▼
                                                           ┌──────────────────┐
                                                           │  RESEND          │
                                                           │  (Email Service) │
                                                           │                  │
                                                           │  5 Email Types   │
                                                           └──────────────────┘
```

---

## **Environment Variables Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENVIRONMENT VARIABLES                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND (.env → Netlify)                                       │
│  ────────────────────────────────────────────────────────────    │
│  1. VITE_SUPABASE_URL                                            │
│     └─► Used by: Supabase client (lib/supabase.ts)              │
│     └─► Value: https://wztiuvgmxivogvhqaxvu.supabase.co          │
│                                                                  │
│  2. VITE_SUPABASE_ANON_KEY                                       │
│     └─► Used by: Supabase authentication                         │
│     └─► Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...          │
│                                                                  │
│  3. VITE_NETLIFY_SITE_URL                                        │
│     └─► Used by: Email links, redirects                          │
│     └─► Value: https://tutokpitikstudios.netlify.app            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  BACKEND (Supabase Edge Function Secrets)                        │
│  ────────────────────────────────────────────────────────────    │
│  4. RESEND_API_KEY                                               │
│     └─► Used by: Email sending (Edge Functions)                  │
│     └─► Value: re_7fXct1do_3PTNKFWvSdSERp8Qosa3X1M1             │
│                                                                  │
│  5. SITE_URL (Optional)                                          │
│     └─► Used by: Email template links                            │
│     └─► Value: https://tutokpitikstudios.netlify.app            │
│                                                                  │
│  Auto-Available:                                                 │
│  └─► SUPABASE_URL (automatically set)                            │
│  └─► SUPABASE_SERVICE_ROLE_KEY (automatically set)              │
└──────────────────────────────────────────────────────────────────┘
```

---

## **User Authentication Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIGN UP WITH EMAIL VERIFICATION               │
└─────────────────────────────────────────────────────────────────┘

1. User fills sign up form
   │
   ▼
2. Frontend sends to Supabase Auth
   │
   ▼
3. Supabase creates account (NOT ACTIVE)
   │
   ▼
4. Supabase triggers Edge Function
   │
   ▼
5. Edge Function sends welcome email via Resend
   │
   ▼
6. User receives email with verification link
   │
   ▼
7. User clicks link
   │
   ▼
8. Supabase verifies email
   │
   ▼
9. ✅ AUTO-LOGIN - User is automatically logged in
   │
   ▼
10. User data saved to KV Store
    │
    ▼
11. User redirected to homepage (authenticated)
```

---

## **Booking System Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE BOOKING WORKFLOW                     │
└─────────────────────────────────────────────────────────────────┘

CUSTOMER SIDE:
─────────────
1. Customer fills booking form
   │
   ▼
2. Frontend validates data
   │
   ▼
3. Sends to Supabase Edge Function
   │
   ▼
4. Edge Function saves to KV Store (status: "pending")
   │
   ▼
5. Edge Function sends booking submission email via Resend
   │
   ▼
6. Customer receives confirmation email
   │   "Your booking is pending admin confirmation"
   │
   ▼
7. Customer can view booking in profile
   └─► Status: Pending


ADMIN SIDE:
──────────
8. Admin opens Admin Dashboard
   │
   ▼
9. Admin sees pending booking in Bookings tab
   │
   ▼
10. Admin clicks "Confirm" button
    │
    ▼
11. Frontend sends confirm request to Edge Function
    │
    ▼
12. Edge Function updates booking (status: "confirmed")
    │
    ▼
13. Edge Function sends confirmation email to customer via Resend
    │
    ▼
14. Customer receives confirmation email
    │   "Your booking is confirmed!"
    │
    ▼
15. Customer sees updated status in profile
    └─► Status: Confirmed ✅
```

---

## **Email System Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    5 EMAIL NOTIFICATION TYPES                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  1. WELCOME EMAIL (Sign Up)                                      │
│     ────────────────────────                                     │
│     Trigger: User creates account                                │
│     Content: Welcome message + verification link                 │
│     Action: Click link → Email verified → Auto-login             │
│     Template: Beautiful HTML with brand colors (#E63946)         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  2. BOOKING SUBMISSION EMAIL                                     │
│     ──────────────────────────                                   │
│     Trigger: Customer submits booking                            │
│     Content: Booking details, confirmation number               │
│     Status: "Pending" (awaiting admin confirmation)              │
│     Recipient: Customer email                                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  3. BOOKING CONFIRMATION EMAIL                                   │
│     ────────────────────────────                                 │
│     Trigger: Admin confirms booking in dashboard                 │
│     Content: "Your booking is confirmed!" + session details      │
│     Status: "Confirmed"                                          │
│     Recipient: Customer email                                    │
│     Also Updates: Customer profile shows confirmed booking       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  4. PASSWORD RESET EMAIL                                         │
│     ──────────────────────                                       │
│     Trigger: User requests password reset                        │
│     Content: Reset link with expiration (1 hour)                 │
│     Action: Click link → Reset password page                     │
│     Security: Link expires after 1 hour                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  5. PROFILE UPDATE EMAIL                                         │
│     ──────────────────────                                       │
│     Trigger: User updates profile information                    │
│     Content: Summary of changes, updated fields                  │
│     Purpose: Security notification                               │
│     Recipient: User email                                        │
└──────────────────────────────────────────────────────────────────┘

ALL EMAILS:
──────────
✅ Beautiful HTML templates
✅ Brand colors (#E63946 primary)
✅ Professional design
✅ Mobile responsive
✅ Sent via Resend API
✅ Triggered by Supabase Edge Functions
```

---

## **Database Structure**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATA STORAGE                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  SUPABASE AUTH (Built-in)                                        │
│  ────────────────────────                                        │
│  - User accounts                                                 │
│  - Email verification                                            │
│  - Password hashing                                              │
│  - Session management                                            │
│  - Password reset                                                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  SUPABASE KV STORE (Custom Data)                                 │
│  ───────────────────────────────                                 │
│                                                                  │
│  users_data:                                                     │
│  {                                                               │
│    [userId]: {                                                   │
│      id: "uuid",                                                 │
│      fullName: "John Doe",                                       │
│      email: "john@example.com",                                  │
│      role: "customer",                                           │
│      profilePicture: "base64_or_url",                            │
│      joinDate: "2025-01-01",                                     │
│      username: "johndoe" (customers only)                        │
│    }                                                             │
│  }                                                               │
│                                                                  │
│  bookings:                                                       │
│  [                                                               │
│    {                                                             │
│      id: "uuid",                                                 │
│      userId: "user_uuid",                                        │
│      fullName: "John Doe",                                       │
│      email: "john@example.com",                                  │
│      service: "Wedding Photography",                             │
│      bookingDate: "2025-06-15",                                  │
│      startTime: "14:00",                                         │
│      endTime: "18:00",                                           │
│      duration: 4,                                                │
│      price: 15000,                                               │
│      transportationFee: 2000,                                    │
│      totalPrice: 17000,                                          │
│      location: "Manila",                                         │
│      status: "pending" | "confirmed" | "completed" | "cancelled",│
│      createdAt: "2025-01-01T00:00:00Z"                           │
│    }                                                             │
│  ]                                                               │
│                                                                  │
│  portfolio_images:                                               │
│  [                                                               │
│    {                                                             │
│      id: "uuid",                                                 │
│      title: "Beautiful Sunset Wedding",                          │
│      category: "Wedding",                                        │
│      subcategory: "Outdoor",                                     │
│      imageUrl: "base64_or_url",                                  │
│      createdAt: "2025-01-01T00:00:00Z",                          │
│      createdBy: "admin@tutokpitik.com"                           │
│    }                                                             │
│  ]                                                               │
│                                                                  │
│  favorites:                                                      │
│  {                                                               │
│    [userId]: ["imageId1", "imageId2", ...]                       │
│  }                                                               │
│                                                                  │
│  sessions:                                                       │
│  {                                                               │
│    [userId]: {                                                   │
│      sessionId: "uuid",                                          │
│      deviceId: "unique_device_hash",                             │
│      lastLogin: "2025-01-01T00:00:00Z"                           │
│    }                                                             │
│  }                                                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## **Admin Dashboard Features**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD TABS                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  📊 STATISTICS TAB                                               │
│     ───────────────                                              │
│     - Total users (by role)                                      │
│     - Total bookings (by status)                                 │
│     - Revenue from completed bookings                            │
│     - Portfolio images count                                     │
│     - Real-time data from Supabase                               │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  👥 USERS TAB                                                    │
│     ─────────                                                    │
│     CRUD Operations:                                             │
│     ✅ CREATE - Add new users (all roles)                        │
│     ✅ READ - View all users with filtering                      │
│     ✅ UPDATE - Edit user details                                │
│     ✅ DELETE - Remove users                                     │
│                                                                  │
│     Features:                                                    │
│     - Filter by role (Super Admin, Admin, Staff, Customer)       │
│     - Search by name/email                                       │
│     - Assign roles                                               │
│     - View user details                                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  📅 BOOKINGS TAB                                                 │
│     ────────────                                                 │
│     CRUD Operations:                                             │
│     ✅ CREATE - Add manual bookings                              │
│     ✅ READ - View all bookings                                  │
│     ✅ UPDATE - Change status, edit details                      │
│     ✅ DELETE - Cancel/remove bookings                           │
│                                                                  │
│     Features:                                                    │
│     - Confirm pending bookings → Sends email to customer ✉️      │
│     - Change status (Pending/Confirmed/Completed/Cancelled)      │
│     - View booking details                                       │
│     - Filter by status, date, service                            │
│     - Export booking data                                        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  🖼️ PORTFOLIO TAB                                                │
│     ─────────────                                                │
│     CRUD Operations:                                             │
│     ✅ CREATE - Upload new images to database                    │
│     ✅ READ - View all portfolio images                          │
│     ✅ UPDATE - Edit title, category, subcategory                │
│     ✅ DELETE - Remove images from database                      │
│                                                                  │
│     Features:                                                    │
│     - 5 categories × 5 subcategories = 25 classifications        │
│     - Upload images (converted to base64 or URL)                 │
│     - Edit image metadata                                        │
│     - Delete images with confirmation                            │
│     - Real-time update on frontend                               │
│     - Images stored in Supabase KV Store                         │
└──────────────────────────────────────────────────────────────────┘

ALL OPERATIONS:
──────────────
✅ Real-time updates via Supabase
✅ No localStorage usage
✅ Instant sync across devices
✅ Email notifications where applicable
```

---

## **Security Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
└─────────────────────────────────────────────────────────────────┘

AUTHENTICATION:
──────────────
✅ Supabase Auth (JWT tokens)
✅ Email verification required
✅ Secure password hashing
✅ Session management
✅ Single-device login enforcement

AUTHORIZATION:
─────────────
✅ Role-based access control (5 roles)
✅ Protected routes
✅ Admin-only dashboard
✅ Customer-only features (favorites, bookings)

DATA SECURITY:
─────────────
✅ HTTPS everywhere (Netlify + Supabase)
✅ API keys in environment variables
✅ RESEND_API_KEY in Supabase secrets (not frontend)
✅ No sensitive data in localStorage
✅ Secure database queries

EMAIL SECURITY:
──────────────
✅ Email verification required before login
✅ Password reset with expiring links
✅ Email sent from verified domain
✅ No API keys exposed to client

DEPLOYMENT SECURITY:
───────────────────
✅ Environment variables not committed to Git
✅ .gitignore includes .env files
✅ Netlify HTTPS automatic
✅ Supabase RLS policies (if using SQL tables)
```

---

## **File Structure**

```
tutok-pitik-studios/
│
├── .env                          # Local environment variables
├── .env.example                  # Template for others
├── .gitignore                    # Git ignore (includes .env)
│
├── src/
│   ├── App.tsx                   # Main app component
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client (uses env vars)
│   │   └── db.ts                # Database operations
│   └── components/
│       ├── Auth.tsx             # Sign in/up with email verification
│       ├── UserProfile.tsx      # User profile, favorites, bookings
│       ├── AdminDashboard.tsx   # Admin dashboard (full CRUD)
│       ├── Contact.tsx          # Booking form
│       ├── Portfolio.tsx        # Portfolio grid
│       └── Lightbox.tsx         # Lightbox with favorites
│
├── supabase/
│   └── functions/
│       └── server/
│           ├── index.tsx        # Edge Functions (email sending)
│           └── kv_store.tsx     # KV Store operations
│
└── docs/
    ├── README_DEPLOYMENT.md              # Main README
    ├── QUICK_START.md                    # 5-minute deployment
    ├── FINAL_DEPLOYMENT_CHECKLIST.md     # Complete checklist
    ├── SUPABASE_SECRETS_SETUP.md         # Supabase configuration
    ├── NETLIFY_DEPLOYMENT_GUIDE.md       # Netlify deployment
    ├── ENVIRONMENT_VARIABLES_SETUP.md    # Environment variables
    ├── COMPLETE_MIGRATION_SUMMARY.md     # Full documentation
    └── ARCHITECTURE_DIAGRAM.md           # This file
```

---

## **Production URLs**

```
Frontend:  https://tutokpitikstudios.netlify.app
Supabase:  https://wztiuvgmxivogvhqaxvu.supabase.co
Edge Functions: https://wztiuvgmxivogvhqaxvu.supabase.co/functions/v1/make-server-032fda65
```

---

**This architecture ensures:**
- ✅ Scalability (Supabase handles millions of users)
- ✅ Security (No sensitive data in frontend)
- ✅ Reliability (99.9% uptime from Netlify + Supabase)
- ✅ Real-time updates (Instant sync across devices)
- ✅ Email delivery (Resend with 99%+ deliverability)
- ✅ Professor requirements met (5 roles, CRUD, database storage)

**Ready for production deployment!** 🚀
