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

**Instructions:**
1.  **Collect Data Sequentially:** Ask for only one piece of information per response.
2.  **Acknowledge Previous Answers:** When asking a new question, briefly acknowledge the user's previous answer. For example: "Thanks. Now, what is...".
3.  **Data to Collect:**
    - user_income (annual)
    - partner_income (annual, enter 0 if not applicable)
    - employment type for each person (employed or self-employed)
    - child_age_months
    - monthly_childcare_cost
    - registered_childcare_provider (yes or no)
    - child_disabled (yes or no)
    - claiming_universal_credit (yes or no)
    - claiming_tax_free_childcare (yes or no)
    - country in the UK (England, Scotland, Wales, or Northern Ireland)
4.  **Final Output:** Once all fields are collected, you MUST return a single, valid JSON object and nothing else. Do not add any extra explanation or text outside of the JSON object. The JSON should be enclosed in \`\`\`json markdown tags.

**The final JSON object must contain:**
- adjusted_net_income for each person
- income tax calculation
- National Insurance calculation
- eligibility for free childcare hours
- funded hours amount
- Universal Credit childcare amount
- Tax Free Childcare top up
- conflicts between schemes
- combined monthly childcare reduction
- final effective childcare cost
- final net income after tax and childcare support

**Conversation History:**
{{#each history}}
- {{role}}: {{content}}
{{/each}}

**Your next response:**
Based on the history, determine the next question to ask. If all data is collected, provide the final JSON object. Otherwise, ask the next required question.
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
