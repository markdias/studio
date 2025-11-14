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
  bonusPensionContribution: z.coerce.number().min(0, "Bonus contribution cannot be negative.").max(100, "Bonus contribution cannot be over 100%").optional().default(0),
  region: z.enum(regions).default("England"),
  bonusMonth: z.enum(months).default("April"),
  taxCode: z.string().default("1257L").describe("The user's tax code, e.g., 1257L"),
  
  // Pay rise fields
  hasPayRise: z.boolean().default(false),
  newSalary: z.coerce.number().min(0).optional(),
  payRiseMonth: z.enum(months).default("April"),

  // Childcare fields toggle
  showChildcareCalculator: z.boolean().optional().default(false),
  
  // Childcare fields
  numberOfChildren: z.coerce.number().min(0).optional().default(0),
  daysPerWeekInChildcare: z.coerce.number().min(0).max(7).optional().default(0),
  dailyChildcareRate: z.coerce.number().min(0).optional().default(0),
  registeredChildcareProvider: z.boolean().optional().default(false),
  childDisabled: z.boolean().optional().default(false),

  // Partner & Benefits
  partnerIncome: z.coerce.number().min(0, "Partner income must be a positive number.").optional().default(0),
  claimingUniversalCredit: z.boolean().optional().default(false),
  claimingTaxFreeChildcare: z.boolean().optional().default(false),

  // Pension Comparison
  enablePensionComparison: z.boolean().optional().default(false),
  adjustedPensionContribution: z.coerce.number().min(0, "Pension contribution cannot be negative.").max(100, "Pension contribution cannot exceed 100%.").optional().default(10),


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
  annualGrossIncome: z.number().describe("The user's total annual gross income from salary and any bonuses."),
  taxableBenefits: z.number().describe("The annual value of any taxable benefits (e.g. company car, private medical)."),
  pensionContributionPercentage: z.number().describe('The percentage of income the user contributes to their pension.'),
  numberOfChildren: z.number().describe('The number of children the user has in childcare.'),
  daysPerWeekInChildcare: z.number().describe('The number of days per week a single child attends childcare.'),
  dailyChildcareRate: z.number().describe('The daily cost of childcare for a single child.'),
  taxYear: z.string().describe('The selected tax year, e.g., 2024/25'),
});
export type ChildcareAdviceInput = z.infer<typeof ChildcareAdviceInputSchema>;

export const ChildcareAdviceOutputSchema = z.object({
  costSummary: z.string().describe('A summary of the calculated weekly and annual childcare costs.'),
  incomeAnalysis: z.string().describe("An analysis of the user's adjusted net income and the impact on their personal tax allowance."),
  optimizationStrategies: z.string().describe('Suggested strategies to optimize finances, such as increasing pension contributions.'),
  summary: z.string().describe('A final, clear summary of the situation and recommended actions.'),
  suggestedPensionContributionPercentage: z.number().optional().describe('If applicable, the suggested new pension contribution percentage to bring adjusted net income to £100,000.'),
});
export type ChildcareAdviceOutput = z.infer<typeof ChildcareAdviceOutputSchema>;

// Chat Schemas
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

const FinancialContextSchema = z.object({
  taxYear: z.string().optional(),
  salary: z.number().optional(),
  bonus: z.number().optional(),
  pensionContribution: z.number().optional(),
  region: z.string().optional(),
  taxCode: z.string().optional(),
  taxableBenefits: z.number().optional(),
  annualGrossIncome: z.number().optional(),
  annualTaxableIncome: z.number().optional(),
  annualTakeHome: z.number().optional(),
  annualTax: z.number().optional(),
  annualNic: z.number().optional(),
  annualPension: z.number().optional(),
  personalAllowance: z.number().optional(),
  // For childcare chat
  partnerIncome: z.number().optional(),
  registeredChildcareProvider: z.boolean().optional(),
  childDisabled: z.boolean().optional(),
  claimingUniversalCredit: z.boolean().optional(),
  claimingTaxFreeChildcare: z.boolean().optional(),
});

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

export const FinancialChatInputSchema = z.object({
  financialContext: FinancialContextSchema.describe("The user's current financial data from the calculator."),
  history: z.array(ChatMessageSchema).describe('The history of the conversation so far.'),
  question: z.string().describe('The latest question from the user.'),
});
export type FinancialChatInput = z.infer<typeof FinancialChatInputSchema>;

export const FinancialChatOutputSchema = z.object({
  answer: z.string().describe("The AI's answer to the user's question."),
});
export type FinancialChatOutput = z.infer<typeof FinancialChatOutputSchema>;


// Tax Childcare Flow
export const TaxChildcareChatInputSchema = z.object({
  financialContext: FinancialContextSchema.describe("The user's current financial data from the calculator."),
  history: z.array(ChatMessageSchema).describe('The history of the conversation so far.'),
  question: z.string().describe('The latest question or answer from the user.'),
});
export type TaxChildcareChatInput = z.infer<typeof TaxChildcareChatInputSchema>;

export const TaxChildcareChatOutputSchema = z.object({
  answer: z.string().describe("The AI's next question or final JSON object."),
});
export type TaxChildcareChatOutput = z.infer<typeof TaxChildcareChatOutputSchema>;

    
    