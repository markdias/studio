import type { Region, TaxCalculatorSchema, CalculationResults, MonthlyResult } from "@/lib/definitions";
import { months } from "@/lib/definitions";

const PERSONAL_ALLOWANCE_DEFAULT = 12570;
const PA_TAPER_THRESHOLD = 100000;

const ENGLAND_WALES_NI_BANDS = {
  basic: { rate: 0.20, threshold: 37700 },
  higher: { rate: 0.40, threshold: 125140 },
  additional: { rate: 0.45, threshold: Infinity },
};

const SCOTLAND_BANDS = {
  starter: { rate: 0.19, threshold: 2306 },
  basic: { rate: 0.20, threshold: 13991 },
  intermediate: { rate: 0.21, threshold: 31092 },
  higher: { rate: 0.42, threshold: 62430 },
  advanced: { rate: 0.45, threshold: 125140 },
  top: { rate: 0.48, threshold: Infinity },
};


const NIC_BANDS = {
  primaryThreshold: 12570,
  upperEarningsLimit: 50270,
  rate1: 0.08,
  rate2: 0.02,
};

function parseTaxCode(taxCode: string): number {
    const matches = taxCode.match(/^(\d+)/);
    if (matches && matches[1]) {
        return parseInt(matches[1], 10) * 10;
    }
    // Basic fallback for non-standard or 'K' codes. This is a simplification.
    if (taxCode.toUpperCase().startsWith('K')) {
        return 0; // K codes mean the allowance is negative, treated as 0 here for simplicity.
    }
    if (taxCode.toUpperCase() === 'BR' || taxCode.toUpperCase() === 'D0' || taxCode.toUpperCase() === 'D1') {
        return 0;
    }
    return PERSONAL_ALLOWANCE_DEFAULT;
}


function calculatePersonalAllowance(adjustedNetIncome: number, taxCode: string): number {
  const baseAllowance = parseTaxCode(taxCode);
  if (adjustedNetIncome <= PA_TAPER_THRESHOLD) {
    return baseAllowance;
  }
  const taperedAmount = Math.max(0, (adjustedNetIncome - PA_TAPER_THRESHOLD) / 2);
  return Math.max(0, baseAllowance - taperedAmount);
}

function calculateIncomeTax(taxableIncome: number, region: Region): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;

  if (region === 'Scotland') {
    let income = taxableIncome;
    tax += Math.min(income, SCOTLAND_BANDS.starter.threshold) * SCOTLAND_BANDS.starter.rate;
    income -= SCOTLAND_BANDS.starter.threshold;
    if (income > 0) {
      tax += Math.min(income, SCOTLAND_BANDS.basic.threshold - SCOTLAND_BANDS.starter.threshold) * SCOTLAND_BANDS.basic.rate;
      income -= (SCOTLAND_BANDS.basic.threshold - SCOTLAND_BANDS.starter.threshold);
    }
    if (income > 0) {
      tax += Math.min(income, SCOTLAND_BANDS.intermediate.threshold - SCOTLAND_BANDS.basic.threshold) * SCOTLAND_BANDS.intermediate.rate;
      income -= (SCOTLAND_BANDS.intermediate.threshold - SCOTLAND_BANDS.basic.threshold);
    }
    if (income > 0) {
        tax += Math.min(income, SCOTLAND_BANDS.higher.threshold - SCOTLAND_BANDS.intermediate.threshold) * SCOTLAND_BANDS.higher.rate;
        income -= (SCOTLAND_BANDS.higher.threshold - SCOTLAND_BANDS.intermediate.threshold);
    }
    if (income > 0) {
      tax += Math.min(income, SCOTLAND_BANDS.advanced.threshold - SCOTLAND_BANDS.higher.threshold) * SCOTLAND_BANDS.advanced.rate;
      income -= (SCOTLAND_BANDS.advanced.threshold - SCOTLAND_BANDS.higher.threshold);
    }
    if (income > 0) {
      tax += income * SCOTLAND_BANDS.top.rate;
    }
  } else { // England, Wales, NI
    let income = taxableIncome;
    tax += Math.min(income, ENGLAND_WALES_NI_BANDS.basic.threshold) * ENGLAND_WALES_NI_BANDS.basic.rate;
    income -= ENGLAND_WALES_NI_BANDS.basic.threshold;
    if (income > 0) {
      tax += Math.min(income, ENGLAND_WALES_NI_BANDS.higher.threshold - ENGLAND_WALES_NI_BANDS.basic.threshold) * ENGLAND_WALES_NI_BANDS.higher.rate;
      income -= (ENGLAND_WALES_NI_BANDS.higher.threshold - ENGLAND_WALES_NI_BANDS.basic.threshold);
    }
    if (income > 0) {
      tax += income * ENGLAND_WALES_NI_BANDS.additional.rate;
    }
  }
  return tax;
}

function calculateNIC(grossAnnualIncome: number): number {
  if (grossAnnualIncome <= NIC_BANDS.primaryThreshold) return 0;
  let nic = 0;
  const incomeOverPT = grossAnnualIncome - NIC_BANDS.primaryThreshold;
  const incomeUpToUEL = Math.min(incomeOverPT, NIC_BANDS.upperEarningsLimit - NIC_BANDS.primaryThreshold);

  nic += incomeUpToUEL * NIC_BANDS.rate1;

  if (grossAnnualIncome > NIC_BANDS.upperEarningsLimit) {
    const incomeOverUEL = grossAnnualIncome - NIC_BANDS.upperEarningsLimit;
    nic += incomeOverUEL * NIC_BANDS.rate2;
  }

  return nic;
}


