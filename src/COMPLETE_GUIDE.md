# Complete Guide - Tutok Pitik Studios

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Project Overview](#project-overview)
3. [Installation](#installation)
4. [Development](#development)
5. [Deployment](#deployment)
6. [Database Setup](#database-setup)
7. [Netlify Forms](#netlify-forms)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-username/tutok-pitik-studios.git
cd tutok-pitik-studios
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your values

# 3. Run development server
npm run dev
```

Open http://localhost:3000

---

## 📖 Project Overview

### What This Is
Professional photography portfolio and booking management system with:
- 5 user roles (Super Admin, Admin, Staff, Customer, Guest)
- 25-category portfolio classification system
- Full booking management with pricing calculator
- Admin dashboard with CRUD operations
- Netlify Forms integration for emails
- Future Neon Database compatibility

### Tech Stack
- **Frontend**: React 18.2 + TypeScript 5.0
- **Styling**: Tailwind CSS 4.0
- **Build**: Vite 4.4
- **Deployment**: Netlify
- **Database**: Neon (PostgreSQL) - optional
- **Forms**: Netlify Forms

---

## 💻 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git
- VS Code (recommended)

### Step-by-Step

1. **Clone Repository**
```bash
git clone https://github.com/your-username/tutok-pitik-studios.git
cd tutok-pitik-studios
```

2. **Install Dependencies**
```bash
npm install
```

3. **Environment Setup**
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_NEON_DATABASE_URL=your_database_url_here
VITE_NETLIFY_SITE_URL=http://localhost:3000
```

4. **Verify Installation**
```bash
npm run dev
```

Should open http://localhost:3000

---

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Project Structure

```
tutok-pitik-studios/
├── App.tsx              # Main app
├── components/          # 17 React components
├── lib/                 # Utilities & types
├── database/            # SQL schemas
├── public/              # Static files
├── src/main.tsx         # Entry point
└── styles/globals.css   # Global styles
```

### Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Main application logic |
| `lib/types.ts` | TypeScript types |
| `lib/db.ts` | Database utilities |
| `netlify.toml` | Deployment config |
| `database/schema.sql` | Database schema |

### Development Tips

1. **VS Code - No Red Errors**
   - Open project in VS Code
   - All files should have no TypeScript errors
   - If errors appear, run: `npm install`

2. **Hot Reload**
   - Vite provides instant hot reload
   - Changes appear immediately

3. **TypeScript Checking**
   ```bash
   tsc --noEmit
   ```

4. **Format Code**
   - Use VS Code's format on save
   - Or manually format files

---

## 🚀 Deployment

### Option 1: Netlify UI (Recommended)

1. **Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Deploy on Netlify**
   - Go to https://app.netlify.com
   - Click "Add new site"
   - Import from GitHub
   - Select repository
   - Build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
   - Click "Deploy site"

3. **Add Environment Variables**
   - Site settings → Environment variables
   - Add:
     ```
     VITE_NEON_DATABASE_URL = your_neon_url
     VITE_NETLIFY_SITE_URL = https://your-site.netlify.app
     ```

4. **Redeploy**
   - Deploys → Trigger deploy → Deploy site

### Option 2: Netlify CLI

```bash
# Install CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

### Build Verification

Before deploying:
```bash
# Test build locally
npm run build

# Preview build
npm run preview

# Check for errors
npm run lint
```

---

## 🗄️ Database Setup

### Using Neon (Optional)

1. **Create Neon Account**
   - Go to https://console.neon.tech
   - Sign up / Login
   - Create new project

2. **Get Connection String**
   - Navigate to project
   - Copy connection string:
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require
   ```

3. **Run Schema Migration**
```bash
# Install PostgreSQL client (if needed)
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Run migration
psql "YOUR_CONNECTION_STRING" < database/schema.sql
```

4. **Add to Environment**
   - Local: Add to `.env`
   - Netlify: Add to environment variables
   - Redeploy if needed

### Using localStorage (Default)

The app currently uses localStorage for data persistence. This works immediately without database setup.

**Limitations:**
- Data stored in browser only
- Lost when clearing browser data
- Not shared between devices

**Advantages:**
- No database setup needed
- Works immediately
- Great for development and demos

---

## 📧 Netlify Forms

### How It Works

Forms are automatically detected by Netlify when you deploy.

### Setup

1. **Form Already Configured**
   - The Contact component has proper attributes
   - Hidden form exists in `/public/forms.html`

2. **Viewing Submissions**
   - Netlify Dashboard → Forms tab
   - All submissions appear here

3. **Email Notifications**
   - Forms → Form notifications
   - Add your email
   - Choose trigger: "New form submission"
   - Save

### Testing Forms

**In Development:**
- Forms log to console
- Data saved to localStorage
- Success modal appears

**In Production:**
- Forms submit to Netlify
- Email notifications sent
- Data viewable in dashboard

---

## 🐛 Troubleshooting

### Build Fails

**Error: TypeScript errors**
```bash
# Check errors
tsc --noEmit

# Fix by updating types in components
```

**Error: Module not found**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Error: Out of memory**
```bash
# Increase Node memory
export NODE_OPTIONS=--max-old-space-size=4096
npm run build
```

### VS Code Errors

**Red squiggly lines everywhere**
1. Close VS Code
2. Delete `node_modules`
3. Run `npm install`
4. Reopen VS Code
5. Reload window (Cmd/Ctrl + Shift + P → Reload Window)

**TypeScript not working**
1. Check TypeScript version: `tsc --version`
2. Reinstall: `npm install -D typescript`
3. VS Code: Select TypeScript version
   - Open any `.ts` file
   - Click TypeScript version in status bar
   - Select "Use Workspace Version"

### Runtime Errors

**Images not loading**
- Check figma:asset imports
- Ensure images exist
- Check browser console for 404s

**Forms not submitting**
- Check Netlify dashboard for form detection
- Verify form name matches
- Check for JavaScript errors

**Booking limit errors**
- localStorage might be full
- Clear browser data
- Check console for errors

### Deployment Issues

**Build succeeds locally but fails on Netlify**
- Check Node version (should be 18)
- Check environment variables
- View build logs in Netlify

**Forms not detected**
- Ensure `/public/forms.html` exists
- Check form has `data-netlify="true"`
- Redeploy

**Environment variables not working**
- Must be prefixed with `VITE_`
- Redeploy after adding
- Check values in build logs (be careful with secrets)

---

## 📚 Documentation Files

| File | Description |
|------|-------------|
| `README.md` | Main documentation |
| `QUICK_START.md` | Get started quickly |
| `DEPLOYMENT_GUIDE.md` | Detailed deployment steps |
| `ENVIRONMENT_SETUP.md` | Environment variables |
| `PROJECT_STRUCTURE.md` | File organization |
| `NETLIFY_COMMANDS.md` | CLI commands reference |
| `PRE_DEPLOYMENT_CHECKLIST.md` | Pre-deploy checklist |
| `COMPLETE_GUIDE.md` | This file |

---

## 🎯 Key Features

### User Roles
1. **Super Admin** - Full access
2. **Admin** - Manage bookings/users
3. **Staff** - View bookings
4. **Customer** - Make bookings
5. **Guest** - Browse only

### Portfolio System
- 5 main categories
- 5 subcategories each (25 total)
- Image lightbox
- Favorites feature (logged-in users)

### Booking System
- Custom calendar
- Time slot selection
- Automatic pricing calculation
- 3 booking limit per user
- Email confirmations

### Admin Dashboard
- Booking management (CRUD)
- User management (CRUD)
- Statistics overview
- Role-based access

---

## 📞 Support

- **Email**: tutokpitikstudios@gmail.com
- **Phone**: +63 962 4323 187
- **Instagram**: @tutokpitikstudios_
- **Facebook**: Tutok Pitik Studios

---

## ✅ Success Checklist

- [ ] Code cloned and installed
- [ ] Environment variables set
- [ ] Dev server runs without errors
- [ ] VS Code shows no TypeScript errors
- [ ] Build succeeds locally
- [ ] Deployed to Netlify
- [ ] Environment variables added to Netlify
- [ ] Forms detected by Netlify
- [ ] Email notifications configured
- [ ] Database setup (if using Neon)
- [ ] Site tested on mobile
- [ ] All features working

---

## 🎉 You're Ready!

Your Tutok Pitik Studios photography portfolio is now ready for deployment. Follow the steps in this guide, and you'll have a production-ready website in no time.

For detailed information on specific topics, refer to the other documentation files.

Happy deploying! 📸
