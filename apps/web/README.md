# Tax Calculator Web App

Next.js web application for UK tax calculations with AI-powered insights.

## Features

- ✅ Real-time tax calculations
- ✅ Support for all UK regions
- ✅ AI tax-saving tips (powered by Google Genkit)
- ✅ Childcare cost analysis
- ✅ Student loan repayment planning
- ✅ Pension contribution comparison
- ✅ Export/import calculator data
- ✅ Monthly and annual breakdown

## Tech Stack

- **Framework**: Next.js 15 with Turbopack
- **UI**: React 18 + Radix UI
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **AI**: Google Genkit
- **Database**: Firebase (optional)

## Getting Started

### Prerequisites

- Node.js >= 18
- yarn or npm

### Installation

```bash
# From the monorepo root
cd apps/web
yarn install
```

### Development

```bash
# Start dev server with Turbopack
yarn dev

# Open http://localhost:3000
```

### Build

```bash
# Production build
yarn build

# Start production server
yarn start
```

## Project Structure

```
apps/web/src/
├── app/                  # Next.js app directory
│   ├── actions.ts       # Server actions (AI endpoints)
│   ├── page.tsx         # Home page
│   └── layout.tsx       # Root layout
├── components/
│   ├── tax-calculator.tsx   # Main calculator component
│   ├── ui/              # Radix UI components
│   └── ...
├── lib/
│   ├── tax-logic.ts     # Tax calculations (moved to @tax-calc/shared)
│   ├── definitions.ts   # Types and schemas
│   └── ...
└── styles/
    └── globals.css      # Global styles
```

## Shared Code

This app imports the core tax calculation logic from **@tax-calc/shared**:

```typescript
import { calculateTakeHomePay, getTaxYearData } from '@tax-calc/shared';
```

This ensures the web and mobile apps use identical tax calculations.

## Environment Variables

Create a `.env.local` file:

```env
# Google Genkit AI
NEXT_PUBLIC_GENKIT_PROJECT_ID=your_project_id
GENKIT_GOOGLE_API_KEY=your_api_key

# Firebase (optional)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
```

## Key Components

### TaxCalculator Component

Main form and results display. Features:
- Salary and bonus input
- Pension configuration
- Student loan plans
- Pay rise scenarios
- Childcare calculator

### AI Integration

Google Genkit powers:
- Tax-saving tips
- Childcare benefit advice
- Financial planning chat
- Salary sacrifice analysis

## API Endpoints

Server actions (in `app/actions.ts`):

```typescript
// Get tax-saving tips
generateTaxSavingTipsAction(input: TaxSavingTipsInput)

// Analyze childcare benefits
generateChildcareAdviceAction(input: ChildcareAdviceInput)

// Financial chat
financialChatAction(input: FinancialChatInput)
```

## Data Export/Import

Users can:
- **Export**: Download their calculator data as JSON
- **Import**: Load saved calculations

Useful for:
- Backing up calculations
- Sharing with accountants
- Comparing scenarios

## Testing

```bash
# Run type checking
yarn typecheck

# Run linting
yarn lint
```

## Performance

- **Turbopack**: 5x faster builds than Webpack
- **Suspense**: Server components for faster page loads
- **Memoization**: React.useMemo for expensive calculations
- **Charts**: Lazy-loaded Recharts

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support

## Contributing

When updating tax logic:
1. Update `packages/shared-tax-logic`
2. Run `yarn workspace @tax-calc/shared build`
3. Changes appear automatically in this app

## Deployment

Optimized for Vercel:

```bash
# Deploy to Vercel
vercel deploy
```

Or any Node.js hosting (Railway, Render, etc.).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Google Genkit](https://firebase.google.com/docs/genkit)
