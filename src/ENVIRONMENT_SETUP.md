# Environment Setup Guide

## Local Development Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_NEON_DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
VITE_NETLIFY_SITE_URL=http://localhost:3000
```

## Netlify Production Environment Variables

Go to your Netlify dashboard: **Site settings → Environment variables**

Add the following:

### Database Connection
```
VITE_NEON_DATABASE_URL
```
Value: Your Neon database connection string

### Site URL
```
VITE_NETLIFY_SITE_URL
```
Value: https://your-site-name.netlify.app

## Getting Your Neon Database URL

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project or select existing
3. Navigate to **Connection Details**
4. Copy the connection string in this format:
```
postgresql://[user]:[password]@[endpoint]/[database]?sslmode=require
```

## Important Notes

### For Vite
- All environment variables must be prefixed with `VITE_`
- They are embedded at build time
- They are exposed to the client-side code
- Never store sensitive API keys in `VITE_` variables

### For Netlify
- Environment variables are set per deployment context (production, preview, branch deploys)
- Changes require a new deploy to take effect
- Use Netlify UI or CLI to manage variables

### Security
- Never commit `.env` files to version control
- `.env` is already in `.gitignore`
- Use `.env.example` as a template
- Rotate credentials regularly

## Netlify Forms Configuration

Netlify Forms are detected automatically. Ensure your form has:

```html
<form name="booking" method="POST" data-netlify="true">
  <input type="hidden" name="form-name" value="booking" />
  <!-- form fields -->
</form>
```

Form submissions appear in: **Netlify Dashboard → Forms**

## Email Notifications

To receive email notifications for form submissions:

1. Go to **Forms → Form notifications**
2. Add your email address
3. Choose notification triggers
4. Save settings

## Database Setup

After obtaining your Neon database URL:

```bash
psql "your_connection_string" < database/schema.sql
```

This creates all necessary tables and indexes.

## Verification

Test that environment variables work:

```bash
npm run dev
```

Check the browser console for any missing environment variable warnings.
