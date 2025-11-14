import { z } from "zod";

export const regions = ["England", "Scotland", "Wales", "Northern Ireland"] as const;
export type Region = (typeof regions)[number];

export const months = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
] as const;
export type Month = (typeof months)[number];


export const taxCalculatorSchema = z.object({
  salary: z.coerce.number().min(0, "Salary must be a positive number."),
  bonus: z.coerce.number().min(0, "Bonus must be a positive number.").optional().default(0),
  pensionContribution: z.coerce.number().min(0, "Pension contribution cannot be negative.").max(100, "Pension contribution cannot exceed 100%.").optional().default(0),
  region: z.enum(regions).default("England"),
  bonusMonth: z.enum(months).default("April"),
  taxCode: z.string().default("1257L").describe("The user's tax code, e.g., 1257L"),
});

export type TaxCalculatorSchema = z.infer<typeof taxCalculatorSchema>;

export interface MonthlyResult {
  month: Month;
  gross: number;
  tax: number;
  nic: number;
  pension: number;
  takeHome: number;
}


export interface CalculationResults {
  grossAnnualIncome: number;
  grossMonthlyIncome: number;
  annualTakeHome: number;
  monthlyTakeHome: number;
  annualTax: number;
  monthlyTax: number;
  annualNic: number;
  monthlyNic: number;
  annualPension: number;
  monthlyPension: number;
  effectiveTaxRate: number;
  breakdown: { name: string; value: number; fill: string }[];
  monthlyBreakdown: MonthlyResult[];
}
