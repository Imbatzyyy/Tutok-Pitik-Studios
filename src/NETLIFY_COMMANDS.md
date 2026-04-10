# Netlify Deployment Commands

## Initial Setup

### Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Login to Netlify
```bash
netlify login
```

## Deployment Methods

### Method 1: Continuous Deployment (Recommended)

1. **Connect GitHub Repository**
   - Go to https://app.netlify.com
   - Click "Add new site"
   - Choose "Import an existing project"
   - Select GitHub and authorize
   - Choose your repository

2. **Configure Build Settings**
   ```
   Build command: npm run build
   Publish directory: dist
   ```

3. **Add Environment Variables**
   - Go to Site settings → Environment variables
   - Add your variables:
     ```
     VITE_NEON_DATABASE_URL
     VITE_NETLIFY_SITE_URL
     ```

4. **Deploy**
   - Netlify will automatically deploy on every push to main branch

### Method 2: Manual Deploy via CLI

```bash
# Initialize Netlify in your project
netlify init

# Deploy to production
netlify deploy --prod

# Deploy to preview
netlify deploy
```

### Method 3: Drag and Drop

1. Build locally:
```bash
npm run build
```

2. Go to https://app.netlify.com/drop
3. Drag the `dist` folder to upload

## Useful Netlify CLI Commands

### Development
```bash
# Run local Netlify dev server
netlify dev

# Open site in browser
netlify open

# Check site status
netlify status
```

### Deployment
```bash
# Deploy to production
netlify deploy --prod

# Deploy to preview URL
netlify deploy

# Build and deploy
netlify deploy --build --prod
```

### Site Management
```bash
# Link existing site
netlify link

# Unlink site
netlify unlink

# List all sites
netlify sites:list

# Get site info
netlify sites:info
```

### Environment Variables
```bash
# List environment variables
netlify env:list

# Set environment variable
netlify env:set KEY value

# Get environment variable
netlify env:get KEY

# Delete environment variable
netlify env:unset KEY
```

### Functions
```bash
# List functions
netlify functions:list

# Invoke function locally
netlify functions:invoke FUNCTION_NAME

# Create new function
netlify functions:create FUNCTION_NAME
```

### Forms
```bash
# List forms
netlify forms:list

# Show form submissions
netlify forms:show FORM_ID
```

## Build Configuration in netlify.toml

Your current configuration:
```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Common Build Commands

### Standard Build
```bash
npm run build
```

### Build with Type Checking
```bash
tsc && vite build
```

### Clean Build
```bash
rm -rf dist node_modules
npm install
npm run build
```

## Environment-Specific Builds

### Development
```bash
netlify dev
```

### Production Preview
```bash
npm run build
npm run preview
```

### Test Production Build Locally
```bash
npm run build
netlify dev --dir=dist
```

## Troubleshooting Commands

### Clear Build Cache
```bash
netlify build --clear-cache
```

### View Build Logs
```bash
netlify logs
```

### Check Site Details
```bash
netlify api getSite --data '{ "site_id": "YOUR_SITE_ID" }'
```

## Domain Configuration

### Add Custom Domain
```bash
netlify domains:add yourdomain.com
```

### List Domains
```bash
netlify domains:list
```

## SSL Certificate

Netlify automatically provisions SSL certificates. To check:
```bash
netlify status
```

## Rollback Deployment

Via Netlify UI:
1. Go to Deploys tab
2. Find previous successful deploy
3. Click "Publish deploy"

## Deploy Hooks

Create a deploy hook in Netlify UI, then trigger:
```bash
curl -X POST -d {} YOUR_DEPLOY_HOOK_URL
```

## GitHub Integration

### Automatic Deploys
- Push to `main` → Production deploy
- Pull request → Preview deploy
- Commit status checks

### Branch Deploys
Configure in Site settings → Build & deploy → Continuous Deployment

## Build Notifications

Configure in:
- Site settings → Build & deploy → Deploy notifications
- Options: Email, Slack, webhook

## Performance Monitoring

### Check Site Performance
```bash
netlify lighthouse
```

### Enable Analytics
```bash
netlify analytics:enable
```

## Database Connection Test

Test Neon database connection:
```bash
# Install PostgreSQL client
npm install -g pg

# Test connection
psql "YOUR_NEON_DATABASE_URL"
```

## Quick Reference

| Task | Command |
|------|---------|
| Login | `netlify login` |
| Initialize | `netlify init` |
| Deploy | `netlify deploy --prod` |
| Dev server | `netlify dev` |
| Open site | `netlify open:site` |
| Open admin | `netlify open:admin` |
| Status | `netlify status` |
| Logs | `netlify logs` |

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to Netlify
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run build
      - uses: netlify/actions/cli@master
        with:
          args: deploy --prod
        env:
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
```

## Support Resources

- Netlify Docs: https://docs.netlify.com
- Netlify Forums: https://answers.netlify.com
- Status Page: https://www.netlifystatus.com
- CLI Docs: https://cli.netlify.com
