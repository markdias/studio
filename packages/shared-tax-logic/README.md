# Shared Tax Logic Package

Core UK tax calculation logic shared between web and mobile apps.

## Overview

This package contains all the tax calculation algorithms for the UK tax system, including:

- **Income Tax**: Progressive tax bands for England, Scotland, Wales, Northern Ireland
- **National Insurance**: Employee contributions (2-tier system)
- **Personal Allowance**: Including tapering above £100,000
- **Student Loan**: Support for Plans 1, 2, 4, 5, and Postgraduate
- **Pension**: Salary Sacrifice and Standard (Relief at Source) schemes
- **Taxable Benefits**: Company cars, medical insurance, etc.
- **Tax Codes**: Parsing and validation (L-codes, K-codes, special codes)

## Exports

### Functions

```typescript
// Main calculation function
export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults

// Helpers
export function getTaxYearData(year: TaxYear): TaxYearData
export function parseTaxCode(taxCode: string, defaultAllowance: number): number
export function getRegionFromTaxCode(taxCode: string): Region | null
```

### Types

```typescript
export type TaxYear = '2023/24' | '2024/25' | '2025/26'
export type Region = 'England' | 'Scotland' | 'Wales' | 'Northern Ireland'
export type PensionScheme = 'Salary Sacrifice' | 'Standard (Relief at Source)'

export interface TaxCalculatorSchema { ... }
export interface CalculationResults { ... }
export interface MonthlyResult { ... }
```

## Usage

### Web App (Next.js)

```typescript
import { calculateTakeHomePay, TaxCalculatorSchema } from '@tax-calc/shared';

const input: TaxCalculatorSchema = {
  taxYear: '2024/25',
  salary: 50000,
  region: 'England',
  // ... other fields
};

const results = calculateTakeHomePay(input);
console.log(`Take home pay: £${results.annualTakeHome}`);
```

### Mobile App (React Native)

```typescript
import { calculateTakeHomePay } from '@tax-calc/shared';

const results = calculateTakeHomePay(formData);
```

## Tax Rules Implemented

### Income Tax (2024/25)

**England, Wales, Northern Ireland:**
- 20% up to £37,700 (basic rate)
- 40% £37,701 - £125,140 (higher rate)
- 45% over £125,140 (additional rate)

**Scotland:**
- 19% up to £2,306 (starter)
- 20% £2,307 - £13,991 (basic)
- 21% £13,992 - £31,092 (intermediate)
- 42% £31,093 - £62,430 (higher)
- 45% £62,431 - £125,140 (advanced)
- 47% over £125,140 (top)

### Personal Allowance

- Default: £12,570
- Blind Person's Allowance: £3,160
- Tapering: Reduced by £1 for every £2 over £100,000
- Minimum: £0 (reduced to zero at £125,140 income)

### National Insurance (2024/25)

- 8% on earnings from £12,570 to £50,270
- 2% on earnings over £50,270

### Pension Schemes

**Salary Sacrifice:**
- Reduces gross income for both tax AND National Insurance
- Maximum tax relief: 44% (45% + 2% NI - 3% pension contribution)

**Standard (Relief at Source):**
- Only reduces income tax (not NI)
- Maximum tax relief: 45%
- Eligible contributions for relief: up to £60,000/year

## Data Sources

Tax rates and thresholds are based on:
- HMRC official rates for tax years 2023/24, 2024/25, 2025/26
- Student Loan Company thresholds
- National Insurance contributions

## Testing

When adding new tax years or updating rules:

1. Update `taxYearData` in `src/tax-logic.ts`
2. Add test cases for:
   - Edge cases (tapering, thresholds)
   - Different regions
   - Various pension scenarios
   - Student loan plans

## Known Limitations

⚠️ Monthly breakdown uses pro-rata averaging, not HMRC cumulative YTD basis
- Acceptable for salary planning
- Not suitable for final tax returns
- Mid-year bonuses/pay rises may show inaccurate monthly distribution

## Future Enhancements

- [ ] Capital Gains Tax support
- [ ] Dividend tax bands
- [ ] Marriage Allowance transfers
- [ ] ISA tax relief
- [ ] Self-employment income
- [ ] Cumulative YTD calculations

## Building

```bash
yarn build
```

Output goes to `dist/` with TypeScript definitions.

## License

Part of the Tax Calculator monorepo project.
