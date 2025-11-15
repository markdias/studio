# Monorepo Integration Guide

Complete step-by-step guide to finish converting the Tax Calculator to a monorepo with shared logic.

## Current Status

✅ **Completed:**
- Root monorepo structure created
- `ROOT_PACKAGE.json` with workspaces configured
- `apps/web/package.json` created
- `apps/mobile/package.json` created (Expo)
- `packages/shared-tax-logic/package.json` created
- Template files for mobile app
- Documentation for all packages

⏳ **Remaining:**
- Move Next.js app to `apps/web/`
- Extract tax logic to `packages/shared-tax-logic/src/`
- Update import paths
- Install and test

---

## Phase 1: Prepare for Migration

### 1.1 Backup Current Work

```bash
# Create a backup branch
git checkout -b backup/pre-monorepo
git add .
git commit -m "Backup: pre-monorepo conversion"
```

### 1.2 Verify Directory Structure

```bash
tree -L 2 -I 'node_modules'
# Should show:
# ├── apps/
# │   ├── web/
# │   └── mobile/
# ├── packages/
# │   └── shared-tax-logic/
# ├── src/ (current - to be moved)
# └── ROOT_PACKAGE.json
```

---

## Phase 2: Move Web App Files

### 2.1 Copy Source Files

Copy the main source files:

```bash
# Copy src directory (contains all components, lib, styles)
cp -r src apps/web/

# Copy public assets
cp -r public apps/web/

# Copy configuration files
cp next.config.ts apps/web/
cp tsconfig.json apps/web/
cp tailwind.config.ts apps/web/
cp postcss.config.mjs apps/web/
cp components.json apps/web/
cp .gitignore apps/web/

# Copy environment example
cp .env.example apps/web/.env.example  (if exists)
```

### 2.2 Update Web App tsconfig.json

Edit `apps/web/tsconfig.json` to add path alias for shared package:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@tax-calc/shared": ["../../packages/shared-tax-logic/src"]
    }
  }
}
```

---

## Phase 3: Extract Shared Tax Logic

### 3.1 Copy Tax Files to Shared Package

```bash
# Create src directory
mkdir -p packages/shared-tax-logic/src

# Copy the core files
cp src/lib/tax-logic.ts packages/shared-tax-logic/src/
cp src/lib/definitions.ts packages/shared-tax-logic/src/
```

### 3.2 Create Shared Package Index

Update `packages/shared-tax-logic/src/index.ts`:

```typescript
export * from './tax-logic';
export * from './definitions';
```

### 3.3 Build Shared Package

```bash
# Install dependencies
cd packages/shared-tax-logic
yarn install

# Build TypeScript
yarn build

# Should create dist/ with .js and .d.ts files
ls -la dist/
```

---

## Phase 4: Update Import Paths

### 4.1 Update Web App Imports

In `apps/web/src/components/tax-calculator.tsx` and other files that import tax logic:

```typescript
// Change FROM:
import { calculateTakeHomePay, getTaxYearData } from "@/lib/tax-logic";
import { taxCalculatorSchema, TaxCalculatorSchema } from "@/lib/definitions";
import { ... } from "@/lib/definitions";

// Change TO:
import { calculateTakeHomePay, getTaxYearData } from "@tax-calc/shared";
import { taxCalculatorSchema, TaxCalculatorSchema } from "@tax-calc/shared";
// Keep other local imports from @/components, @/hooks, etc.
```

**Files to update:**
- `apps/web/src/components/tax-calculator.tsx` (lines with tax-logic imports)
- `apps/web/src/lib/definitions.ts` (this file stays but re-exports from shared)

### 4.2 Keep Local Definitions

The `apps/web/src/lib/definitions.ts` can re-export from shared:

```typescript
// apps/web/src/lib/definitions.ts
export * from '@tax-calc/shared';

// Add any web-specific definitions here
```

---

## Phase 5: Complete Migration

### 5.1 Replace Root package.json

```bash
# Backup current package.json
mv package.json package.json.old

# Use the new monorepo config
mv ROOT_PACKAGE.json package.json

# Remove old lock file
rm package-lock.json
```

### 5.2 Install Dependencies

```bash
# Install all workspaces
yarn install

# This should install:
# - node_modules/ (root - hoisted deps)
# - apps/web/node_modules/
# - apps/mobile/node_modules/
# - packages/shared-tax-logic/node_modules/
```

### 5.3 Verify Web App Still Works

```bash
# Start the web app
yarn dev:web

