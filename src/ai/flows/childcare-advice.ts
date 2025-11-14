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

Perform the following steps and generate a concise analysis for each field in the output schema.

1.  **Calculate Childcare Costs:**
    - Calculate the weekly and annual childcare cost for all children. Assume 52 weeks in a year.
    - Populate the \`costSummary\` field with a sentence summarizing these costs.

2.  **Analyze Adjusted Net Income:**
    - Calculate the user's 'Adjusted Net Income'. This is Gross Income minus pension contributions.
    - Explain the £100,000 personal allowance taper: for every £2 of income over £100,000, the personal allowance is reduced by £1. Also mention that eligibility for tax-free childcare is lost if adjusted net income is over £100,000.
    - State the user's current adjusted net income and the impact on their personal allowance.
    - Populate the \`incomeAnalysis\` field with this information.

3.  **Provide Optimization Strategies:**
    - If the user's adjusted net income is over £100,000, calculate the exact amount they need to reduce their income by to get back to £100,000.
    - Suggest increasing their pension contribution as a primary strategy. Calculate the new total pension contribution amount and the new percentage required to bring their adjusted net income down to £100,000. Round the final percentage to the nearest whole number.
    - Populate the \`optimizationStrategies\` field with this advice.
    - **Crucially, populate the \`suggestedPensionContributionPercentage\` field with the calculated new percentage if an adjustment is needed. If no adjustment is needed, do not include this field.**

4.  **Summarize and Conclude:**
    - Provide a clear, simple summary of the situation and the recommended actions.
    - Populate the \`summary\` field.
    
Keep the tone helpful and easy to understand. Do not use Markdown or complex formatting in the output strings.
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
