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
    NIC_BANDS: {
      primaryThreshold: 12570,
      upperEarningsLimit: 50270,
      rate1: 0.115, 
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
  "2025/26": { 
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

    if (advanced && top) { 
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
    } else { 
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

function calculateNIC(grossIncome: number, year: TaxYear): number {
  const { NIC_BANDS } = getTaxYearData(year);
  if (grossIncome <= 0) return 0;

  const annualisedGross = grossIncome * 12;
  if (annualisedGross <= NIC_BANDS.primaryThreshold) return 0;
  
  let nic = 0;
  const incomeOverPT = grossIncome - (NIC_BANDS.primaryThreshold / 12);
  const incomeUpToUEL = Math.min(incomeOverPT, (NIC_BANDS.upperEarningsLimit / 12) - (NIC_BANDS.primaryThreshold / 12));

  nic += Math.max(0, incomeUpToUEL * NIC_BANDS.rate1);

  if (grossIncome > (NIC_BANDS.upperEarningsLimit / 12)) {
    const incomeOverUEL = grossIncome - (NIC_BANDS.upperEarningsLimit / 12);
    nic += incomeOverUEL * NIC_BANDS.rate2;
  }
  
  return nic;
}


export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults {
    const payRiseMonthIndex = input.hasPayRise ? months.indexOf(input.payRiseMonth) : 12;
    const bonusMonthIndex = months.indexOf(input.bonusMonth);

    let annualSalary = input.salary;
    if (input.hasPayRise && input.newSalary) {
      const monthsAtOldSalary = payRiseMonthIndex;
      const monthsAtNewSalary = 12 - payRiseMonthIndex;
      annualSalary = (input.salary / 12 * monthsAtOldSalary) + (input.newSalary / 12 * monthsAtNewSalary);
    }
    
    const grossAnnualIncome = annualSalary + (input.bonus ?? 0);
    const totalPensionableSalary = annualSalary;
    const pensionableBonus = input.isBonusPensionable && input.bonus ? input.bonus * (input.pensionableBonusPercentage / 100) : 0;
    const totalPensionableIncome = totalPensionableSalary + pensionableBonus;

    const annualPensionContribution = totalPensionableIncome * (input.pensionContribution / 100);

    const adjustedNetIncome = grossAnnualIncome + (input.taxableBenefits ?? 0) - annualPensionContribution;
    const personalAllowance = calculatePersonalAllowance(adjustedNetIncome, input.taxCode, input.taxYear);
    
    const annualTaxableIncome = Math.max(0, adjustedNetIncome - personalAllowance);
    const annualTax = calculateIncomeTax(annualTaxableIncome, input.region, input.taxYear);

    const monthlyBreakdown: MonthlyResult[] = [];
    let cumulativeGross = 0;
    let cumulativeTax = 0;
    let cumulativeNic = 0;
    let cumulativePension = 0;

    months.forEach((month, index) => {
        const currentAnnualSalary = (input.hasPayRise && input.newSalary && index >= payRiseMonthIndex) 
            ? input.newSalary 
            : input.salary;

        let monthlySalary = currentAnnualSalary / 12;
        
        let backPay = 0;
        if(input.hasPayRise && input.newSalary && index === payRiseMonthIndex && payRiseMonthIndex > 0) {
            const salaryDifference = (input.newSalary - input.salary) / 12;
            backPay = salaryDifference * payRiseMonthIndex;
        }

        const currentMonthBonus = index === bonusMonthIndex ? (input.bonus ?? 0) : 0;
        const currentMonthGross = monthlySalary + backPay + currentMonthBonus;

        const pensionableSalary = monthlySalary + backPay;
        const currentPensionableBonus = index === bonusMonthIndex && input.isBonusPensionable ? currentMonthBonus * (input.pensionableBonusPercentage / 100) : 0;
        const currentPensionableIncome = pensionableSalary + currentPensionableBonus;
        const currentMonthPension = currentPensionableIncome * (input.pensionContribution / 100);

        const taxableBenefitsThisMonth = (input.taxableBenefits ?? 0) / 12;

        cumulativeGross += currentMonthGross;
        cumulativePension += currentMonthPension;

        const cumulativeTaxableIncome = Math.max(0, (cumulativeGross + (taxableBenefitsThisMonth * (index + 1))) - cumulativePension - (personalAllowance/12 * (index+1)));
        const ytdTax = calculateIncomeTax(cumulativeTaxableIncome, input.region, input.taxYear);
        const currentMonthTax = Math.max(0, ytdTax - cumulativeTax);
        cumulativeTax += currentMonthTax;
        
        const currentMonthNic = calculateNIC(currentMonthGross, input.taxYear);
        cumulativeNic += currentMonthNic;
        
        const takeHome = currentMonthGross - currentMonthTax - currentMonthNic - currentMonthPension;

        monthlyBreakdown.push({
            month,
            gross: currentMonthGross,
            pension: currentMonthPension,
            tax: currentMonthTax,
            nic: currentMonthNic,
            takeHome: takeHome,
        });
    });
    
    const finalGross = monthlyBreakdown.reduce((sum, m) => sum + m.gross, 0);
    const finalTax = monthlyBreakdown.reduce((sum, m) => sum + m.tax, 0);
    const finalNic = monthlyBreakdown.reduce((sum, m) => sum + m.nic, 0);
    const finalPension = monthlyBreakdown.reduce((sum, m) => sum + m.pension, 0);
    const finalTakeHome = monthlyBreakdown.reduce((sum, m) => sum + m.takeHome, 0);

    return {
        grossAnnualIncome: finalGross,
        annualTakeHome: finalTakeHome,
        annualTax: finalTax,
        annualNic: finalNic,
        annualPension: finalPension,
        effectiveTaxRate: finalGross > 0 ? ((finalTax + finalNic) / finalGross) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: finalTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: finalTax, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: finalNic, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: finalPension, fill: 'hsl(var(--chart-4))' },
        ],
        monthlyBreakdown,
    };
}

    