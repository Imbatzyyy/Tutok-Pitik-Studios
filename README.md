# Tutok Pitik Studios

A responsive photography studio website for presenting services and portfolio work, handling client inquiries and bookings, and supporting authenticated customer and administrator workflows.

## Features

- Responsive studio landing page with service, portfolio, statistics, and contact sections
- Searchable photography portfolio with favorites and an image lightbox
- Client registration, sign-in, password recovery, and persistent-session preferences
- Booking calendar and customer booking management
- User profiles and authenticated account experiences
- Administrator dashboard for studio operations and content management
- PDF generation for supported booking and reporting workflows
- Supabase-backed authentication, data, and server-side functions
- Netlify-ready single-page application routing and security headers

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, Radix UI, Motion, Lucide icons |
| Backend | Supabase Auth, database, and Edge Functions |
| Documents | jsPDF and jsPDF AutoTable |
| Hosting | Netlify |

## Local development

Requirements:

- Node.js 22
- npm
- A configured Supabase project

Create a local environment file:

```bash
cp .env.example .env.local
```

Set the browser-safe Supabase project URL and anonymous key, then install and start the application:

```bash
npm ci
npm run dev
```

The development server runs at `http://localhost:3000` by default.

## Production build

```bash
npm run build
```

The optimized website is generated in `dist/`. Netlify is configured to run the same command and publish that directory with SPA routing and baseline browser security headers.

Run `npm run typecheck` and `npm run test:edge-access` before releasing changes.
The production release branch is `codex/supabase-migration`. The active Supabase
project and migration verification, recovery notes, and email limitation are
documented in [the migration handoff](docs/SUPABASE-MIGRATION-2026-11-08.md).

## Repository safety

Environment files, dependency directories, generated builds, local Netlify state, logs, and operating-system metadata are excluded from version control. Keep Supabase service-role keys, provider credentials, SMTP passwords, and other server secrets in the deployment environment only; never place them in browser variables or commit them to this repository.
