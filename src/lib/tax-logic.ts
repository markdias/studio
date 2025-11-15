
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

    // K-codes mean the allowance is negative and is not tapered.
    if (parsedAllowance < 0) {
        return parsedAllowance + (isBlind ? BLIND_PERSONS_ALLOWANCE : 0);
    }

    // Tapering is always based on the default personal allowance for the year.
    let allowanceBeforeAdjustments = PERSONAL_ALLOWANCE_DEFAULT;

    if (adjustedNetIncome > PA_TAPER_THRESHOLD) {
        const incomeOverThreshold = adjustedNetIncome - PA_TAPER_THRESHOLD;
        const reduction = Math.floor(incomeOverThreshold / 2);
        allowanceBeforeAdjustments = Math.max(0, PERSONAL_ALLOWANCE_DEFAULT - reduction);
    }

    // Now, apply the difference between the parsed allowance and the default.
    // This correctly handles tax codes like 1300L (more allowance) or 1000L (less allowance)
    // on top of any tapering.
    const customCodeAdjustment = parsedAllowance - PERSONAL_ALLOWANCE_DEFAULT;
    let finalAllowance = allowanceBeforeAdjustments + customCodeAdjustment;
    
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


function calculateNICForPeriod(grossIncomeForPeriod: number, year: TaxYear): number {
    const { pt, uel, rate1, rate2 } = getTaxYearData(year).NIC_BANDS;
    
    const monthlyPT = pt / 12;
    const monthlyUEL = uel / 12;

    if (grossIncomeForPeriod <= monthlyPT) {
        return 0;
    }
    
    let nic = 0;
    
    if (grossIncomeForPeriod > monthlyPT) {
        const earningsInMainBand = Math.min(grossIncomeForPeriod, monthlyUEL) - monthlyPT;
        nic += Math.max(0, earningsInMainBand) * rate1;
    }
    
    if (grossIncomeForPeriod > monthlyUEL) {
        const earningsInUpperBand = grossIncomeForPeriod - monthlyUEL;
        nic += earningsInUpperBand * rate2;
    }

    return nic > 0 ? nic : 0;
}

function calculateStudentLoanForPeriod(grossIncomeForPeriod: number, year: TaxYear, input: TaxCalculatorSchema): number {
  if (!input.showStudentLoan) {
    return 0;
  }
  const loanConfig = getTaxYearData(year).STUDENT_LOAN;
  let totalRepayment = 0;

  const calculateRepayment = (plan: 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgraduate') => {
      if (input[plan]) {
          const config = loanConfig[plan];
          const monthlyThreshold = config.threshold / 12;
          if (grossIncomeForPeriod > monthlyThreshold) {
              const repayableIncome = grossIncomeForPeriod - monthlyThreshold;
              return repayableIncome * config.rate;
          }
      }
      return 0;
  }

  // Student loan plans are mutually exclusive in this calculation logic, PGL is separate
  if(input.studentLoanPlan1) {
    totalRepayment += calculateRepayment('plan1');
  } else if (input.studentLoanPlan2) {
    totalRepayment += calculateRepayment('plan2');
  } else if (input.studentLoanPlan4) {
    totalRepayment += calculateRepayment('plan4');
  } else if (input.studentLoanPlan5) {
    totalRepayment += calculateRepayment('plan5');
  }

  // Postgraduate loan can be concurrent with other plans
  if(input.postgraduateLoan) {
      totalRepayment += calculateRepayment('postgraduate');
  }

  return totalRepayment;
}


