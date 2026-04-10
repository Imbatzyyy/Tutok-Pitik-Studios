# ✅ Build Verification Guide

## **Pre-Build Checklist**

Before running `npm install` and `npm run build`, verify:

### **1. Environment Variables Setup** ✅

Check that `.env` file exists in project root:
```bash
ls -la .env
```

Should contain:
```env
VITE_SUPABASE_URL=https://wztiuvgmxivogvhqaxvu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_NETLIFY_SITE_URL=https://tutokpitikstudios.netlify.app
```

### **2. Dependencies** ✅

Check `package.json` has all required dependencies:
- ✅ `@supabase/supabase-js` (for Supabase client)
- ✅ `react` and `react-dom`
- ✅ `lucide-react` (for icons)
- ✅ `typescript` (for TypeScript compilation)
- ✅ `vite` (for build tooling)

---

## **Build Commands**

### **Step 1: Install Dependencies**

```bash
npm install
```

**What it does:**
- Installs all packages from `package.json`
- Creates `node_modules/` folder
- Generates `package-lock.json`

**Expected output:**
```
added X packages in Xs
```

**No errors should occur!**

---

### **Step 2: Build for Production**

```bash
npm run build
```

**What it does:**
1. Runs TypeScript compiler (`tsc`) to check types
2. Runs Vite build to bundle the app
3. Generates production files in `dist/` folder
4. Minifies JavaScript and CSS
5. Optimizes assets

**Expected output:**
```
vite v4.4.5 building for production...
✓ X modules transformed.
dist/index.html                   X.XX kB
dist/assets/index-XXXXX.css      XX.XX kB │ gzip: X.XX kB
dist/assets/index-XXXXX.js      XXX.XX kB │ gzip: XX.XX kB
✓ built in Xs
```

**Build should complete with NO errors!**

---

## **Common Build Errors & Solutions**

### **❌ Error: "Cannot find module '@supabase/supabase-js'"**

**Cause:** Dependencies not installed

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

### **❌ Error: "import.meta.env.VITE_SUPABASE_URL is undefined"**

**Cause:** Environment variables not loaded

**Fix:**
1. Verify `.env` file exists in project root
2. Verify variable names start with `VITE_`
3. Restart dev server or rebuild:
   ```bash
   npm run build
   ```

---

### **❌ Error: "Module not found: Can't resolve '../utils/supabase/info'"**

**Cause:** Old import path still being used

**Fix:** This should NOT happen - all files have been updated. If you see this:
```bash
grep -r "utils/supabase/info" components/
```

Should return NO results. All imports now use:
```typescript
import { supabase, projectId, publicAnonKey } from '../lib/supabase';
```

---

### **❌ TypeScript Compilation Errors**

**Cause:** Type errors in code

**Fix:**
1. Check the error message
2. Fix the file mentioned
3. Run again:
   ```bash
   npm run build
   ```

---

### **❌ Error: "ENOENT: no such file or directory, open '.env'"**

**Cause:** `.env` file missing (acceptable - fallbacks in place)

**Fix:** This is OK! The code has fallback values in `lib/supabase.ts`:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wztiuvgmxivogvhqaxvu.supabase.co';
```

Build will still succeed.

---

## **Build Output Verification**

After `npm run build` completes, check `dist/` folder:

```bash
ls -la dist/
```

Should contain:
```
dist/
├── index.html              (Main HTML file)
├── assets/
│   ├── index-[hash].js    (Bundled JavaScript)
│   ├── index-[hash].css   (Bundled CSS)
│   └── vendor-[hash].js   (React libraries)
└── ...other assets
```

---

## **Testing the Build Locally**

### **Method 1: Vite Preview**

```bash
npm run preview
```

Opens: http://localhost:4173

Test:
- ✅ Site loads
- ✅ No console errors
- ✅ Can navigate pages
- ✅ Environment variables work

### **Method 2: Serve Static Files**

```bash
npx serve dist
```

Opens: http://localhost:3000

---

## **Environment Variables in Build**

### **How It Works:**

1. **Development (`npm run dev`):**
   - Vite loads `.env` file
   - Replaces `import.meta.env.VITE_*` with actual values
   - Changes are hot-reloaded

2. **Production (`npm run build`):**
   - Vite loads `.env` file (or uses Netlify env vars)
   - Replaces `import.meta.env.VITE_*` with actual values at **build time**
   - Values are **hardcoded** into the bundle
   - No `.env` file needed in production

### **Example:**

**In code:**
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
```

**After build (in dist/assets/index-XXXXX.js):**
```javascript
const supabaseUrl = "https://wztiuvgmxivogvhqaxvu.supabase.co";
```

---

## **Netlify Build Settings**

When deploying to Netlify, ensure:

### **Build Settings:**
```
Build command: npm run build
Publish directory: dist
Node version: 18.x
```

### **Environment Variables:**
Set in Netlify Dashboard → Site Settings → Environment Variables:
```
VITE_SUPABASE_URL = https://wztiuvgmxivogvhqaxvu.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_NETLIFY_SITE_URL = https://tutokpitikstudios.netlify.app
```

Netlify will inject these values during build, just like your local `.env` file!

---

## **Build Checklist**

Before deploying:

- [ ] `.env` file created (or Netlify env vars set)
- [ ] All environment variables start with `VITE_`
- [ ] `npm install` completes without errors
- [ ] `npm run build` completes without errors
- [ ] `dist/` folder created
- [ ] `dist/index.html` exists
- [ ] `dist/assets/` contains JS and CSS files
- [ ] `npm run preview` works locally
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] All imports use `/lib/supabase` (not `/utils/supabase/info`)

---

## **Success Criteria**

Your build is successful when:

1. ✅ `npm install` completes in < 60 seconds
2. ✅ `npm run build` completes in < 30 seconds
3. ✅ No errors in build output
4. ✅ `dist/` folder created with all files
5. ✅ `npm run preview` shows working site
6. ✅ Environment variables load correctly
7. ✅ All features work in built version

---

## **Quick Test Commands**

```bash
# Full build verification
npm install && npm run build && npm run preview

# Check environment variables in build
npm run build && grep -r "wztiuvgmxivogvhqaxvu" dist/assets/*.js

# Verify no old imports
grep -r "utils/supabase/info" components/ lib/

# Check bundle size
npm run build && du -sh dist/
```

---

## **Expected Build Times**

### **Development:**
```bash
npm run dev
# Starts in ~2 seconds
# Hot reload in ~200ms
```

### **Production:**
```bash
npm install
# Completes in 30-60 seconds (first time)
# Completes in 5-10 seconds (subsequent)

npm run build
# Completes in 20-30 seconds
# Output: ~200-500 KB gzipped
```

---

## **Troubleshooting Commands**

### **Clear everything and start fresh:**
```bash
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### **Check for TypeScript errors only:**
```bash
npx tsc --noEmit
```

### **Check for outdated packages:**
```bash
npm outdated
```

### **Verify Vite config:**
```bash
cat vite.config.ts
```

---

## **✅ You're Ready to Build!**

Run these commands now:

```bash
# 1. Install dependencies
npm install

# 2. Build for production
npm run build

# 3. Test locally (optional)
npm run preview
```

If all commands complete without errors:
**🎉 Your build is successful and ready for deployment!**

Next step: **[QUICK_START.md](./QUICK_START.md)** → Deploy to production!