# Should start on http://localhost:3000
# All functionality should work as before
```

---

## Phase 6: Initialize Mobile App

### 6.1 Install Expo CLI

```bash
yarn global add expo-cli
# or
npm install -g expo-cli
```

### 6.2 Create Expo Project Files

```bash
cd apps/mobile

# Initialize Expo (keeps existing files)
npx create-expo-app . --template --force

# Install dependencies
yarn install
```

### 6.3 Verify Mobile App Works

```bash
# Start Expo dev server
yarn start

# Press 'i' for iOS simulator or 'a' for Android
# App should show basic Expo template
```

---

## Phase 7: Testing & Verification

### 7.1 Test Web App

```bash
# From root
yarn dev:web

# Verify:
- [ ] Tax calculations work
- [ ] All UI renders correctly
- [ ] Forms submit without errors
- [ ] No import errors in console
- [ ] Typecheck passes: yarn typecheck
```

### 7.2 Test Shared Package

```bash
# Test that shared package exports correctly
cd packages/shared-tax-logic
yarn build

# Verify dist/ files exist and have correct types
```

### 7.3 Test Mobile App Integration

```bash
# Create a simple test component in mobile app
# that imports and uses calculateTakeHomePay from @tax-calc/shared

cd apps/mobile
yarn start

# Verify shared package works in React Native context
```

---

## Phase 8: Cleanup

### 8.1 Remove Old Files from Root

These files have been moved to `apps/web/`:

```bash
# Files to delete from root (after confirming they're in apps/web/)
rm -f next.config.ts
rm -f tsconfig.json
rm -f tailwind.config.ts
rm -f postcss.config.mjs
rm -f components.json
rm -rf src/
rm -rf public/
rm -f package.json.old
rm -f ROOT_PACKAGE.json  (already replaced)
```

### 8.2 Update .gitignore

Update root `.gitignore`:

```
# Dependencies
node_modules/

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment
.env.local
.env.*.local

# Turbopack
.turbopack

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
```

---

## Phase 9: Optional - Setup CI/CD

### 9.1 GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'yarn'

      - run: yarn install
      - run: yarn typecheck
      - run: yarn workspace @tax-calc/web lint
      - run: yarn workspace @tax-calc/shared build
```

---

## Troubleshooting

### Issue: "Cannot find module '@tax-calc/shared'"

**Solution:**
```bash
# Make sure shared package is built
yarn workspace @tax-calc/shared build

# Clear node_modules and reinstall
rm -rf node_modules
yarn install
```

### Issue: TypeScript errors in web app

**Solution:**
```bash
# Rebuild shared package with types
cd packages/shared-tax-logic
rm -rf dist
yarn build

# Update path aliases in apps/web/tsconfig.json
```

### Issue: Monorepo commands not working

**Solution:**
```bash
# Check that workspaces are configured
cat package.json | grep -A5 '"workspaces"'

# Reinstall everything
rm -rf node_modules
yarn cache clean
yarn install
```

---

## Success Checklist

- [ ] Web app in `apps/web/`
- [ ] Mobile app in `apps/mobile/`
- [ ] Shared package in `packages/shared-tax-logic/`
- [ ] Root `package.json` has workspaces config
- [ ] `yarn dev:web` starts web app
- [ ] `yarn dev:mobile` starts mobile app
- [ ] Web app imports from `@tax-calc/shared`
- [ ] Mobile app imports from `@tax-calc/shared`
- [ ] `yarn typecheck` passes
- [ ] No console errors
- [ ] Tax calculations work identically in both apps

---

## Commands Reference

```bash
# Development
yarn dev:web              # Start web app
yarn dev:mobile           # Start mobile app
yarn dev                  # Start web app (default)

# Building
yarn build:web            # Build web app
yarn build:mobile         # Build mobile app
yarn build                # Build all
yarn workspace @tax-calc/shared build  # Build shared package

# Quality
yarn typecheck            # Type check all packages
yarn lint                 # Lint web app

# Package management
yarn workspace @tax-calc/web add <pkg>      # Add dependency to web
yarn workspace @tax-calc/mobile add <pkg>   # Add dependency to mobile
yarn workspace @tax-calc/shared add <pkg>   # Add dependency to shared
```

---

## Next Steps

1. Follow all phases above
2. Test thoroughly in both web and mobile
3. Commit working state: `git add . && git commit -m "feat: complete monorepo setup"`
4. Delete backup branch: `git branch -d backup/pre-monorepo`
5. Start building mobile app UI components
6. Share tax logic improvements across both platforms

Good luck! 🚀
