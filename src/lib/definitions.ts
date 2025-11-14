import { z } from "zod";

export const regions = ["England", "Scotland", "Wales", "Northern Ireland"] as const;
export type Region = (typeof regions)[number];

export const months = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
] as const;
export type Month = (typeof months)[number];

export const taxYears = ["2023/24", "2024/25", "2025/26"] as const;
export type TaxYear = (typeof taxYears)[number];


export const taxCalculatorSchema = z.object({
  taxYear: z.enum(taxYears).default("2024/25"),
  salary: z.coerce.number().min(0, "Salary must be a positive number."),
  bonus: z.coerce.number().min(0, "Bonus must be a positive number.").optional().default(0),
  taxableBenefits: z.coerce.number().min(0, "Taxable benefits must be a positive number.").optional().default(0),
  pensionContribution: z.coerce.number().min(0, "Pension contribution cannot be negative.").max(100, "Pension contribution cannot exceed 100%.").optional().default(0),
  isBonusPensionable: z.boolean().default(false),
  pensionableBonusPercentage: z.coerce.number().min(0).max(100).default(100),
  region: z.enum(regions).default("England"),
  bonusMonth: z.enum(months).default("April"),
  taxCode: z.string().default("1257L").describe("The user's tax code, e.g., 1257L"),
  
  // Pay rise fields
  hasPayRise: z.boolean().default(false),
  newSalary: z.coerce.number().min(0).optional(),
  payRiseMonth: z.enum(months).default("April"),

  // Childcare fields
  numberOfChildren: z.coerce.number().min(0).optional().default(0),
  daysPerWeekInChildcare: z.coerce.number().min(0).max(7).optional().default(0),
  dailyChildcareRate: z.coerce.number().min(0).optional().default(0),

}).refine(data => !data.hasPayRise || (data.newSalary !== undefined && data.newSalary > data.salary), {
  message: "New salary must be greater than the current salary.",
  path: ["newSalary"],
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
  annualTaxableIncome: number;
  annualTakeHome: number;
  annualTax: number;
  annualNic: number;
  annualPension: number;
  personalAllowance: number;
  effectiveTaxRate: number;
  breakdown: { name: string; value: number; fill: string }[];
  monthlyBreakdown: MonthlyResult[];
}

// AI Flow Schemas

export const TaxSavingTipsInputSchema = z.object({
  salary: z.number().describe('Annual salary before deductions.'),
  bonus: z.number().optional().describe('Annual bonus amount, if applicable.'),
  pensionContributions: z
    .number()
    .optional()
    .describe('Annual pension contributions.'),
  otherTaxableBenefits: z
    .number()
    .optional()
    .describe('Value of any other taxable benefits received.'),
  region: z
    .enum(['England', 'Scotland', 'Wales', 'Northern Ireland'])
    .describe('The region of the UK the user resides in.'),
});
export type TaxSavingTipsInput = z.infer<typeof TaxSavingTipsInputSchema>;

export const TaxSavingTipsOutputSchema = z.object({
  tips: z.string().describe('Personalized tax saving tips.'),
});
export type TaxSavingTipsOutput = z.infer<typeof TaxSavingTipsOutputSchema>;


export const ChildcareAdviceInputSchema = z.object({
  annualGrossIncome: z.number().describe('The user\'s total annual gross income, including salary and any bonuses.'),
  pensionContributionPercentage: z.number().describe('The percentage of income the user contributes to their pension.'),
  numberOfChildren: z.number().describe('The number of children the user has in childcare.'),
  daysPerWeekInChildcare: z.number().describe('The number of days per week a single child attends childcare.'),
  dailyChildcareRate: z.number().describe('The daily cost of childcare for a single child.'),
});
export type ChildcareAdviceInput = z.infer<typeof ChildcareAdviceInputSchema>;

export const ChildcareAdviceOutputSchema = z.object({
  analysis: z.string().describe('A detailed analysis of the user\'s financial situation, including calculated childcare costs, the impact of the personal allowance taper, and suggested strategies like increasing pension contributions or using salary sacrifice to optimize their finances.'),
});
export type ChildcareAdviceOutput = z.infer<typeof ChildcareAdviceOutputSchema>;
