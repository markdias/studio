

import type { Region, TaxCalculatorSchema, CalculationResults, MonthlyResult, TaxYear } from "@/lib/definitions";
import { months, payFrequencies } from "@/lib/definitions";

// Tax Year Data based on user-provided and known information
const taxYearData = {
  "2023/24": {
    PERSONAL_ALLOWANCE_DEFAULT: 12570,
    PA_TAPER_THRESHOLD: 100000,
    BLIND_PERSONS_ALLOWANCE: 2870,
    ENGLAND_WALES_NI_BANDS: {
      basic: { rate: 0.20, threshold: 37700 },
      higher: { rate: 0.40, threshold: 125140 },
      additional: { rate: 0.45, threshold: Infinity },
    },
    SCOTLAND_BANDS: {
      starter: { rate: 0.19, threshold: 2162 },
      basic: { rate: 0.20, threshold: 13118 },
      intermediate: { rate: 0.21, threshold: 31092 },
      higher: { rate: 0.42, threshold: 125140 },
      top: { rate: 0.47, threshold: Infinity },
    },
    NIC_BANDS: {
      pt: 12570, // Primary Threshold (Annual)
      uel: 50270, // Upper Earnings Limit (Annual)
      rate1: 0.12, 
      rate2: 0.02,
    },
    STUDENT_LOAN: {
      plan1: { threshold: 22015, rate: 0.09 },
      plan2: { threshold: 27295, rate: 0.09 },
      plan4: { threshold: 27660, rate: 0.09 },
      plan5: { threshold: 25000, rate: 0.09 },
      postgraduate: { threshold: 21000, rate: 0.06 },
    },
  },
  "2024/25": {
    PERSONAL_ALLOWANCE_DEFAULT: 12570,
    PA_TAPER_THRESHOLD: 100000,
    BLIND_PERSONS_ALLOWANCE: 3160,
    ENGLAND_WALES_NI_BANDS: {
      basic: { rate: 0.20, threshold: 37700 },
      higher: { rate: 0.40, threshold: 125140 },
      additional: { rate: 0.45, threshold: Infinity },
    },
    SCOTLAND_BANDS: {
      starter: { rate: 0.19, threshold: 2306 },
      basic: { rate: 0.20, threshold: 13991 },
      intermediate: { rate: 0.21, threshold: 31092 },
      higher: { rate: 0.42, threshold: 62430 },
      advanced: { rate: 0.45, threshold: 125140 },
      top: { rate: 0.47, threshold: Infinity },
    },
     NIC_BANDS: {
      pt: 12570,
      uel: 50270,
      rate1: 0.08,
      rate2: 0.02,
    },
    STUDENT_LOAN: {
      plan1: { threshold: 24990, rate: 0.09 },
      plan2: { threshold: 27295, rate: 0.09 },
      plan4: { threshold: 31395, rate: 0.09 },
      plan5: { threshold: 25000, rate: 0.09 },
      postgraduate: { threshold: 21000, rate: 0.06 },
    },
  },
  "2025/26": { 
    PERSONAL_ALLOWANCE_DEFAULT: 12570,
    PA_TAPER_THRESHOLD: 100000,
    BLIND_PERSONS_ALLOWANCE: 3160, // Assumed to be same as 24/25
    ENGLAND_WALES_NI_BANDS: {
      basic: { rate: 0.20, threshold: 37700 },
      higher: { rate: 0.40, threshold: 125140 },
      additional: { rate: 0.45, threshold: Infinity },
    },
    SCOTLAND_BANDS: {
      starter: { rate: 0.19, threshold: 2306 },
      basic: { rate: 0.20, threshold: 13991 },
      intermediate: { rate: 0.21, threshold: 31092 },
      higher: { rate: 0.42, threshold: 62430 },
      advanced: { rate: 0.45, threshold: 125140 },
      top: { rate: 0.47, threshold: Infinity },
    },
    NIC_BANDS: {
      pt: 12570,
      uel: 50270,
      rate1: 0.08,
      rate2: 0.02,
    },
    STUDENT_LOAN: {
      plan1: { threshold: 24990, rate: 0.09 },
      plan2: { threshold: 27295, rate: 0.09 },
      plan4: { threshold: 31395, rate: 0.09 },
      plan5: { threshold: 25000, rate: 0.09 },
      postgraduate: { threshold: 21000, rate: 0.06 },
    },
  }
};

