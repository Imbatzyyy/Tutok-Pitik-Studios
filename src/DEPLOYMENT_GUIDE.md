# Tutok Pitik Studios - Netlify Deployment Guide

## Prerequisites

- GitHub repository with your code
- Netlify account
- Neon Database account (for database features)

## Step 1: Prepare Your Code

1. Ensure all environment variables are set up correctly
2. Test the build locally:
```bash
npm run build
```

## Step 2: Deploy to Netlify

### Option A: Deploy via Netlify UI

1. Go to [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click "Deploy site"

### Option B: Deploy via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

## Step 3: Configure Environment Variables

1. Go to your Netlify site dashboard
2. Navigate to: Site settings → Environment variables
3. Add the following variables:

```
VITE_NEON_DATABASE_URL=your_neon_database_connection_string
VITE_NETLIFY_SITE_URL=https://your-site-name.netlify.app
```

## Step 4: Set Up Neon Database

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project
3. Copy your connection string
4. Run the schema migration:

```bash
psql "your_connection_string" < database/schema.sql
```

## Step 5: Configure Netlify Forms

Netlify Forms are already configured in the Contact component. To view form submissions:

1. Go to your Netlify site dashboard
2. Navigate to: Forms
3. All booking form submissions will appear here
4. Set up email notifications:
   - Forms → Form notifications
   - Add your email to receive notifications

## Step 6: Custom Domain (Optional)

1. Go to: Domain settings
2. Click "Add custom domain"
3. Follow DNS configuration instructions

## Step 7: Enable HTTPS

Netlify automatically provisions SSL certificates. Ensure:
- HTTPS is enabled (automatic)
- Force HTTPS redirect is enabled

## Verification Checklist

- [ ] Site builds successfully
- [ ] All pages load correctly
- [ ] Forms are submitting
- [ ] Images are loading
- [ ] Google Fonts are loading
- [ ] localStorage features work
- [ ] Responsive design works on mobile

## Troubleshooting

### Build Fails

Check build logs in Netlify dashboard for errors. Common issues:
- Missing dependencies: Run `npm install`
- TypeScript errors: Run `npm run build` locally first

### Forms Not Working

Ensure the form has:
```html
<form name="booking" method="POST" data-netlify="true">
  <input type="hidden" name="form-name" value="booking" />
  ...
</form>
```

### Environment Variables Not Working

- Prefix must be `VITE_` for Vite
- Redeploy after adding variables
- Variables don't work in preview deploys by default

## Database Migration (Future)

When ready to switch from localStorage to Neon Database:

1. Update `lib/db.ts` to use actual database queries
2. Create API routes in `/netlify/functions/`
3. Migrate existing localStorage data
4. Test thoroughly before switching

## Support

For issues:
- Check Netlify docs: https://docs.netlify.com
- Check Neon docs: https://neon.tech/docs
- Review build logs in Netlify dashboard
