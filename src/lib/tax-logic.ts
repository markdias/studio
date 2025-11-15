
import type { Region, TaxCalculatorSchema, CalculationResults, MonthlyResult, TaxYear } from "@/lib/definitions";
import { months } from "@/lib/definitions";

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
      top: { rate: 0.48, threshold: Infinity },
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
      top: { rate: 0.48, threshold: Infinity },
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
    
    if (['BR', 'D0', 'D1', '0T', 'NT'].includes(code)) {
        return 0;
    }
    
    const kCodeMatch = code.match(/^K(\d+)/);
    if (kCodeMatch) {
        const num = parseInt(kCodeMatch[1], 10);
        return isNaN(num) ? 0 : -(num * 10);
    }
    
    const match = code.match(/^(\d+)[LMNPTY]?$/);
    if (match) {
        const num = parseInt(match[1], 10);
        return isNaN(num) ? defaultAllowance : num * 10;
    }
    
    return defaultAllowance;
}


function calculateAnnualPersonalAllowance(adjustedNetIncome: number, parsedAllowance: number, isBlind: boolean, year: TaxYear): number {
  const { PA_TAPER_THRESHOLD, BLIND_PERSONS_ALLOWANCE, PERSONAL_ALLOWANCE_DEFAULT } = getTaxYearData(year);

  // K-codes are not tapered.
  if (parsedAllowance < 0) {
      return parsedAllowance + (isBlind ? BLIND_PERSONS_ALLOWANCE : 0);
  }

  // Tapering is always based on the default personal allowance for the year.
  let allowance = PERSONAL_ALLOWANCE_DEFAULT;

  if (adjustedNetIncome > PA_TAPER_THRESHOLD) {
      const incomeOverThreshold = adjustedNetIncome - PA_TAPER_THRESHOLD;
      const reduction = Math.floor(incomeOverThreshold / 2);
      allowance = Math.max(0, PERSONAL_ALLOWANCE_DEFAULT - reduction);
  }
  
  // Apply any difference from a custom tax code (e.g. 1300L) AFTER tapering the default allowance.
  const customCodeAdjustment = parsedAllowance - PERSONAL_ALLOWANCE_DEFAULT;
  let finalAllowance = allowance + customCodeAdjustment;
  
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


export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults {
    const { taxYear, salary, bonus = 0, pensionContribution, region, taxableBenefits = 0, taxCode, bonusPensionContribution = 0, blind = false, hasPayRise, newSalary, payRiseMonth } = input;
    const payRiseMonthIndex = (hasPayRise && newSalary) ? months.indexOf(payRiseMonth) : 12;
    const bonusMonthIndex = bonus > 0 ? months.indexOf(input.bonusMonth) : -1;

    let totalSalary = 0;
    for (let i = 0; i < 12; i++) {
        const currentMonthlySalary = (i < payRiseMonthIndex) ? salary / 12 : (newSalary ?? salary) / 12;
        totalSalary += currentMonthlySalary;
    }
    const annualSalary = totalSalary;


    // --- Base Annual Calculation (without bonus) ---
    const basePension = annualSalary * (pensionContribution / 100);
    const baseAdjustedNetIncome = annualSalary + taxableBenefits - basePension;
    const taxYearConfig = getTaxYearData(taxYear);
    const parsedCodeAllowance = parseTaxCode(taxCode, taxYearConfig.PERSONAL_ALLOWANCE_DEFAULT);
    const basePersonalAllowance = calculateAnnualPersonalAllowance(baseAdjustedNetIncome, parsedCodeAllowance, blind, taxYear);
    const baseTaxableIncome = Math.max(0, annualSalary + taxableBenefits - basePension - basePersonalAllowance);
    const baseAnnualTax = calculateTaxOnIncome(baseTaxableIncome, region, taxYear);
    const baseGrossForNI = annualSalary - basePension;
    const baseAnnualNic = calculateNICForAnnual(baseGrossForNI, taxYear);
    const baseAnnualStudentLoan = calculateStudentLoanForAnnual(baseGrossForNI, taxYear, input);

    // --- Calculation with Bonus ---
    const grossAnnualIncome = annualSalary + bonus;
    const annualPensionFromSalary = basePension;
    const annualPensionFromBonus = bonus * (bonusPensionContribution / 100);
    const annualPension = annualPensionFromSalary + annualPensionFromBonus;
    
    const adjustedNetIncomeForPA = grossAnnualIncome + taxableBenefits - annualPension;
    const finalPersonalAllowance = calculateAnnualPersonalAllowance(adjustedNetIncomeForPA, parsedCodeAllowance, blind, taxYear);
    const annualTaxableIncome = Math.max(0, grossAnnualIncome + taxableBenefits - annualPension - finalPersonalAllowance);
    
    const grossForNIAndLoan = grossAnnualIncome - annualPension;
    const annualNicWithBonus = calculateNICForAnnual(grossForNIAndLoan, taxYear);
    const annualTaxWithBonus = calculateTaxOnIncome(annualTaxableIncome, region, taxYear);
    const annualStudentLoanWithBonus = calculateStudentLoanForAnnual(grossForNIAndLoan, taxYear, input);
    
    const annualTakeHome = grossAnnualIncome - annualPension - annualTaxWithBonus - annualNicWithBonus - annualStudentLoanWithBonus;

    const bonusTax = annualTaxWithBonus - baseAnnualTax;
    const bonusNic = annualNicWithBonus - baseAnnualNic;
    const bonusLoan = annualStudentLoanWithBonus - baseAnnualStudentLoan;

    // --- Monthly Breakdown ---
    const monthlyBreakdown: MonthlyResult[] = [];
    
    for (let i = 0; i < 12; i++) {
        const month = months[i];
        const grossThisMonthFromSalary = (i < payRiseMonthIndex) ? salary / 12 : (newSalary ?? salary) / 12;
        const pensionThisMonthFromSalary = grossThisMonthFromSalary * (pensionContribution / 100);
        
        let grossThisMonth = grossThisMonthFromSalary;
        let pensionThisMonth = pensionThisMonthFromSalary;
        let taxThisMonth = baseAnnualTax / 12;
        let nicThisMonth = baseAnnualNic / 12;
        let loanThisMonth = baseAnnualStudentLoan / 12;

        if (i === bonusMonthIndex) {
            grossThisMonth += bonus;
            pensionThisMonth += annualPensionFromBonus;
            taxThisMonth += bonusTax;
            nicThisMonth += bonusNic;
            loanThisMonth += bonusLoan;
        }
        
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
        annualTax: annualTaxWithBonus,
        annualNic: annualNicWithBonus,
        annualStudentLoan: annualStudentLoanWithBonus,
        annualPension: annualPension,
        personalAllowance: finalPersonalAllowance,
        effectiveTaxRate: grossAnnualIncome > 0 ? ((annualTaxWithBonus + annualNicWithBonus) / grossAnnualIncome) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: annualTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: annualTaxWithBonus, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: annualNicWithBonus, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: annualPension, fill: 'hsl(var(--chart-4))' },
            { name: 'Student Loan', value: annualStudentLoanWithBonus, fill: 'hsl(var(--chart-5))' },
        ].filter(item => item.value > 0),
        monthlyBreakdown: monthlyBreakdown,
    };
}