export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults {
    const { taxYear, salary, bonus = 0, pensionContribution, region, taxableBenefits = 0, taxCode, bonusPensionContribution = 0, blind = false } = input;
    const payRiseMonthIndex = input.hasPayRise ? months.indexOf(input.payRiseMonth) : 12;
    const bonusMonthIndex = bonus > 0 ? months.indexOf(input.bonusMonth) : -1;

    const taxYearConfig = getTaxYearData(taxYear);
    const parsedCodeAllowance = parseTaxCode(taxCode, taxYearConfig.PERSONAL_ALLOWANCE_DEFAULT);

    let annualGrossFromSalary = 0;
    const monthlySalaries: number[] = [];
    for (let i = 0; i < 12; i++) {
        const currentMonthlySalary = (i < payRiseMonthIndex) ? salary / 12 : (input.newSalary ?? salary) / 12;
        monthlySalaries.push(currentMonthlySalary);
        annualGrossFromSalary += currentMonthlySalary;
    }

    const grossAnnualIncome = annualGrossFromSalary + bonus;

    const annualPensionFromSalary = annualGrossFromSalary * (pensionContribution / 100);
    const annualPensionFromBonus = bonus * (bonusPensionContribution / 100);
    const annualPension = annualPensionFromSalary + annualPensionFromBonus;

    const grossAnnualForTax = grossAnnualIncome + taxableBenefits;

    const adjustedNetIncomeForPA = grossAnnualForTax - annualPension; // Used for tapering PA

    const finalPersonalAllowance = calculateAnnualPersonalAllowance(adjustedNetIncomeForPA, parsedCodeAllowance, blind, taxYear);
    const annualTaxableIncome = Math.max(0, grossAnnualForTax - annualPension - finalPersonalAllowance);

    // --- Monthly Breakdown using Cumulative Calculation ---
    let cumulativeGrossYTD = 0;
    let cumulativePensionYTD = 0;
    let cumulativeTaxableBenefitsYTD = 0;
    let cumulativeTaxPaidYTD = 0;

    const finalMonthlyBreakdown: MonthlyResult[] = [];

    for (let i = 0; i < 12; i++) {
        const month = months[i];
        const monthIndex = i + 1;
        
        const grossThisMonthFromSalary = monthlySalaries[i];
        const bonusThisMonth = (i === bonusMonthIndex) ? bonus : 0;
        const grossThisMonth = grossThisMonthFromSalary + bonusThisMonth;

        const pensionFromSalaryThisMonth = grossThisMonthFromSalary * (pensionContribution / 100);
        const pensionFromBonusThisMonth = bonusThisMonth * (bonusPensionContribution / 100);
        const pensionThisMonth = pensionFromSalaryThisMonth + pensionFromBonusThisMonth;

        const earningsForNIAndLoan = grossThisMonth - pensionThisMonth;

        const taxableBenefitsThisMonth = taxableBenefits / 12;

        cumulativeGrossYTD += grossThisMonth;
        cumulativePensionYTD += pensionThisMonth;
        cumulativeTaxableBenefitsYTD += taxableBenefitsThisMonth;

        const grossForTaxYTD = cumulativeGrossYTD + cumulativeTaxableBenefitsYTD;
        
        const personalAllowanceYTD = finalPersonalAllowance * (monthIndex / 12);
        
        const taxableIncomeYTD = Math.max(0, grossForTaxYTD - cumulativePensionYTD - personalAllowanceYTD);
        
        const taxDueYTD = calculateTaxOnIncome(taxableIncomeYTD, region, taxYear);
        
        const taxThisMonth = Math.max(0, taxDueYTD - cumulativeTaxPaidYTD);
        cumulativeTaxPaidYTD += taxThisMonth;

        const nicThisMonth = calculateNICForPeriod(earningsForNIAndLoan, taxYear);
        const studentLoanThisMonth = calculateStudentLoanForPeriod(earningsForNIAndLoan, taxYear, input);

        const takeHomeThisMonth = grossThisMonth - pensionThisMonth - taxThisMonth - nicThisMonth - studentLoanThisMonth;

        finalMonthlyBreakdown.push({
            month,
            gross: grossThisMonth,
            pension: pensionThisMonth,
            tax: taxThisMonth,
            nic: nicThisMonth,
            studentLoan: studentLoanThisMonth,
            takeHome: takeHomeThisMonth,
        });
    }

    const finalAnnualTakeHome = finalMonthlyBreakdown.reduce((acc, month) => acc + month.takeHome, 0);
    const finalAnnualTax = finalMonthlyBreakdown.reduce((acc, month) => acc + month.tax, 0);
    const finalAnnualNic = finalMonthlyBreakdown.reduce((acc, month) => acc + month.nic, 0);
    const finalAnnualStudentLoan = finalMonthlyBreakdown.reduce((acc, month) => acc + month.studentLoan, 0);
    const finalAnnualPension = finalMonthlyBreakdown.reduce((acc, month) => acc + month.pension, 0);
    
    return {
        grossAnnualIncome: grossAnnualIncome,
        annualTaxableIncome: annualTaxableIncome,
        annualTakeHome: finalAnnualTakeHome,
        annualTax: finalAnnualTax,
        annualNic: finalAnnualNic,
        annualStudentLoan: finalAnnualStudentLoan,
        annualPension: finalAnnualPension,
        personalAllowance: finalPersonalAllowance,
        effectiveTaxRate: grossAnnualIncome > 0 ? ((finalAnnualTax + finalAnnualNic) / grossAnnualIncome) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: finalAnnualTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: finalAnnualTax, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: finalAnnualNic, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: finalAnnualPension, fill: 'hsl(var(--chart-4))' },
            { name: 'Student Loan', value: finalAnnualStudentLoan, fill: 'hsl(var(--chart-5))' },
        ].filter(item => item.value > 0),
        monthlyBreakdown: finalMonthlyBreakdown,
    };
}
