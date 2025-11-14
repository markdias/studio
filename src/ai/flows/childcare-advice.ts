'use server';

/**
 * @fileOverview AI-powered tool for analyzing childcare costs and salary sacrifice options,
 * particularly for individuals near the £100,000 income threshold in the UK.
 *
 * - getChildcareAdvice - A function that generates personalized financial advice.
 * - ChildcareAdviceInput - The input type for the getChildcareAdvice function.
 * - ChildcareAdviceOutput - The return type for the getChildcareAdvice function.
 */

import {ai} from '@/ai/genkit';
import { type ChildcareAdviceInput, ChildcareAdviceInputSchema, ChildcareAdviceOutputSchema } from '@/lib/definitions';

export type { ChildcareAdviceInput, ChildcareAdviceOutput } from '@/lib/definitions';


export async function getChildcareAdvice(
  input: ChildcareAdviceInput
): Promise<import('@/lib/definitions').ChildcareAdviceOutput> {
  return childcareAdviceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'childcareAdvicePrompt',
  input: {schema: ChildcareAdviceInputSchema},
  output: {schema: ChildcareAdviceOutputSchema},
  prompt: `You are an expert UK financial advisor. Your task is to analyze a user's income, pension, and childcare costs to provide actionable advice, especially concerning the £100,000 personal allowance taper.

Here is the user's data:
- Annual Gross Income: £{{annualGrossIncome}}
- Pension Contribution: {{pensionContributionPercentage}}%
- Number of Children: {{numberOfChildren}}
- Days per week in childcare (per child): {{daysPerWeekInChildcare}}
- Daily childcare rate (per child): £{{dailyChildcareRate}}

Perform the following steps and generate a concise analysis. Use Markdown for formatting, including headings and bullet points.

1.  **Calculate Childcare Costs:**
    - Calculate the weekly and annual childcare cost for all children. Assume 52 weeks in a year.

2.  **Analyze Adjusted Net Income:**
    - Calculate the user's 'Adjusted Net Income'. This is Gross Income minus pension contributions.
    - Explain the £100,000 personal allowance taper: for every £2 of income over £100,000, the personal allowance is reduced by £1. Also mention that eligibility for tax-free childcare is lost if adjusted net income is over £100,000.
    - State the user's current adjusted net income and the impact on their personal allowance.

3.  **Provide Optimization Strategies:**
    - If the user's adjusted net income is over £100,000, calculate the exact amount they need to reduce their income by to get back to £100,000.
    - Suggest increasing their pension contribution as a primary strategy. Calculate the new total pension contribution amount and the new percentage required to bring their adjusted net income down to £100,000.
    - Briefly mention salary sacrifice schemes as another effective method if available through their employer.

4.  **Summarize and Conclude:**
    - Provide a clear, simple summary of the situation and the recommended actions.
    - Keep the tone helpful and easy to understand.

Structure your output under the following headings:
- Childcare Cost Summary
- Income & Tax Allowance Analysis
- Optimization Strategies
- Summary
`,
});

const childcareAdviceFlow = ai.defineFlow(
  {
    name: 'childcareAdviceFlow',
    inputSchema: ChildcareAdviceInputSchema,
    outputSchema: ChildcareAdviceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
