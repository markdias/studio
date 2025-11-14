'use server';
/**
 * @fileOverview A conversational AI flow for answering financial questions.
 *
 * - financialChat - A function that handles the conversational chat.
 */

import {ai} from '@/ai/genkit';
import { FinancialChatInputSchema, FinancialChatOutputSchema, type FinancialChatInput, type FinancialChatOutput } from '@/lib/definitions';

export type { FinancialChatInput, FinancialChatOutput } from '@/lib/definitions';


export async function financialChat(
  input: FinancialChatInput
): Promise<FinancialChatOutput> {
  return financialChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'financialChatPrompt',
  input: {schema: FinancialChatInputSchema},
  output: {schema: FinancialChatOutputSchema},
  prompt: `You are an expert UK financial advisor chatbot. Your task is to answer user questions based on their financial situation and the conversation history.

Here is the user's current financial data from the tax calculator:
- Tax Year: {{financialContext.taxYear}}
- Salary: £{{financialContext.salary}}
- Bonus: £{{financialContext.bonus}}
- Pension Contribution: {{financialContext.pensionContribution}}%
- Region: {{financialContext.region}}
- Tax Code: {{financialContext.taxCode}}
- Taxable Benefits: £{{financialContext.taxableBenefits}}
- Calculated Gross Annual Income: £{{financialContext.annualGrossIncome}}
- Calculated Annual Taxable Income: £{{financialContext.annualTaxableIncome}}
- Calculated Annual Take-Home: £{{financialContext.annualTakeHome}}
- Calculated Annual Tax: £{{financialContext.annualTax}}
- Calculated Annual National Insurance: £{{financialContext.annualNic}}
- Calculated Annual Pension: £{{financialContext.annualPension}}
- Calculated Personal Allowance: £{{financialContext.personalAllowance}}

Conversation History:
{{#each history}}
- {{role}}: {{content}}
{{/each}}

User's new question:
{{question}}

Based on all the information above, provide a concise, helpful, and accurate answer to the user's question. Do not repeat information they can already see in the calculator unless it's relevant to the question.
`,
});

const financialChatFlow = ai.defineFlow(
  {
    name: 'financialChatFlow',
    inputSchema: FinancialChatInputSchema,
    outputSchema: FinancialChatOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
