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
      rate1: 0.12, // Jan-Mar 2024 was 10%, but most of year was 12%
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

  const bands = region === 'Scotland' ? SCOTLAND_BANDS : ENGLAND_WALES_NI_BANDS;

  let remainingIncome = taxableIncome;
  
  if (region === 'Scotland') {
    const { starter, basic, intermediate, higher, advanced, top } = SCOTLAND_BANDS;
    const scottishBands = [
        { limit: starter.threshold, rate: starter.rate },
        { limit: basic.threshold, rate: basic.rate },
        { limit: intermediate.threshold, rate: intermediate.rate },
        { limit: higher.threshold, rate: higher.rate },
        { limit: advanced ? advanced.threshold : higher.threshold, rate: advanced ? advanced.rate : top.rate },
        { limit: Infinity, rate: top.rate }
    ];

    let lastLimit = 0;
    for (const band of scottishBands) {
      if (remainingIncome <= 0) break;
      const taxableInBand = Math.min(remainingIncome, band.limit - lastLimit);
      tax += taxableInBand * band.rate;
      remainingIncome -= taxableInBand;
      lastLimit = band.limit;
    }

  } else {
    // England, Wales, NI
    const { basic, higher, additional } = ENGLAND_WALES_NI_BANDS;
    const ewniBands = [
        { limit: basic.threshold, rate: basic.rate },
        { limit: higher.threshold, rate: higher.rate },
        { limit: Infinity, rate: additional.rate }
    ];
    
    let lastLimit = 0;
    for (const band of ewniBands) {
      if (remainingIncome <= 0) break;
      const taxableInBand = Math.min(remainingIncome, band.limit - lastLimit);
      tax += taxableInBand * band.rate;
      remainingIncome -= taxableInBand;
      lastLimit = band.limit;
    }
  }

  return tax;
}

function calculateNICForIncome(income: number, year: TaxYear): number {
    const { NIC_BANDS } = getTaxYearData(year);
    if (income <= NIC_BANDS.primaryThreshold) {
        return 0;
    }

    let nic = 0;
    const incomeOverPT = income - NIC_BANDS.primaryThreshold;
    const incomeUpToUEL = Math.min(incomeOverPT, NIC_BANDS.upperEarningsLimit - NIC_BANDS.primaryThreshold);
    
    nic += incomeUpToUEL * NIC_BANDS.rate1;

    if (income > NIC_BANDS.upperEarningsLimit) {
        const incomeOverUEL = income - NIC_BANDS.upperEarningsLimit;
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
    
    const annualTaxableIncome = Math.max(0, grossAnnualIncome + (input.taxableBenefits ?? 0) - annualPensionContribution - personalAllowance);
    const annualTax = calculateIncomeTax(annualTaxableIncome, input.region, input.taxYear);

    const annualNic = calculateNICForIncome(grossAnnualIncome, input.taxYear);
    
    const annualTakeHome = grossAnnualIncome - annualTax - annualNic - annualPensionContribution;
    
    const monthlyBreakdown: MonthlyResult[] = [];

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
        
        // Apportion annual tax/nic and then add bonus tax/nic in the bonus month
        let regularMonthlyTax = 0;
        let regularMonthlyNic = 0;

        if (annualSalary > 0) {
          const annualTaxOnSalary = calculateIncomeTax(Math.max(0, (annualSalary + (input.taxableBenefits ?? 0) - annualPensionContribution) - personalAllowance), input.region, input.taxYear);
          const annualNicOnSalary = calculateNICForIncome(annualSalary, input.taxYear);
          regularMonthlyTax = annualTaxOnSalary / 12;
          regularMonthlyNic = annualNicOnSalary / 12;
        }

        let bonusTax = 0;
        let bonusNic = 0;
        if (currentMonthBonus > 0) {
           const taxOnTotal = calculateIncomeTax(annualTaxableIncome, input.region, input.taxYear);
           const taxOnSalary = calculateIncomeTax(Math.max(0, (annualSalary + (input.taxableBenefits ?? 0) - annualPensionContribution) - personalAllowance), input.region, input.taxYear);
           bonusTax = taxOnTotal - taxOnSalary;
           
           const nicOnTotal = calculateNICForIncome(grossAnnualIncome, input.taxYear);
           const nicOnSalary = calculateNICForIncome(annualSalary, input.taxYear);
           bonusNic = nicOnTotal - nicOnSalary;
        }

        const currentMonthTax = regularMonthlyTax + bonusTax;
        const currentMonthNic = regularMonthlyNic + bonusNic;
        
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
    
    // Recalculate totals from the monthly breakdown to ensure consistency
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
