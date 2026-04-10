# 📸 Tutok Pitik Studios

> Professional Photography Portfolio & Booking Management System

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR_BADGE_ID/deploy-status)](https://app.netlify.com/sites/YOUR_SITE/deploys)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.4-646CFF)](https://vitejs.dev/)

## ✨ Overview

Tutok Pitik Studios is a complete photography business management platform featuring a stunning portfolio gallery, advanced booking system, and comprehensive admin dashboard. Built with React, TypeScript, and modern web technologies.

### 🎯 Key Features

- **📷 Portfolio Gallery** - 25-category classification system with lightbox viewer
- **📅 Booking System** - Custom calendar with real-time pricing calculator  
- **👥 User Management** - 5 role types with permissions (Super Admin, Admin, Staff, Customer, Guest)
- **💼 Admin Dashboard** - Full CRUD operations for bookings and users
- **📧 Email Integration** - Netlify Forms for automatic email notifications
- **🗄️ Database Ready** - Neon PostgreSQL integration + localStorage fallback
- **📱 Responsive Design** - Mobile-first, fully responsive across all devices
- **🚀 Production Ready** - Optimized builds, clean code, zero errors

---

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/tutok-pitik-studios.git
cd tutok-pitik-studios

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev
```

Visit http://localhost:3000

### Build & Deploy

```bash
# Verify project setup
npm run verify

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Netlify
netlify deploy --prod
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[📖 SETUP_COMPLETE.md](./SETUP_COMPLETE.md)** | **START HERE** - Complete setup overview |
| [⚡ QUICK_START.md](./QUICK_START.md) | Get up and running in 5 minutes |
| [🚀 DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Step-by-step Netlify deployment |
| [🔧 ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) | Environment variables configuration |
| [💻 VS_CODE_SETUP.md](./VS_CODE_SETUP.md) | VS Code configuration guide |
| [📁 PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Complete file organization |
| [⚙️ NETLIFY_COMMANDS.md](./NETLIFY_COMMANDS.md) | All Netlify CLI commands |
| [📘 COMPLETE_GUIDE.md](./COMPLETE_GUIDE.md) | Everything in one place |
| [✅ PRE_DEPLOYMENT_CHECKLIST.md](./PRE_DEPLOYMENT_CHECKLIST.md) | Deployment checklist |
| [📋 DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) | Documentation navigation |

---

## 🛠️ Tech Stack

### Core
- **React 18.2** - UI library
- **TypeScript 5.0** - Type safety
- **Vite 4.4** - Build tool
- **Tailwind CSS 4.0** - Styling

### Deployment & Backend
- **Netlify** - Hosting & deployment
- **Netlify Forms** - Contact form handling
- **Neon** - PostgreSQL database (optional)

### Additional Libraries
- **Lucide React** - Icons
- **localStorage** - Client-side data persistence

---

## 📂 Project Structure

```
tutok-pitik-studios/
├── components/          # 17 React components
│   ├── About.tsx
│   ├── AdminDashboard.tsx
│   ├── Auth.tsx
│   ├── BookingCalendar.tsx
│   ├── Contact.tsx
│   ├── Portfolio.tsx
│   ├── UserProfile.tsx
│   └── ... (10 more)
│
├── lib/                 # Utilities & types
│   ├── db.ts           # Database functions
│   └── types.ts        # TypeScript definitions
│
├── database/            # SQL schemas
│   └── schema.sql      # PostgreSQL schema
│
├── styles/              # Global styles
│   └── globals.css     # Tailwind CSS
│
├── App.tsx             # Main application
└── ... (config files)
```

---

## 🎨 Features in Detail

### Portfolio System
- 📁 **5 Main Categories**: Portrait, Events, Creative, Commercial, Documentary
- 🏷️ **25 Subcategories**: 5 subcategories per main category
- 🖼️ **Lightbox Viewer**: Full-screen image viewing with navigation
- ⭐ **Favorites**: Save favorite images (logged-in users)
- 🔍 **Smart Filtering**: Filter by category and subcategory

### Booking System
- 📅 **Custom Calendar**: Visual date selection with blocked dates
- ⏰ **Time Slots**: 8 AM - 8 PM hourly slots
- 💰 **Pricing Calculator**: Real-time price calculation
  - Portrait Photography - ₱2,500/hour
  - Birthday Photography - ₱1,000/hour
  - Commercial Photography - ₱4,000/hour
  - Event Coverage - ₱1,500/hour
  - Landscape & Architecture - ₱3,000/hour
- 📧 **Email Confirmations**: Via Netlify Forms
- 🚫 **Booking Limits**: 3 bookings per customer
- 🚗 **Transportation Fees**: Calculated and noted

### User Roles & Permissions

| Role | Portfolio | Booking | Profile | Admin Dashboard |
|------|-----------|---------|---------|-----------------|
| **Super Admin** | ✅ View + Favorite | ❌ | ✅ | ✅ Full Access |
| **Admin** | ✅ View + Favorite | ❌ | ✅ | ✅ Limited Access |
| **Staff** | ✅ View + Favorite | ❌ | ✅ | ✅ View Only |
| **Customer** | ✅ View + Favorite | ✅ Create | ✅ | ❌ |
| **Guest** | ✅ View Only | ❌ | ❌ | ❌ |

### Admin Dashboard
- 📊 **Statistics Overview**: Total bookings, users, revenue
- 📋 **Booking Management**: View, update, delete bookings
- 👥 **User Management**: CRUD operations for users
- 🏷️ **Role Badges**: Visual role indicators
- 📱 **Responsive Tables**: Mobile-optimized data display

---

## 🔐 Environment Variables

Create a `.env` file:

```env
VITE_NEON_DATABASE_URL=postgresql://user:pass@host/database
VITE_NETLIFY_SITE_URL=https://your-site.netlify.app
```

See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for details.

---

## 🧪 Testing

### Default Test Accounts

**Super Admin:**
- Email: `admin@tutokpitik.com`
- Password: `admin123`

**Customer:**
- Email: `customer@test.com`
- Password: `customer123`

**Guest:**
- No login required

### Testing Checklist

- [x] Portfolio filtering works
- [x] Lightbox navigation works
- [x] Booking form validation works
- [x] Login/register works
- [x] Admin dashboard loads
- [x] User profile updates work
- [x] Mobile responsive design works
- [x] Forms submit correctly

---

## 🚀 Deployment to Netlify

### Prerequisites
- GitHub account
- Netlify account
- Neon account (optional, for database)

### Quick Deploy

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

2. **Deploy on Netlify**
   - Go to [Netlify](https://app.netlify.com)
   - "Add new site" → "Import an existing project"
   - Connect GitHub → Select repository
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Deploy!

3. **Configure Environment Variables**
   - Site settings → Environment variables
   - Add `VITE_NEON_DATABASE_URL` and `VITE_NETLIFY_SITE_URL`

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete instructions.

---

## 🗄️ Database Setup (Optional)

### Neon PostgreSQL

1. Create account at [Neon](https://neon.tech)
2. Create new project
3. Copy connection string
4. Run migration:
```bash
psql "YOUR_CONNECTION_STRING" < database/schema.sql
```

### localStorage (Default)

The app works out-of-the-box with localStorage for data persistence. No database setup required for development or demos.

---

## 📧 Netlify Forms

Forms are automatically configured and will work when deployed to Netlify.

### Setup Email Notifications
1. Netlify Dashboard → Forms
2. Form notifications → Add email
3. Select trigger: "New form submission"

All booking requests will be sent to your email.

---

## 🎓 For Academic Use

This project meets academic requirements:
- ✅ 5 user roles with CRUD operations
- ✅ 25 classification categories in portfolio
- ✅ Complete booking management system
- ✅ Clean, professional code
- ✅ TypeScript for type safety
- ✅ Responsive mobile design
- ✅ SQL database migration ready
- ✅ Production deployment ready

**Perfect for screenshots in Visual Studio Code - zero errors!**

---

## 🤝 Contributing

This is an academic/portfolio project, but suggestions are welcome!

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

MIT License - feel free to use for learning and portfolio purposes.

---

## 📞 Contact

**Tutok Pitik Studios**
- 📧 Email: tutokpitikstudios@gmail.com
- 📱 Phone: +63 962 4323 187
- 📍 Location: Quezon City, Philippines
- 📷 Instagram: [@tutokpitikstudios_](https://www.instagram.com/tutokpitikstudios_/)
- 👍 Facebook: [Tutok Pitik Studios](https://www.facebook.com/profile.php?id=61554013355967)
- 🎨 Behance: [Prince Balane](https://www.behance.net/princebalane)

---

## 🙏 Acknowledgments

- React team for amazing framework
- Netlify for seamless deployment
- Neon for PostgreSQL database
- Tailwind CSS for utility-first styling
- TypeScript for type safety

---

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

**Built with ❤️ by Prince Balane for Tutok Pitik Studios**

📸 Capturing moments, creating memories.
