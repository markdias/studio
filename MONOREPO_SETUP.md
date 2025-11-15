# Tax Calculator Monorepo Setup

This is a monorepo containing both web and mobile versions of the UK Tax Calculator, sharing core tax logic between them.

## Structure

```
studio/
├── apps/
│   ├── web/              # Next.js web application
│   └── mobile/           # Expo React Native mobile app
├── packages/
│   └── shared-tax-logic/ # Shared tax calculation logic
└── ROOT_PACKAGE.json     # Monorepo root configuration
```

## Migration Steps

This setup has been created, but the migration is **partially complete**. Here's what still needs to be done:

### Step 1: Copy Web App Files to `apps/web/`

The Next.js web app needs to be moved to `apps/web/`. Copy these files from the root:

```bash
# Files to copy to apps/web/:
cp -r src/ apps/web/
cp -r public/ apps/web/
cp -r .next/ apps/web/  (if exists)
cp next.config.ts apps/web/
cp tsconfig.json apps/web/
cp tailwind.config.ts apps/web/
cp postcss.config.mjs apps/web/
cp components.json apps/web/
cp .env.local apps/web/ (if exists)
```

### Step 2: Extract Shared Tax Logic to `packages/shared-tax-logic/`

Copy the tax calculation files to the shared package:

```bash
# Copy to packages/shared-tax-logic/src/:
cp src/lib/tax-logic.ts packages/shared-tax-logic/src/
cp src/lib/definitions.ts packages/shared-tax-logic/src/
```

### Step 3: Update Imports in Web App

In `apps/web/src/lib/tax-calculator.tsx` and other files, update imports:

```typescript
// Change from:
import { calculateTakeHomePay, getTaxYearData } from "@/lib/tax-logic";
import { taxCalculatorSchema, TaxCalculatorSchema } from "@/lib/definitions";

// To:
import { calculateTakeHomePay, getTaxYearData } from "@tax-calc/shared";
import { taxCalculatorSchema, TaxCalculatorSchema } from "@tax-calc/shared";
```

### Step 4: Replace Root package.json

Once migration is complete:

```bash
rm package.json
mv ROOT_PACKAGE.json package.json
yarn install  # Install with monorepo workspaces
```

### Step 5: Create Mobile App

Initialize Expo in `apps/mobile/`:

```bash
cd apps/mobile
npx create-expo-app . --template
# Then manually customize app.json, index.js, App.tsx
```

## Running the Apps

After full migration:

```bash
# Run web app
yarn dev:web

# Run mobile app (Expo)
yarn dev:mobile

# Build all
yarn build
```

## Shared Package Development

To develop the shared tax logic:

```bash
# Build shared package after changes
yarn workspace @tax-calc/shared build

# The changes are automatically picked up by web and mobile apps
```

## Important Notes

- ✅ Package structure is set up
- ⏳ Actual file migration needs to be completed manually (to preserve history)
- ⏳ Import paths need to be updated
- ⏳ Mobile app UI needs to be created

## Next Steps

1. Complete the file migration using the steps above
2. Test that the web app still works after migration
3. Build the mobile app UI using React Native components
4. Update any AI-related dependencies for mobile (if needed)

## Monorepo Benefits

- **Shared Logic**: Both apps use identical tax calculations
- **Single Repo**: Easier to manage features across platforms
- **Consistent Updates**: When tax rules change, update once
- **Type Safety**: Shared TypeScript definitions across web and mobile
