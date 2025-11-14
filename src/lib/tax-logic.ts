
import type { Region, TaxCalculatorSchema, CalculationResults, MonthlyResult, TaxYear } from "@/lib/definitions";
import { months } from "@/lib/definitions";

// Tax Year Data based on user-provided and known information
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
      pt: 12570, // Primary Threshold (Annual)
      uel: 50270, // Upper Earnings Limit (Annual)
      rate1: 0.12, 
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
      pt: 12570,
      uel: 50270,
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
      pt: 12570,
      uel: 50270,
      rate1: 0.08,
      rate2: 0.02,
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
        return isNaN(num) ? 0 : num * 10;
    }
    
    return defaultAllowance;
}


function calculateAnnualPersonalAllowance(adjustedNetIncome: number, parsedAllowance: number, year: TaxYear): number {
    const { PA_TAPER_THRESHOLD, PERSONAL_ALLOWANCE_DEFAULT } = getTaxYearData(year);

    if (parsedAllowance < 0) {
        return parsedAllowance; // K codes are not tapered
    }
    
    // If the user's income is below the default allowance, they should get their full parsed allowance, unless it's tapered
    if (adjustedNetIncome <= PERSONAL_ALLOWANCE_DEFAULT) {
        return parsedAllowance;
    }

    if (adjustedNetIncome <= PA_TAPER_THRESHOLD) {
        return parsedAllowance;
    }

    const incomeOverThreshold = adjustedNetIncome - PA_TAPER_THRESHOLD;
    const reduction = Math.floor(incomeOverThreshold / 2);
    
    return Math.max(0, parsedAllowance - reduction);
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
        const bandThreshold = band.threshold === Infinity ? remainingIncome + previousThreshold : band.threshold;
        const taxableInBand = Math.min(remainingIncome, bandThreshold - previousThreshold);
        
        if (taxableInBand > 0) {
            tax += taxableInBand * band.rate;
            remainingIncome -= taxableInBand;
        }

        previousThreshold = bandThreshold;
        if (remainingIncome <= 0) break;
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

export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults {
    const { taxYear, salary, bonus = 0, pensionContribution, region, taxableBenefits = 0, taxCode, bonusPensionContribution = 0 } = input;
    const payRiseMonthIndex = input.hasPayRise ? months.indexOf(input.payRiseMonth) : 12;
    const bonusMonthIndex = bonus > 0 ? months.indexOf(input.bonusMonth) : -1;

    const taxYearConfig = getTaxYearData(taxYear);
    const parsedCodeAllowance = parseTaxCode(taxCode, taxYearConfig.PERSONAL_ALLOWANCE_DEFAULT);

    // --- 1. Calculate Annual Totals ---
    let annualGrossFromSalary = 0;
    const monthlySalaries: number[] = [];
    for (let i = 0; i < 12; i++) {
        const currentMonthlySalary = (i < payRiseMonthIndex) ? salary / 12 : (input.newSalary ?? salary) / 12;
        monthlySalaries.push(currentMonthlySalary);
        annualGrossFromSalary += currentMonthlySalary;
    }
    
    const annualGrossIncomeWithBonus = annualGrossFromSalary + bonus;
    
    const annualPensionFromSalary = annualGrossFromSalary * (pensionContribution / 100);
    const annualPensionFromBonus = bonus * (bonusPensionContribution / 100);
    const annualPension = annualPensionFromSalary + annualPensionFromBonus;

    const annualAdjustedNet = annualGrossIncomeWithBonus + taxableBenefits - annualPension;
    const finalPersonalAllowance = calculateAnnualPersonalAllowance(annualAdjustedNet, parsedCodeAllowance, taxYear);
    const annualTaxableIncome = Math.max(0, annualAdjustedNet - finalPersonalAllowance);
    
    // This is the correct total annual tax based on the final taxable income
    const totalAnnualTax = calculateTaxOnIncome(annualTaxableIncome, region, taxYear);

    // --- 2. Calculate Monthly Breakdown using a cumulative approach ---
    let cumulativeGrossYTD = 0;
    let cumulativePensionYTD = 0;
    let cumulativeTaxYTD = 0;
    const finalMonthlyBreakdown: MonthlyResult[] = [];
    
    for (let i = 0; i < 12; i++) {
        const month = months[i];
        const grossThisMonthFromSalary = monthlySalaries[i];
        const bonusThisMonth = (i === bonusMonthIndex) ? bonus : 0;
        const grossThisMonth = grossThisMonthFromSalary + bonusThisMonth;

        const pensionFromSalaryThisMonth = grossThisMonthFromSalary * (pensionContribution / 100);
        const pensionFromBonusThisMonth = bonusThisMonth * (bonusPensionContribution / 100);
        const pensionThisMonth = pensionFromSalaryThisMonth + pensionFromBonusThisMonth;

        // NIC is calculated on a non-cumulative, per-period basis
        const nicThisMonth = calculateNICForPeriod(grossThisMonth, taxYear);

        cumulativeGrossYTD += grossThisMonth;
        cumulativePensionYTD += pensionThisMonth;

        // Calculate tax on a cumulative basis
        const adjustedNetYTD = cumulativeGrossYTD + (taxableBenefits / 12 * (i + 1)) - cumulativePensionYTD;
        const personalAllowanceYTD = calculateAnnualPersonalAllowance(adjustedNetYTD * (12 / (i + 1)), parsedCodeAllowance, taxYear);
        const taxableIncomeYTD = Math.max(0, adjustedNetYTD - (personalAllowanceYTD / 12 * (i+1)));

        const totalTaxDueYTD = calculateTaxOnIncome(taxableIncomeYTD, region, taxYear);
        
        let taxThisMonth = totalTaxDueYTD - cumulativeTaxYTD;
        taxThisMonth = Math.max(0, taxThisMonth);
        cumulativeTaxYTD += taxThisMonth;

        const takeHomeThisMonth = grossThisMonth - pensionThisMonth - taxThisMonth - nicThisMonth;
        
        finalMonthlyBreakdown.push({
            month,
            gross: grossThisMonth,
            pension: pensionThisMonth,
            tax: taxThisMonth,
            nic: nicThisMonth,
            takeHome: takeHomeThisMonth,
        });
    }

    const finalAnnualTakeHome = finalMonthlyBreakdown.reduce((acc, month) => acc + month.takeHome, 0);
    const finalAnnualTax = finalMonthlyBreakdown.reduce((acc, month) => acc + month.tax, 0);
    const finalAnnualNic = finalMonthlyBreakdown.reduce((acc, month) => acc + month.nic, 0);

    const grossAnnualIncome = annualGrossIncomeWithBonus + taxableBenefits;
    
    return {
        grossAnnualIncome: grossAnnualIncome,
        annualTaxableIncome: annualTaxableIncome,
        annualTakeHome: finalAnnualTakeHome,
        annualTax: finalAnnualTax,
        annualNic: finalAnnualNic,
        annualPension: annualPension,
        personalAllowance: finalPersonalAllowance,
        effectiveTaxRate: grossAnnualIncome > 0 ? ((finalAnnualTax + finalAnnualNic) / grossAnnualIncome) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: finalAnnualTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: finalAnnualTax, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: finalAnnualNic, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: annualPension, fill: 'hsl(var(--chart-4))' },
        ],
        monthlyBreakdown: finalMonthlyBreakdown,
    };
}
