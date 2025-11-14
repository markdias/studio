'use server';

/**
 * @fileOverview AI-powered tool offering suggestions for reducing taxable income.
 *
 * - getTaxSavingTips - A function that handles the tax saving tips generation.
 * - TaxSavingTipsInput - The input type for the getTaxSavingTips function.
 * - TaxSavingTipsOutput - The return type for the getTaxSavingTips function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TaxSavingTipsInputSchema = z.object({
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

const TaxSavingTipsOutputSchema = z.object({
  tips: z.string().describe('Personalized tax saving tips.'),
});
export type TaxSavingTipsOutput = z.infer<typeof TaxSavingTipsOutputSchema>;

export async function getTaxSavingTips(
  input: TaxSavingTipsInput
): Promise<TaxSavingTipsOutput> {
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