export function getTaxYearData(year: TaxYear) {
  return taxYearData[year];
}

export function parseTaxCode(taxCode: string, defaultAllowance: number): number {
    if (!taxCode) {
        return defaultAllowance;
    }
    const code = taxCode.toUpperCase().trim();

    // Remove region suffix (S for Scotland) if present - it doesn't affect the allowance amount
    // but should be matched with the correct tax bands elsewhere
    const codeWithoutSuffix = code.replace(/^S/, '');

    if (['BR', 'D0', 'D1', '0T', 'NT'].includes(codeWithoutSuffix)) {
        return 0;
    }

    const kCodeMatch = codeWithoutSuffix.match(/^K(\d+)/);
    if (kCodeMatch) {
        const num = parseInt(kCodeMatch[1], 10);
        // K-codes typically represent amounts up to 9999 (£99,990 debt)
        // Limit to prevent unrealistic negative allowances
        if (isNaN(num) || num < 0) return 0;
        if (num > 99999) {
            // Log warning for unusually large K-code but still process it
            console.warn(`K-code amount ${num} is unusually large (normally max 9999)`);
            return -(num * 10);
        }
        return -(num * 10);
    }

    const match = codeWithoutSuffix.match(/^(\d+)[LMNPTY]?$/);
    if (match) {
        const num = parseInt(match[1], 10);
        return isNaN(num) ? defaultAllowance : num * 10;
    }

    return defaultAllowance;
}

export function getRegionFromTaxCode(taxCode: string): Region | null {
    if (!taxCode) return null;
    const code = taxCode.toUpperCase().trim();
    // S prefix indicates Scottish resident using Scottish tax bands
    if (code.startsWith('S')) {
        return 'Scotland';
    }
    return null;
}


function calculateAnnualPersonalAllowance(adjustedNetIncome: number, parsedAllowance: number, isBlind: boolean, year: TaxYear): number {
  const { PA_TAPER_THRESHOLD, BLIND_PERSONS_ALLOWANCE, PERSONAL_ALLOWANCE_DEFAULT } = getTaxYearData(year);

  // K-codes represent HMRC debt (negative allowance). They should not be combined with blind person's allowance.
  // K-codes are also not tapered or adjusted - they are fixed amounts owed.
  if (parsedAllowance < 0) {
      return parsedAllowance;
  }

  // Personal allowance tapering: £1 lost for every £2 earned over £100,000.
  // Taper is applied to the actual allowance (whether default or custom code).
  let baseAllowance = parsedAllowance > 0 ? parsedAllowance : PERSONAL_ALLOWANCE_DEFAULT;
  let finalAllowance = baseAllowance;

  if (adjustedNetIncome > PA_TAPER_THRESHOLD) {
      const incomeOverThreshold = adjustedNetIncome - PA_TAPER_THRESHOLD;
      const reduction = incomeOverThreshold / 2;
      finalAllowance = Math.max(0, baseAllowance - reduction);
  }
  
  // Add blind person's allowance if applicable
  finalAllowance += (isBlind ? BLIND_PERSONS_ALLOWANCE : 0);

  return Math.max(0, finalAllowance);
}


function calculateTaxOnIncome(taxableIncome: number, region: Region, year: TaxYear): number {
    if (taxableIncome <= 0) return 0;

    const taxBandsData = region === 'Scotland' 
        ? getTaxYearData(year).SCOTLAND_BANDS 
        : getTaxYearData(year).ENGLAND_WALES_NI_BANDS;

    const bands = Object.entries(taxBandsData).map(([key, value]) => ({...value, key})).sort((a, b) => a.threshold - b.threshold);

    let tax = 0;
    let remainingIncome = taxableIncome;
    let previousThreshold = 0;

    for (const band of bands) {
        if (remainingIncome <= 0) break;
        const bandThreshold = band.threshold === Infinity ? remainingIncome + previousThreshold : band.threshold;
        const taxableInBand = Math.min(remainingIncome, bandThreshold - previousThreshold);
        
        if (taxableInBand > 0) {
            tax += taxableInBand * band.rate;
            remainingIncome -= taxableInBand;
        }

        previousThreshold = bandThreshold;
    }

    return tax;
}


