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

function calculatePersonalAllowance(adjustedNetIncome: number): number {
  if (adjustedNetIncome <= PA_TAPER_THRESHOLD) {
    return PERSONAL_ALLOWANCE_DEFAULT;
  }
  const taperedAmount = Math.max(0, (adjustedNetIncome - PA_TAPER_THRESHOLD) / 2);
  return Math.max(0, PERSONAL_ALLOWANCE_DEFAULT - taperedAmount);
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
  const grossAnnualIncome = input.salary + (input.bonus ?? 0);
  const annualPension = grossAnnualIncome * (input.pensionContribution / 100);
  
  const adjustedNetIncome = grossAnnualIncome - annualPension;
  const personalAllowance = calculatePersonalAllowance(grossAnnualIncome);
  const taxableIncome = Math.max(0, grossAnnualIncome - personalAllowance - annualPension);
  
  const annualTax = calculateIncomeTax(taxableIncome, input.region);
  const annualNic = calculateNIC(grossAnnualIncome);

  const totalDeductions = annualTax + annualNic + annualPension;
  const annualTakeHome = grossAnnualIncome - totalDeductions;

  const effectiveTaxRate = grossAnnualIncome > 0 ? ((annualTax + annualNic) / grossAnnualIncome) * 100 : 0;
  const takeHome = Math.max(0, annualTakeHome);

  // Monthly breakdown
  const monthlySalary = input.salary / 12;
  const monthlyTax = annualTax / 12;
  const monthlyNic = annualNic / 12;

  const monthlyBreakdown: MonthlyResult[] = months.map(month => {
    const isBonusMonth = month === input.bonusMonth && (input.bonus ?? 0) > 0;
    const currentMonthGross = monthlySalary + (isBonusMonth ? (input.bonus ?? 0) : 0);
    const monthlyPensionContribution = currentMonthGross * (input.pensionContribution / 100);
    
    // For simplicity in this model, tax and NIC are spread evenly.
    // A real PAYE system would adjust dynamically.
    const currentMonthTakeHome = currentMonthGross - monthlyTax - monthlyNic - monthlyPensionContribution;

    return {
      month,
      gross: currentMonthGross,
      pension: monthlyPensionContribution,
      tax: monthlyTax,
      nic: monthlyNic,
      takeHome: currentMonthTakeHome,
    };
  });

  // Recalculate annual take-home from monthly breakdown for accuracy with bonus month
  const accurateAnnualTakeHome = monthlyBreakdown.reduce((acc, month) => acc + month.takeHome, 0);

  return {
    grossAnnualIncome,
    grossMonthlyIncome: grossAnnualIncome / 12,
    annualTakeHome: accurateAnnualTakeHome,
    monthlyTakeHome: accurateAnnualTakeHome / 12,
    annualTax,
    monthlyTax: annualTax / 12,
    annualNic,
    monthlyNic: annualNic / 12,
    annualPension,
    monthlyPension: annualPension / 12,
    effectiveTaxRate,
    breakdown: [
      { name: 'Take-Home Pay', value: accurateAnnualTakeHome, fill: 'hsl(var(--chart-1))' },
      { name: 'Income Tax', value: annualTax, fill: 'hsl(var(--chart-2))' },
      { name: 'National Insurance', value: annualNic, fill: 'hsl(var(--chart-3))' },
      { name: 'Pension', value: annualPension, fill: 'hsl(var(--chart-4))' },
    ],
    monthlyBreakdown,
  };
}
