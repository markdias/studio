import type { Region, TaxCalculatorSchema, CalculationResults, MonthlyResult, TaxYear } from "@/lib/definitions";
import { months } from "@/lib/definitions";

// Tax Year Data
const taxYearData = {
  "2023/24": {
    PERSONAL_ALLOWANCE_DEFAULT: 12570,
    PA_TAPER_THRESHOLD: 100000,
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
    NIC_BANDS: { // Blended rate for 23/24 (12% -> 10% from Jan 24)
      primaryThreshold: 12570,
      upperEarningsLimit: 50270,
      rate1: 0.115, // Approximate blended annual rate
      rate2: 0.02,
    },
  },
  "2024/25": {
    PERSONAL_ALLOWANCE_DEFAULT: 12570,
    PA_TAPER_THRESHOLD: 100000,
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
      primaryThreshold: 12570,
      upperEarningsLimit: 50270,
      rate1: 0.08,
      rate2: 0.02,
    },
  },
  "2025/26": { // Assumed figures, may need updating
    PERSONAL_ALLOWANCE_DEFAULT: 12570,
    PA_TAPER_THRESHOLD: 100000,
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
      primaryThreshold: 12570,
      upperEarningsLimit: 50270,
      rate1: 0.08, 
      rate2: 0.02,
    },
  }
};

function getTaxYearData(year: TaxYear) {
  return taxYearData[year];
}


function parseTaxCode(taxCode: string, year: TaxYear): number {
    const { PERSONAL_ALLOWANCE_DEFAULT } = getTaxYearData(year);
    const matches = taxCode.match(/^(\d+)/);
    if (matches && matches[1]) {
        return parseInt(matches[1], 10) * 10;
    }
    if (taxCode.toUpperCase().startsWith('K')) {
        return 0;
    }
    if (taxCode.toUpperCase() === 'BR' || taxCode.toUpperCase() === 'D0' || taxCode.toUpperCase() === 'D1') {
        return 0;
    }
    return PERSONAL_ALLOWANCE_DEFAULT;
}


function calculatePersonalAllowance(adjustedNetIncome: number, taxCode: string, year: TaxYear): number {
  const { PA_TAPER_THRESHOLD } = getTaxYearData(year);
  const baseAllowance = parseTaxCode(taxCode, year);
  if (adjustedNetIncome <= PA_TAPER_THRESHOLD) {
    return baseAllowance;
  }
  const taperedAmount = Math.max(0, (adjustedNetIncome - PA_TAPER_THRESHOLD) / 2);
  return Math.max(0, baseAllowance - taperedAmount);
}

