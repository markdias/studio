
"use server";

import { getTaxSavingTips, type TaxSavingTipsInput } from "@/ai/flows/tax-saving-tips";
import { getChildcareAdvice, type ChildcareAdviceInput } from "@/ai/flows/childcare-advice";
import { financialChat, type FinancialChatInput } from "@/ai/flows/financial-chat";
import { taxChildcareChat, type TaxChildcareChatInput } from "@/ai/flows/tax-childcare-flow";

export async function generateTaxSavingTipsAction(input: TaxSavingTipsInput) {
  try {
    const result = await getTaxSavingTips(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error generating tax saving tips:", error);
    return { success: false, error: "Failed to generate tax-saving tips. Please try again." };
  }
}

export async function generateChildcareAdviceAction(input: ChildcareAdviceInput) {
  try {
    const result = await getChildcareAdvice(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error generating childcare advice:", error);
    return { success: false, error: "Failed to generate childcare advice. Please try again." };
  }
}

export async function financialChatAction(input: FinancialChatInput) {
  try {
    const result = await financialChat(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error in financial chat:", error);
    return { success: false, error: "Failed to get a response from the AI. Please try again." };
  }
}

export async function taxChildcareChatAction(input: TaxChildcareChatInput) {
  try {
    const result = await taxChildcareChat(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error in tax/childcare chat:", error);
    return { success: false, error: "Failed to get a response from the AI. Please try again." };
  }
}
