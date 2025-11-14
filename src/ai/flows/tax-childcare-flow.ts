'use server';
/**
 * @fileOverview A conversational AI flow for calculating tax and childcare support interactions.
 *
 * - taxChildcareChat - A function that handles the conversational chat.
 */

import {ai} from '@/ai/genkit';
import { TaxChildcareChatInputSchema, TaxChildcareChatOutputSchema, type TaxChildcareChatInput, type TaxChildcareChatOutput } from '@/lib/definitions';

export type { TaxChildcareChatInput, TaxChildcareChatOutput } from '@/lib/definitions';


export async function taxChildcareChat(
  input: TaxChildcareChatInput
): Promise<TaxChildcareChatOutput> {
  return taxChildcareChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'taxChildcareChatPrompt',
  input: {schema: TaxChildcareChatInputSchema},
  output: {schema: TaxChildcareChatOutputSchema},
  prompt: `You are an AI assistant designed to calculate UK income tax, National Insurance, and childcare support.
Your goal is to collect user data by asking one question at a time.

**User's Financial Data (from calculator):**
- User Income (Annual): £{{financialContext.salary}}
- Country in the UK: {{financialContext.region}}
{{#if financialContext.partnerIncome}}
- Partner Income (Annual): £{{financialContext.partnerIncome}}
{{/if}}

**Instructions:**
1.  **Use Provided Data:** Use the financial data above. Do NOT ask for 'user_income' or 'country in the UK' again.
2.  **Collect Missing Data Sequentially:** Ask for only one piece of information per response.
3.  **Acknowledge Previous Answers:** When asking a new question, briefly acknowledge the user's previous answer. For example: "Thanks. Now, what is...".
4.  **Data to Collect (if not already provided):**
    - partner_income (annual, enter 0 if not applicable)
    - employment type for each person (employed or self-employed)
    - child_age_months
    - monthly_childcare_cost
    - registered_childcare_provider (yes or no)
    - child_disabled (yes or no)
    - claiming_universal_credit (yes or no)
    - claiming_tax_free_childcare (yes or no)
5.  **Final Output:** Once all fields are collected, you MUST return a single, valid markdown table and nothing else. Do not add any extra explanation or text outside of the table.

**The final markdown table must have two columns ("Metric" and "Value") and contain the following rows:**
- Adjusted Net Income (User)
- Adjusted Net Income (Partner)
- Income Tax (User)
- National Insurance (User)
- Free Childcare Hours Eligibility
- Funded Hours Amount
- Universal Credit Childcare Amount
- Tax-Free Childcare Top-up
- Scheme Conflicts/Notes
- Combined Monthly Childcare Reduction
- Final Effective Childcare Cost
- Final Net Income (After tax and childcare)

**Conversation History:**
{{#each history}}
- {{role}}: {{content}}
{{/each}}

**Your next response:**
Based on the history and provided data, determine the next question to ask. If all data is collected, provide the final markdown table. Otherwise, ask the next required question.
User's latest message: {{question}}
`,
});

const taxChildcareChatFlow = ai.defineFlow(
  {
    name: 'taxChildcareChatFlow',
    inputSchema: TaxChildcareChatInputSchema,
    outputSchema: TaxChildcareChatOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
