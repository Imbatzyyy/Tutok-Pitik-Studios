# Project Structure - Tutok Pitik Studios

## Root Directory

```
tutok-pitik-studios/
├── App.tsx                          # Main application component
├── index.html                       # HTML entry point
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── tsconfig.node.json              # TypeScript config for Node
├── vite.config.ts                  # Vite build configuration
├── netlify.toml                    # Netlify deployment config
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore rules
├── README.md                       # Main documentation
├── QUICK_START.md                  # Quick start guide
├── DEPLOYMENT_GUIDE.md             # Deployment instructions
├── ENVIRONMENT_SETUP.md            # Environment setup guide
└── PRE_DEPLOYMENT_CHECKLIST.md     # Deployment checklist
```

## Components Directory

```
components/
├── About.tsx                 # About section component
├── AdminDashboard.tsx        # Admin dashboard with CRUD operations
├── Auth.tsx                  # Login/Register modal
├── BookingCalendar.tsx       # Custom booking calendar
├── Contact.tsx               # Contact form with Netlify Forms
├── Footer.tsx                # Footer component
├── Hero.tsx                  # Hero section
├── Lightbox.tsx              # Image lightbox viewer
├── LoadingScreen.tsx         # Initial loading animation
├── Navigation.tsx            # Main navigation bar
├── Notification.tsx          # Toast notifications
├── Portfolio.tsx             # Portfolio gallery with filters
├── ScrollToTop.tsx           # Scroll to top button
├── Services.tsx              # Services section
├── StatsBar.tsx              # Animated statistics bar
├── SuccessModal.tsx          # Success confirmation modal
├── UserProfile.tsx           # User profile management
└── ui/                       # Reusable UI components
    ├── accordion.tsx
    ├── alert-dialog.tsx
    ├── alert.tsx
    ├── avatar.tsx
    ├── badge.tsx
    ├── button.tsx
    ├── calendar.tsx
    ├── card.tsx
    ├── checkbox.tsx
    ├── dialog.tsx
    ├── input.tsx
    ├── label.tsx
    ├── select.tsx
    ├── separator.tsx
    ├── table.tsx
    ├── tabs.tsx
    ├── textarea.tsx
    └── ... (additional UI components)
```

## Library Directory

```
lib/
├── db.ts            # Database utility functions (localStorage fallback)
└── types.ts         # TypeScript type definitions
```

## Database Directory

```
database/
└── schema.sql       # PostgreSQL schema for Neon database
```

## Source Directory

```
src/
└── main.tsx         # React application entry point
```

## Styles Directory

```
styles/
└── globals.css      # Global CSS styles with Tailwind
```

## Public Directory

```
public/
├── _redirects/      # Netlify redirects
├── forms.html       # Static form for Netlify Forms detection
├── robots.txt       # Search engine crawling rules
└── sitemap.xml      # Site map for SEO
```

## Netlify Functions

```
netlify/
└── functions/
    └── db.ts        # Serverless function for database queries
```

## Scripts Directory

```
scripts/
└── prebuild.js      # Pre-build script for Netlify Forms
```

## Configuration Files Details

### package.json
- Project metadata
- Dependencies (React, TypeScript, Vite)
- Scripts (dev, build, preview, lint)

### tsconfig.json
- TypeScript compiler options
- Path aliases configuration
- Strict mode disabled for flexibility
- Module resolution settings

### vite.config.ts
- React plugin configuration
- Path aliases
- Build optimization
- Development server settings

### netlify.toml
- Build command and publish directory
- Redirect rules for SPA routing
- Security headers
- Cache control headers
- Node version specification

## Key Features by Directory

### Components (17 files)
- **Navigation**: Role-based menu system
- **Auth**: Login/Register with role selection
- **Portfolio**: 25-classification filtering system
- **Contact**: Netlify Forms integration
- **AdminDashboard**: Full CRUD operations
- **BookingCalendar**: Custom date picker with blocking
- **UserProfile**: Profile management with image upload
- **Lightbox**: Portfolio image viewer with favorites

### Library
- **types.ts**: TypeScript interfaces for User, Booking, etc.
- **db.ts**: Database operations (localStorage + future SQL)

### Database
- **schema.sql**: Complete PostgreSQL schema
  - Users table with roles
  - Bookings table with status
  - Contact messages table
  - Favorites table
  - Indexes and triggers

### Styles
- **globals.css**: 
  - Tailwind CSS imports
  - Custom CSS variables
  - Component styles
  - Animations
  - Responsive utilities

## File Naming Conventions

- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Utilities**: camelCase (e.g., `db.ts`)
- **Config**: lowercase with extension (e.g., `vite.config.ts`)
- **Documentation**: UPPERCASE with extension (e.g., `README.md`)

## Import Patterns

### Component Imports
```typescript
import Navigation from './components/Navigation';
```

### Type Imports
```typescript
import type { User } from './lib/types';
```

### Asset Imports (Figma)
```typescript
import img from 'figma:asset/[hash].png';
```

### Style Imports
```typescript
import './styles/globals.css';
```

## Build Output

After running `npm run build`, the `dist/` directory contains:
```
dist/
├── index.html
├── assets/
│   ├── [name].[hash].js
│   ├── [name].[hash].css
│   └── [images]
└── forms.html
```

## Environment Variables

Located in `.env` (not committed):
```
VITE_NEON_DATABASE_URL=postgresql://...
VITE_NETLIFY_SITE_URL=https://...
```

## Git Ignored Files

- `node_modules/`
- `dist/`
- `.env`
- `*.local`
- `.netlify/`

## Total File Count

- **React Components**: 17
- **UI Components**: 30+
- **Utility Files**: 2
- **Config Files**: 5
- **Documentation**: 6
- **Database Files**: 1

## Dependencies

### Production
- react: ^18.2.0
- react-dom: ^18.2.0
- lucide-react: ^0.263.1

### Development
- TypeScript: ^5.0.2
- Vite: ^4.4.5
- Tailwind CSS: ^4.0.0
- ESLint + plugins
- TypeScript types

## Code Organization Best Practices

1. One component per file
2. Components in `/components` directory
3. Utilities in `/lib` directory
4. Types centralized in `lib/types.ts`
5. Styles in `styles/globals.css`
6. No inline styles (use Tailwind classes)
7. Consistent naming conventions
8. Proper TypeScript types everywhere
