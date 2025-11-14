
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
    const { PA_TAPER_THRESHOLD } = getTaxYearData(year);

    if (parsedAllowance < 0) {
        return parsedAllowance; // K codes are not tapered
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
    
    const annualGrossIncome = annualGrossFromSalary + bonus;
    
    const annualPensionFromSalary = annualGrossFromSalary * (pensionContribution / 100);
    const annualPensionFromBonus = bonus * (bonusPensionContribution / 100);
    const annualPension = annualPensionFromSalary + annualPensionFromBonus;

    // Correctly calculate adjusted net income by subtracting pension contributions from gross income
    const annualAdjustedNet = annualGrossIncome + taxableBenefits - annualPension;
    const finalPersonalAllowance = calculateAnnualPersonalAllowance(annualAdjustedNet, parsedCodeAllowance, taxYear);
    const annualTaxableIncome = Math.max(0, annualAdjustedNet - finalPersonalAllowance);
    const annualTax = calculateTaxOnIncome(annualTaxableIncome, region, taxYear);
    
    let annualNicTotal = 0;
    let annualTaxTotal = 0;
    const finalMonthlyBreakdown: MonthlyResult[] = [];

    for (let i = 0; i < 12; i++) {
        const month = months[i];
        const grossThisMonthFromSalary = monthlySalaries[i];
        const bonusThisMonth = (i === bonusMonthIndex) ? bonus : 0;
        const grossThisMonth = grossThisMonthFromSalary + bonusThisMonth;

        const pensionFromSalaryThisMonth = grossThisMonthFromSalary * (pensionContribution / 100);
        const pensionFromBonusThisMonth = bonusThisMonth * (bonusPensionContribution / 100);
        const pensionThisMonth = pensionFromSalaryThisMonth + pensionFromBonusThisMonth;

        // NIC is calculated on gross pay before salary sacrifice for pension
        const nicThisMonth = calculateNICForPeriod(grossThisMonth, taxYear);
        annualNicTotal += nicThisMonth;
        
        // This is a simple apportionment of annual tax. For more accuracy, a proper PAYE calculation would be needed.
        // We will now calculate tax on a monthly basis to handle 100% sacrifice cases correctly.
        const adjustedNetThisMonth = (grossThisMonth - pensionThisMonth) + (taxableBenefits / 12);
        const personalAllowanceThisMonth = finalPersonalAllowance / 12;
        const taxableIncomeThisMonth = Math.max(0, adjustedNetThisMonth - personalAllowanceThisMonth);

        // To estimate monthly tax, we can't just call calculateTaxOnIncome as it uses annual bands.
        // A simple but more correct approach is to check if taxable income is zero.
        // A more complex approach would involve annualizing the monthly income, which is too complex for this estimation.
        // Let's use the annual tax figure and distribute it, but zero it out if the monthly income is zero after pension.
        let taxThisMonth = 0;
        if (annualTaxableIncome > 0) {
            // A simple ratio of this month's taxable income to the annual total.
            // This is still an estimate.
            const monthRatio = taxableIncomeThisMonth / annualTaxableIncome;
            taxThisMonth = annualTax * monthRatio;

             // If this month has the bonus, the tax will be higher
            if (i === bonusMonthIndex && bonus > 0) {
                // To avoid complexity, we'll keep the previous bonus tax logic as a fallback for bonus months.
                const adjustedNetForSalary = annualGrossFromSalary - annualPensionFromSalary + taxableBenefits;
                const paForSalary = calculateAnnualPersonalAllowance(adjustedNetForSalary, parsedCodeAllowance, taxYear);
                const taxableSalary = Math.max(0, adjustedNetForSalary - paForSalary);
                const taxOnSalary = calculateTaxOnIncome(taxableSalary, region, taxYear);
                
                const taxOnBonus = annualTax - taxOnSalary;
                const regularMonthlyTax = taxOnSalary / 12;

                if (i === bonusMonthIndex) {
                    taxThisMonth = regularMonthlyTax + taxOnBonus;
                } else {
                    taxThisMonth = regularMonthlyTax;
                }
            }
        }
       
        // Ensure tax isn't negative or calculated on zero income
        if (taxableIncomeThisMonth <= 0) {
            taxThisMonth = 0;
        }

        annualTaxTotal += taxThisMonth;
        
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
    
    return {
        grossAnnualIncome: annualGrossIncome + taxableBenefits,
        annualTaxableIncome: annualTaxableIncome,
        annualTakeHome: finalAnnualTakeHome,
        annualTax: finalAnnualTax,
        annualNic: annualNicTotal,
        annualPension: annualPension,
        personalAllowance: finalPersonalAllowance,
        effectiveTaxRate: (annualGrossIncome + taxableBenefits) > 0 ? ((finalAnnualTax + annualNicTotal) / (annualGrossIncome + taxableBenefits)) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: finalAnnualTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: finalAnnualTax, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: annualNicTotal, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: annualPension, fill: 'hsl(var(--chart-4))' },
        ],
        monthlyBreakdown: finalMonthlyBreakdown,
    };
}