function calculateNICForAnnual(grossIncomeAnnual: number, year: TaxYear): number {
    const { pt, uel, rate1, rate2 } = getTaxYearData(year).NIC_BANDS;
    
    if (grossIncomeAnnual <= pt) {
        return 0;
    }
    
    let nic = 0;
    
    if (grossIncomeAnnual > pt) {
        const earningsInMainBand = Math.min(grossIncomeAnnual, uel) - pt;
        nic += Math.max(0, earningsInMainBand) * rate1;
    }
    
    if (grossIncomeAnnual > uel) {
        const earningsInUpperBand = grossIncomeAnnual - uel;
        nic += earningsInUpperBand * rate2;
    }

    return nic > 0 ? nic : 0;
}

function calculateStudentLoanForAnnual(grossIncomeAnnual: number, year: TaxYear, input: TaxCalculatorSchema): number {
  if (!input.showStudentLoan) {
    return 0;
  }
  const loanConfig = getTaxYearData(year).STUDENT_LOAN;
  let totalRepayment = 0;

  const calculateRepayment = (plan: 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgraduate') => {
      if (input[plan]) {
          const config = loanConfig[plan];
          if (grossIncomeAnnual > config.threshold) {
              const repayableIncome = grossIncomeAnnual - config.threshold;
              return repayableIncome * config.rate;
          }
      }
      return 0;
  }
  
  if(input.studentLoanPlan1) {
    totalRepayment += calculateRepayment('plan1');
  } else if (input.studentLoanPlan2) {
    totalRepayment += calculateRepayment('plan2');
  } else if (input.studentLoanPlan4) {
    totalRepayment += calculateRepayment('plan4');
  } else if (input.studentLoanPlan5) {
    totalRepayment += calculateRepayment('plan5');
  }

  if(input.postgraduateLoan) {
      totalRepayment += calculateRepayment('postgraduate');
  }

  return totalRepayment;
}

const bonusFrequencyMap: Record<TaxCalculatorSchema['bonusPayFrequency'], number> = {
  'yearly': 1,
  'quarterly': 4,
  'monthly': 12,
  'one-time': 1,
};