function calculateIncomeTax(taxableIncome: number, region: Region, year: TaxYear): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  const { ENGLAND_WALES_NI_BANDS, SCOTLAND_BANDS } = getTaxYearData(year);

  if (region === 'Scotland') {
    let income = taxableIncome;
    const { starter, basic, intermediate, higher, advanced, top } = SCOTLAND_BANDS;

    if (advanced && top) { // For 2024/25 structure
        tax += Math.min(income, starter.threshold) * starter.rate;
        income -= starter.threshold;
        if (income > 0) {
            tax += Math.min(income, basic.threshold - starter.threshold) * basic.rate;
            income -= (basic.threshold - starter.threshold);
        }
        if (income > 0) {
            tax += Math.min(income, intermediate.threshold - basic.threshold) * intermediate.rate;
            income -= (intermediate.threshold - basic.threshold);
        }
        if (income > 0) {
            tax += Math.min(income, higher.threshold - intermediate.threshold) * higher.rate;
            income -= (higher.threshold - intermediate.threshold);
        }
        if (income > 0) {
            tax += Math.min(income, advanced.threshold - higher.threshold) * advanced.rate;
            income -= (advanced.threshold - higher.threshold);
        }
        if (income > 0) {
            tax += income * top.rate;
        }
    } else { // For 2023/24 structure
        tax += Math.min(income, starter.threshold) * starter.rate;
        income -= starter.threshold;
        if (income > 0) {
            tax += Math.min(income, basic.threshold - starter.threshold) * basic.rate;
            income -= (basic.threshold - starter.threshold);
        }
        if (income > 0) {
            tax += Math.min(income, intermediate.threshold - basic.threshold) * intermediate.rate;
            income -= (intermediate.threshold - basic.threshold);
        }
        if (income > 0) {
            tax += Math.min(income, higher.threshold - intermediate.threshold) * higher.rate;
            income -= (higher.threshold - intermediate.threshold);
        }
        if (income > 0 && top) {
            tax += income * top.rate;
        }
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

function calculateNIC(grossAnnualIncome: number, year: TaxYear): number {
  const { NIC_BANDS } = getTaxYearData(year);
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
    const payRiseMonthIndex = input.hasPayRise ? months.indexOf(input.payRiseMonth) : -1;
    let annualSalary = input.salary;

    if (input.hasPayRise && input.newSalary && payRiseMonthIndex !== -1) {
        const monthsAtOldSalary = payRiseMonthIndex;
        const monthsAtNewSalary = 12 - payRiseMonthIndex;
        annualSalary = (input.salary / 12 * monthsAtOldSalary) + (input.newSalary / 12 * monthsAtNewSalary);
    }

    const grossAnnualIncome = annualSalary + (input.bonus ?? 0);
    const incomeForTaxPurposes = grossAnnualIncome + (input.taxableBenefits ?? 0);
    const monthlyBenefit = (input.taxableBenefits ?? 0) / 12;
    
    // Monthly breakdown
    const monthlyBreakdown: MonthlyResult[] = [];
    
    let cumulativeTax = 0;
    let cumulativeNic = 0;
    let cumulativeGross = 0;
    let cumulativePension = 0;
    let totalPensionableIncome = 0;
    
    // First pass to calculate total pensionable income for the year
    months.forEach((month, index) => {
        const currentSalary = (input.hasPayRise && input.newSalary && index >= payRiseMonthIndex) ? input.newSalary : input.salary;
        const monthlySalary = currentSalary / 12;
        const isBonusMonth = month === input.bonusMonth && (input.bonus ?? 0) > 0;
        const currentMonthBonus = isBonusMonth ? (input.bonus ?? 0) : 0;
        const pensionableBonus = input.isBonusPensionable ? currentMonthBonus * (input.pensionableBonusPercentage / 100) : 0;
        totalPensionableIncome += monthlySalary + pensionableBonus;
    });

    const annualPension = totalPensionableIncome * (input.pensionContribution / 100);

    const adjustedNetIncome = incomeForTaxPurposes - annualPension;
    const personalAllowance = calculatePersonalAllowance(adjustedNetIncome, input.taxCode, input.taxYear);

    // Second pass to calculate monthly breakdown
    months.forEach((month, index) => {
        const currentSalary = (input.hasPayRise && input.newSalary && index >= payRiseMonthIndex) ? input.newSalary : input.salary;
        const monthlySalary = currentSalary / 12;
        const isBonusMonth = month === input.bonusMonth && (input.bonus ?? 0) > 0;
        const currentMonthBonus = isBonusMonth ? (input.bonus ?? 0) : 0;
        
        let backPay = 0;
        if(input.hasPayRise && input.newSalary && index === payRiseMonthIndex && payRiseMonthIndex > 0) {
            const salaryDifference = (input.newSalary - input.salary) / 12;
            backPay = salaryDifference * payRiseMonthIndex;
        }
        
        const currentMonthGross = monthlySalary + currentMonthBonus + backPay;
        
        const currentPensionableBonus = isBonusMonth && input.isBonusPensionable ? currentMonthBonus * (input.pensionableBonusPercentage / 100) : 0;
        const currentPensionableSalary = monthlySalary + backPay; // Backpay is often pensionable
        const currentPensionableIncome = currentPensionableSalary + currentPensionableBonus;
        const currentMonthPension = currentPensionableIncome * (input.pensionContribution / 100);

        const currentMonthBenefit = monthlyBenefit;
        
        const yearToDateGross = cumulativeGross + currentMonthGross;
        const yearToDatePension = cumulativePension + currentMonthPension;
        const yearToDateIncomeForTax = yearToDateGross + (currentMonthBenefit * (index + 1));
        
        const yearToDateAllowance = (personalAllowance / 12) * (index + 1);
        const yearToDateTaxable = Math.max(0, yearToDateIncomeForTax - yearToDatePension - yearToDateAllowance);
        
        const yearToDateTax = calculateIncomeTax(yearToDateTaxable, input.region, input.taxYear);
        const currentMonthTax = Math.max(0, yearToDateTax - cumulativeTax);

        const yearToDateNic = calculateNIC(yearToDateGross, input.taxYear);
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

    const accurateAnnualTax = monthlyBreakdown.reduce((acc, month) => acc + month.tax, 0);
    const accurateAnnualNic = monthlyBreakdown.reduce((acc, month) => acc + month.nic, 0);
    const accurateAnnualPension = monthlyBreakdown.reduce((acc, month) => acc + month.pension, 0);
    const accurateAnnualTakeHome = monthlyBreakdown.reduce((acc, month) => acc + month.takeHome, 0);
    const accurateGrossAnnualIncome = monthlyBreakdown.reduce((acc, month) => acc + month.gross, 0);

    return {
        grossAnnualIncome: accurateGrossAnnualIncome,
        annualTakeHome: accurateAnnualTakeHome,
        annualTax: accurateAnnualTax,
        annualNic: accurateAnnualNic,
        annualPension: accurateAnnualPension,
        effectiveTaxRate: accurateGrossAnnualIncome > 0 ? ((accurateAnnualTax + accurateAnnualNic) / accurateGrossAnnualIncome) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: accurateAnnualTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: accurateAnnualTax, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: accurateAnnualNic, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: accurateAnnualPension, fill: 'hsl(var(--chart-4))' },
        ],
        monthlyBreakdown,
    };
}
