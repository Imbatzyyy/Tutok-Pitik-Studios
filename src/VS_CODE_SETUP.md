# VS Code Setup Guide

## Opening the Project

1. Open VS Code
2. File → Open Folder
3. Select `tutok-pitik-studios` folder
4. Wait for VS Code to load TypeScript

## Expected VS Code View

### ✅ What You Should See

**No Red Errors:**
- All `.tsx` and `.ts` files should have NO red squiggly lines
- Problems panel should show 0 errors
- Terminal should show no build errors

**Clean File Structure:**
```
tutok-pitik-studios/
├── 📁 components/
├── 📁 database/
├── 📁 lib/
├── 📁 netlify/
├── 📁 public/
├── 📁 scripts/
├── 📁 src/
├── 📁 styles/
├── 📄 App.tsx
├── 📄 index.html
├── 📄 package.json
├── 📄 tsconfig.json
└── ... (documentation files)
```

## Recommended VS Code Extensions

### Essential
1. **ES7+ React/Redux/React-Native snippets**
   - ID: `dsznajder.es7-react-js-snippets`
   
2. **Tailwind CSS IntelliSense**
   - ID: `bradlc.vscode-tailwindcss`
   
3. **TypeScript Vue Plugin (Volar)**
   - ID: `Vue.vscode-typescript-vue-plugin`
   
4. **ESLint**
   - ID: `dbaeumer.vscode-eslint`

### Helpful
5. **Prettier - Code formatter**
   - ID: `esbenp.prettier-vscode`
   
6. **Auto Rename Tag**
   - ID: `formulahendry.auto-rename-tag`
   
7. **Path Intellisense**
   - ID: `christian-kohler.path-intellisense`

## VS Code Settings

### Recommended settings.json

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTypescript": true,
  "files.exclude": {
    "node_modules": true,
    "dist": true
  },
  "search.exclude": {
    "node_modules": true,
    "dist": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["className\\s*=\\s*['\"]([^'\"]*)['\"]"]
  ]
}
```

## Verifying TypeScript is Working

### 1. Check TypeScript Version

**Bottom right of VS Code:**
- Should show: `TypeScript 5.0.2` (or similar)
- Click it and select "Use Workspace Version"

**Or in terminal:**
```bash
npx tsc --version
```

### 2. Test Intellisense

Open any `.tsx` file and type:
```typescript
const user: User
```

You should see:
- Auto-import suggestion for `User` type
- Import automatically added: `import type { User } from './lib/types';`

### 3. Check Problems Panel

**View → Problems (or Cmd/Ctrl + Shift + M)**

Should show:
```
No problems detected in this workspace
```

## Common VS Code Issues

### Issue 1: Red Errors Everywhere

**Solution:**
1. Close VS Code completely
2. Delete `node_modules` folder
3. Run `npm install`
4. Reopen VS Code
5. Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

### Issue 2: Imports Not Recognized

**Solution:**
1. Check `tsconfig.json` exists
2. Verify `include` array has correct paths
3. Reload window: Cmd/Ctrl + Shift + P → "Reload Window"

### Issue 3: Tailwind Classes Not Working

**Solution:**
1. Install Tailwind CSS IntelliSense extension
2. Add settings to `.vscode/settings.json`
3. Reload window

### Issue 4: Cannot Find Module 'figma:asset'

**Solution:**
This is expected in VS Code. The `figma:asset` scheme is handled by Vite at build time. These errors can be ignored or you can add a type declaration.

Create `/types/figma-asset.d.ts`:
```typescript
declare module 'figma:asset/*' {
  const value: string;
  export default value;
}
```

## File Organization Tips

### Grouping Files

Right-click explorer → "Sort By":
- **Type** - Groups by extension
- **Name** - Alphabetical
- **Modified** - Recent first

### Collapsing Folders

Click folder icons to collapse:
- Collapse `node_modules`
- Collapse `dist` (if present)
- Keep `components` expanded

## Terminal in VS Code

### Open Terminal
- View → Terminal
- Or: Ctrl + ` (backtick)

### Split Terminal
- Click `+` icon for new terminal
- Click split icon for side-by-side

### Recommended Setup
1. **Terminal 1**: `npm run dev` (development server)
2. **Terminal 2**: For git commands, npm install, etc.

## Git Integration

### Source Control Panel
- View → Source Control
- Or: Ctrl/Cmd + Shift + G

### Features
- See file changes
- Stage files
- Commit changes
- Push to GitHub

### .gitignore Configured
Already ignores:
- `node_modules/`
- `dist/`
- `.env`
- `*.local`

## Debugging in VS Code

### Create launch.json

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

### Usage
1. Set breakpoints in code (click left margin)
2. Press F5 to start debugging
3. Chrome opens with debugger attached

## Keyboard Shortcuts

### Essential
- `Cmd/Ctrl + P` - Quick file open
- `Cmd/Ctrl + Shift + P` - Command palette
- `Cmd/Ctrl + B` - Toggle sidebar
- `Cmd/Ctrl + J` - Toggle terminal
- `Cmd/Ctrl + /` - Comment line
- `Alt/Option + Shift + F` - Format document
- `F2` - Rename symbol
- `Cmd/Ctrl + Click` - Go to definition

### Multi-Cursor
- `Alt/Option + Click` - Add cursor
- `Cmd/Ctrl + D` - Select next occurrence
- `Cmd/Ctrl + Shift + L` - Select all occurrences

## Workspace Recommendations

### extensions.json

Create `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dsznajder.es7-react-js-snippets",
    "bradlc.vscode-tailwindcss",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode"
  ]
}
```

When teammates open the project, VS Code will suggest installing these extensions.

## Final Checklist

### Before Taking Screenshot

- [ ] All files saved (no dots in file tabs)
- [ ] No red errors in any files
- [ ] Problems panel shows 0 errors
- [ ] Terminal shows successful `npm run dev`
- [ ] Explorer shows clean file structure
- [ ] TypeScript version shown in status bar
- [ ] Git status clean (if committed)

### Clean Screenshot Setup

1. **Hide unnecessary panels:**
   - Collapse `node_modules` folder
   - Close extra tabs
   - Clear terminal output (type `clear`)

2. **Show important files:**
   - Open `App.tsx`
   - Open a component file (e.g., `Navigation.tsx`)
   - Show file tree on left

3. **Verify no errors:**
   - Check status bar (bottom)
   - Check Problems panel
   - Check terminal output

## Example Clean VS Code View

```
📁 EXPLORER                         App.tsx
  📂 tutok-pitik-studios            ┌─────────────────────────┐
    📂 components                   │ import { useState }     │
    📂 lib                          │ from 'react';          │
    📂 public                       │                         │
    📂 src                          │ export default         │
    📂 styles                       │ function App() {       │
    📄 App.tsx                      │   return (              │
    📄 package.json                 │     <div>              │
    📄 tsconfig.json                │       ...              │
                                    │     </div>             │
                                    │   );                   │
                                    │ }                      │
                                    └─────────────────────────┘

🔍 No Problems                      ⚡ TypeScript 5.0.2
```

---

You're all set! Your VS Code should now be perfectly configured with zero errors.