export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults {
  const grossAnnualSalary = input.salary;
  const grossAnnualIncome = grossAnnualSalary + (input.bonus ?? 0);
  const incomeForTaxPurposes = grossAnnualIncome + (input.taxableBenefits ?? 0);

  const pensionableBonus = input.isBonusPensionable ? (input.bonus ?? 0) * (input.pensionableBonusPercentage / 100) : 0;
  const pensionableSalary = grossAnnualSalary;
  const totalPensionableIncome = pensionableSalary + pensionableBonus;

  const annualPension = totalPensionableIncome * (input.pensionContribution / 100);

  // Adjusted Net Income for personal allowance tapering. Taxable benefits don't count if through P11D, but we'll include them for a conservative estimate.
  const adjustedNetIncome = incomeForTaxPurposes - annualPension;
  const personalAllowance = calculatePersonalAllowance(adjustedNetIncome, input.taxCode);
  
  const taxableIncome = Math.max(0, incomeForTaxPurposes - annualPension - personalAllowance);
  
  const annualTax = calculateIncomeTax(taxableIncome, input.region);
  // National Insurance is calculated on cash earnings (Salary + Bonus), not benefits in kind.
  const annualNic = calculateNIC(grossAnnualIncome);

  const totalDeductions = annualTax + annualNic + annualPension;
  const annualTakeHome = grossAnnualIncome - totalDeductions;
  
  const effectiveTaxRate = grossAnnualIncome > 0 ? ((annualTax + annualNic) / grossAnnualIncome) * 100 : 0;
  const takeHome = Math.max(0, annualTakeHome);

  // Monthly breakdown
  const monthlySalary = input.salary / 12;
  const monthlyBenefit = (input.taxableBenefits ?? 0) / 12;
  const monthlyBreakdown: MonthlyResult[] = [];
  
  let cumulativeTax = 0;
  let cumulativeNic = 0;
  let cumulativeGross = 0;
  let cumulativePension = 0;

  months.forEach((month, index) => {
      const isBonusMonth = month === input.bonusMonth && (input.bonus ?? 0) > 0;
      const currentMonthBonus = isBonusMonth ? (input.bonus ?? 0) : 0;
      const currentMonthGross = monthlySalary + currentMonthBonus;
      
      const currentPensionableBonus = isBonusMonth && input.isBonusPensionable ? currentMonthBonus * (input.pensionableBonusPercentage / 100) : 0;
      const currentPensionableSalary = monthlySalary;
      const currentPensionableIncome = currentPensionableSalary + currentPensionableBonus;
      const currentMonthPension = currentPensionableIncome * (input.pensionContribution / 100);

      const currentMonthBenefit = monthlyBenefit;
      const currentIncomeForTax = currentMonthGross + currentMonthBenefit;
      
      const yearToDateGross = cumulativeGross + currentMonthGross;
      const yearToDatePension = cumulativePension + currentMonthPension;
      const yearToDateIncomeForTax = yearToDateGross + (currentMonthBenefit * (index + 1));
      
      const yearToDateAllowance = (personalAllowance / 12) * (index + 1);
      const yearToDateTaxable = Math.max(0, yearToDateIncomeForTax - yearToDatePension - yearToDateAllowance);
      
      const yearToDateTax = calculateIncomeTax(yearToDateTaxable, input.region);
      const currentMonthTax = Math.max(0, yearToDateTax - cumulativeTax);

      const yearToDateNic = calculateNIC(yearToDateGross);
      const currentMonthNic = Math.max(0, yearToDateNic - cumulativeNic);

      const currentMonthTakeHome = currentMonthGross - currentMonthTax - currentMonthNic - currentMonthPension;

      monthlyBreakdown.push({
          month,
          gross: currentMonthGross,
          pension: currentMonthPension,
          tax: currentMonthTax,
          nic: currentMonthNic,
          takeHome: currentMonthTakeHome,
      });

      cumulativeTax += currentMonthTax;
      cumulativeNic += currentMonthNic;
      cumulativeGross += currentMonthGross;
      cumulativePension += currentMonthPension;
  });
  
  // Recalculate annual totals from the more accurate monthly breakdown
  const accurateAnnualTax = monthlyBreakdown.reduce((acc, month) => acc + month.tax, 0);
  const accurateAnnualNic = monthlyBreakdown.reduce((acc, month) => acc + month.nic, 0);
  const accurateAnnualPension = monthlyBreakdown.reduce((acc, month) => acc + month.pension, 0);
  const accurateAnnualTakeHome = monthlyBreakdown.reduce((acc, month) => acc + month.takeHome, 0);

  return {
    grossAnnualIncome,
    grossMonthlyIncome: grossAnnualIncome / 12,
    annualTakeHome: accurateAnnualTakeHome,
    monthlyTakeHome: accurateAnnualTakeHome / 12,
    annualTax: accurateAnnualTax,
    monthlyTax: accurateAnnualTax / 12,
    annualNic: accurateAnnualNic,
    monthlyNic: accurateAnnualNic / 12,
    annualPension: accurateAnnualPension,
    monthlyPension: accurateAnnualPension / 12,
    effectiveTaxRate: grossAnnualIncome > 0 ? ((accurateAnnualTax + accurateAnnualNic) / grossAnnualIncome) * 100 : 0,
    breakdown: [
      { name: 'Take-Home Pay', value: accurateAnnualTakeHome, fill: 'hsl(var(--chart-1))' },
      { name: 'Income Tax', value: accurateAnnualTax, fill: 'hsl(var(--chart-2))' },
      { name: 'National Insurance', value: accurateAnnualNic, fill: 'hsl(var(--chart-3))' },
      { name: 'Pension', value: accurateAnnualPension, fill: 'hsl(var(--chart-4))' },
    ],
    monthlyBreakdown,
  };
}