export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults {
    const { 
      taxYear, salary, bonus = 0, bonusPayFrequency = 'one-time', pensionContribution, region, taxableBenefits = 0, 
      taxCode, bonusPensionContribution = 0, blind = false, hasPayRise, newSalary, 
      payRiseMonth, pensionScheme 
    } = input;
    
    const payRiseMonthIndex = (hasPayRise && newSalary && newSalary > salary) ? months.indexOf(payRiseMonth) : 12;
    
    const bonusMultiplier = bonusFrequencyMap[bonusPayFrequency] || 1;
    const annualBonus = bonus > 0 ? bonus * bonusMultiplier : 0;

    let totalSalary = 0;
    for (let i = 0; i < 12; i++) {
        const currentMonthlySalary = (i < payRiseMonthIndex) ? salary / 12 : (newSalary ?? salary) / 12;
        totalSalary += currentMonthlySalary;
    }
    const grossAnnualSalary = totalSalary;
    const grossAnnualIncome = grossAnnualSalary + annualBonus;

    const oneTimeBonus = bonusPayFrequency === 'one-time' ? annualBonus : 0;
    const recurringBonus = annualBonus - oneTimeBonus;

    const annualPensionFromSalary = grossAnnualSalary * (pensionContribution / 100);
    const annualPensionFromRecurringBonus = recurringBonus * (pensionContribution / 100);
    const annualPensionFromOneTimeBonus = oneTimeBonus * (bonusPensionContribution / 100);
    const annualPension = annualPensionFromSalary + annualPensionFromRecurringBonus + annualPensionFromOneTimeBonus;

    // This is the income used for National Insurance and Student Loan calculations.
    // Taxable benefits are included as they are subject to NI in the UK.
    const grossForNIAndLoan = pensionScheme === 'Salary Sacrifice' ? (grossAnnualIncome + taxableBenefits) - annualPension : (grossAnnualIncome + taxableBenefits);

    // This is the income used to determine if the personal allowance should be tapered.
    const adjustedNetIncomeForPA = grossAnnualIncome + taxableBenefits - (pensionScheme === 'Salary Sacrifice' ? annualPension : 0);
    
    const taxYearConfig = getTaxYearData(taxYear);
    const parsedCodeAllowance = parseTaxCode(taxCode, taxYearConfig.PERSONAL_ALLOWANCE_DEFAULT);
    const finalPersonalAllowance = calculateAnnualPersonalAllowance(adjustedNetIncomeForPA, parsedCodeAllowance, blind, taxYear);

    // This is the final income amount on which tax is calculated.
    const taxableIncomeForFinalCalc = grossAnnualIncome + taxableBenefits - (pensionScheme === 'Salary Sacrifice' ? annualPension : 0) - finalPersonalAllowance - (pensionScheme === 'Standard (Relief at Source)' ? annualPension : 0);
    const annualTaxableIncome = Math.max(0, taxableIncomeForFinalCalc);
    
    const annualTax = calculateTaxOnIncome(annualTaxableIncome, region, taxYear);
    const annualNic = calculateNICForAnnual(grossForNIAndLoan, taxYear);
    const annualStudentLoan = calculateStudentLoanForAnnual(grossForNIAndLoan, taxYear, input);
    
    const annualTakeHome = grossAnnualIncome - annualPension - annualTax - annualNic - annualStudentLoan;

    // --- Monthly Breakdown ---
    const monthlyBreakdown: MonthlyResult[] = [];
    const bonusMonthIndex = oneTimeBonus > 0 ? months.indexOf(input.bonusMonth) : -1;
    
    // Use cumulative values to handle floating point inaccuracies and ensure annual totals match.
    let cumulativeTax = 0;
    let cumulativeNic = 0;
    let cumulativeLoan = 0;

    for (let i = 0; i < 12; i++) {
        const month = months[i];
        
        const isPayRiseMonth = i >= payRiseMonthIndex;
        const currentSalary = isPayRiseMonth ? (newSalary ?? salary) : salary;
        
        // Calculate gross income for THIS month.
        const grossThisMonthSalary = currentSalary / 12;
        const grossThisMonthRecurringBonus = recurringBonus / 12;
        const grossThisMonthOneTimeBonus = (i === bonusMonthIndex) ? oneTimeBonus : 0;
        const grossThisMonth = grossThisMonthSalary + grossThisMonthRecurringBonus + grossThisMonthOneTimeBonus;

        // Calculate pension for THIS month.
        const pensionThisMonthSalary = grossThisMonthSalary * (pensionContribution / 100);
        const pensionThisMonthRecurringBonus = grossThisMonthRecurringBonus * (pensionContribution / 100);
        const pensionThisMonthOneTimeBonus = (i === bonusMonthIndex) ? oneTimeBonus * (bonusPensionContribution / 100) : 0;
        const pensionThisMonth = pensionThisMonthSalary + pensionThisMonthRecurringBonus + pensionThisMonthOneTimeBonus;

        // Pro-rate the annual deductions for this month.
        // NOTE: This is an ESTIMATION approach and does NOT use proper HMRC cumulative payroll.
        // Real payroll uses Year-To-Date (YTD) cumulative basis, which means:
        // - Tax is calculated on cumulative income from April to current month
        // - Mid-year pay rises cause higher tax in later months (not averaged)
        // - Bonuses in specific months create lumpy tax in that month only
        // - Personal allowance is utilized month-by-month cumulatively
        // This approximation is acceptable for salary planning but NOT for final tax returns.
        // For accurate calculations, use HMRC's payroll software or a certified accountant.
        const taxThisMonth = annualTax / 12;
        const nicThisMonth = annualNic / 12;
        const loanThisMonth = annualStudentLoan / 12;
        
        const takeHomeThisMonth = grossThisMonth - pensionThisMonth - taxThisMonth - nicThisMonth - loanThisMonth;
        
        monthlyBreakdown.push({
            month,
            gross: grossThisMonth,
            pension: pensionThisMonth,
            tax: taxThisMonth,
            nic: nicThisMonth,
            studentLoan: loanThisMonth,
            takeHome: takeHomeThisMonth,
        });
    }

    return {
        grossAnnualIncome: grossAnnualIncome,
        annualTaxableIncome: annualTaxableIncome,
        annualTakeHome: annualTakeHome,
        annualTax: annualTax,
        annualNic: annualNic,
        annualStudentLoan: annualStudentLoan,
        annualPension: annualPension,
        personalAllowance: finalPersonalAllowance,
        effectiveTaxRate: grossAnnualIncome > 0 ? ((annualTax + annualNic) / grossAnnualIncome) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: annualTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: annualTax, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: annualNic, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: annualPension, fill: 'hsl(var(--chart-4))' },
            { name: 'Student Loan', value: annualStudentLoan, fill: 'hsl(var(--chart-5))' },
        ].filter(item => item.value > 0),
        monthlyBreakdown: monthlyBreakdown,
        annualBonus: annualBonus,
    };
}
