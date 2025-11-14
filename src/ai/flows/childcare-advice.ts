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
  prompt: `You are an expert UK financial advisor. Your task is to analyze a user's income, pension, and childcare costs to provide actionable advice on the £100,000 income threshold.

Here is the user's data:
- Annual Gross Income: £{{annualGrossIncome}}
- Annual Taxable Benefits: £{{taxableBenefits}}
- Pension Contribution: {{pensionContributionPercentage}}%
- Number of Children: {{numberOfChildren}}
- Days per week in childcare (per child): {{daysPerWeekInChildcare}}
- Daily childcare rate (per child): £{{dailyChildcareRate}}
- Tax Year: {{taxYear}}

**Your Task:**
Perform a detailed analysis and generate a concise summary for each field in the output schema.

1.  **Childcare Cost Summary:**
    - Calculate the total weekly and annual childcare cost for all children. Assume 52 weeks in a year.
    - Populate the \`costSummary\` field.

2.  **Adjusted Net Income Analysis:**
    - Calculate the user's 'Adjusted Net Income' which is (Gross Income + Taxable Benefits - Pension Contributions).
    - Explain the two main consequences of having an adjusted net income over £100,000:
        a) The personal allowance of £12,570 is tapered away by £1 for every £2 of income over £100,000.
        b) Eligibility for Tax-Free Childcare (worth up to £2,000 per child per year) and potentially 15/30 hours of free childcare is lost.
    - State the user's current adjusted net income and its impact.
    - Populate the \`incomeAnalysis\` field.

3.  **Optimization & Cost-Benefit Analysis:**
    - **If the user's adjusted net income is NOT over £100,000:** State that no adjustments are needed and that this is a great position to be in. Populate \`optimizationStrategies\` with this message.
    - **If the user's adjusted net income IS over £100,000:**
        a. **Calculate the Sacrifice:** Determine the exact amount they need to reduce their income by to get back to £100,000.
        b. **Suggest Pension Increase:** Propose increasing their pension contribution as the primary method. The pension contribution is based on the gross income only (not including taxable benefits). Calculate the new total annual pension contribution needed. Then, calculate the new percentage of gross income required to meet this contribution. Round the final percentage to the nearest whole number.
        c. **Calculate Tax Saved:** Calculate the income tax saved by regaining the full £12,570 personal allowance. Assume a 40% tax rate on this recovered allowance for simplicity (£12,570 * 0.40 = £5,028).
        d. **Calculate Childcare Savings:** State the value of regaining Tax-Free Childcare, which is £2,000 per child, up to a maximum of 4 children.
        e. **Summarize the Trade-Off:** Explain that while increasing their pension will reduce their monthly take-home pay, the combined annual savings from tax and childcare are substantial. Calculate the total annual benefit (Tax Saved + Childcare Savings).
        f. **Populate \`optimizationStrategies\`:** Combine all these points into a clear, compelling narrative.
        g. **Populate \`suggestedPensionContributionPercentage\`:** Fill this with the newly calculated pension percentage.

4.  **Final Summary:**
    - Provide a very clear, simple summary of the key takeaway and recommended action.
    - Populate the \`summary\` field.

Keep the tone helpful and easy to understand. Do not use complex financial jargon.
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
