
"use server";

import { getTaxSavingTips, type TaxSavingTipsInput } from "@/ai/flows/tax-saving-tips";

export async function generateTaxSavingTipsAction(input: TaxSavingTipsInput) {
  try {
    const result = await getTaxSavingTips(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error generating tax saving tips:", error);
    return { success: false, error: "Failed to generate tax-saving tips. Please try again." };
  }
}
