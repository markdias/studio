'use server';

/**
 * @fileOverview AI-powered tool offering suggestions for reducing taxable income.
 *
 * - getTaxSavingTips - A function that handles the tax saving tips generation.
 * - TaxSavingTipsInput - The input type for the getTaxSavingTips function.
 * - TaxSavingTipsOutput - The return type for the getTaxSavingTips function.
 */

import {ai} from '@/ai/genkit';
import { type TaxSavingTipsInput, TaxSavingTipsInputSchema, TaxSavingTipsOutputSchema } from '@/lib/definitions';

export type { TaxSavingTipsInput, TaxSavingTipsOutput } from '@/lib/definitions';


export async function getTaxSavingTips(
  input: TaxSavingTipsInput
): Promise<import('@/lib/definitions').TaxSavingTipsOutput> {
  return taxSavingTipsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'taxSavingTipsPrompt',
  input: {schema: TaxSavingTipsInputSchema},
  output: {schema: TaxSavingTipsOutputSchema},
  prompt: `You are a financial advisor specializing in UK tax optimization.

  Based on the user's income details, provide personalized strategies for reducing their taxable income. Consider optimizing pension contributions, utilizing salary sacrifice schemes, and any other relevant tax-efficient strategies applicable in their region.

  Salary: £{{salary}}
  Bonus: £{{bonus}}
  Pension Contributions: £{{pensionContributions}}
  Other Taxable Benefits: £{{otherTaxableBenefits}}
  Region: {{region}}

  Provide concise and actionable advice.
  `,
});

const taxSavingTipsFlow = ai.defineFlow(
  {
    name: 'taxSavingTipsFlow',
    inputSchema: TaxSavingTipsInputSchema,
    outputSchema: TaxSavingTipsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
