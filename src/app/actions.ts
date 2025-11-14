
"use server";

import { getTaxSavingTips, type TaxSavingTipsInput } from "@/ai/flows/tax-saving-tips";
import { getChildcareAdvice, type ChildcareAdviceInput } from "@/ai/flows/childcare-advice";

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
