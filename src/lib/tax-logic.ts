
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
    
    // K codes mean income to be added to taxable pay
    const kCodeMatch = code.match(/^K(\d+)/);
    if (kCodeMatch) {
        const num = parseInt(kCodeMatch[1], 10);
        return isNaN(num) ? 0 : -(num * 10);
    }
    
    // Standard codes like 1257L
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

    // Ensure bands are sorted by threshold
    const bands = Object.values(taxBandsData).sort((a, b) => a.threshold - b.threshold);

    let tax = 0;
    let income = taxableIncome;
    let previousThreshold = 0;

    for (const band of bands) {
        if (income <= 0) break;
        
        const bandWidth = band.threshold === Infinity ? Infinity : band.threshold - previousThreshold;
        
        const taxableInBand = Math.min(income, bandWidth);
        tax += taxableInBand * band.rate;
        income -= taxableInBand;

        if (band.threshold !== Infinity) {
            previousThreshold = band.threshold;
        }
    }

    return tax;
}


function calculateNICForPeriod(grossIncomeForPeriod: number, year: TaxYear): number {
    const { pt, uel, rate1, rate2 } = getTaxYearData(year).NIC_BANDS;
    
    // Using monthly thresholds for per-pay-period calculation
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
    const { taxYear, salary, bonus = 0, pensionContribution, region, taxableBenefits = 0, taxCode } = input;
    const payRiseMonthIndex = input.hasPayRise ? months.indexOf(input.payRiseMonth) : 12;
    const bonusMonthIndex = bonus > 0 ? months.indexOf(input.bonusMonth) : -1;

    const monthlyBreakdown: MonthlyResult[] = [];
    
    let totalGrossYTD = 0;
    let totalPensionYTD = 0;
    let totalTaxYTD = 0;
    let totalNicYTD = 0;
    
    const baseMonthlySalary = salary / 12;
    const newMonthlySalary = (input.hasPayRise && input.newSalary) ? input.newSalary / 12 : baseMonthlySalary;

    const taxYearConfig = getTaxYearData(taxYear);
    const parsedCodeAllowance = parseTaxCode(taxCode, taxYearConfig.PERSONAL_ALLOWANCE_DEFAULT);

    for (let i = 0; i < 12; i++) {
        const monthIndex = i;
        const currentMonthNumber = monthIndex + 1;
        
        const currentMonthlySalary = monthIndex < payRiseMonthIndex ? baseMonthlySalary : newMonthlySalary;
        const bonusThisMonth = (monthIndex === bonusMonthIndex) ? bonus : 0;
        
        const grossThisMonth = currentMonthlySalary + bonusThisMonth;
        totalGrossYTD += grossThisMonth;
        
        const isBonusPensionable = (monthIndex === bonusMonthIndex) && input.isBonusPensionable;
        const pensionableBonusThisMonth = isBonusPensionable ? bonus * (input.pensionableBonusPercentage / 100) : 0;
        const pensionablePayThisMonth = currentMonthlySalary + pensionableBonusThisMonth;
        const pensionThisMonth = pensionablePayThisMonth * (pensionContribution / 100);
        totalPensionYTD += pensionThisMonth;

        const taxableBenefitsThisMonth = taxableBenefits / 12;
        
        // Cumulative calculations for tax
        const grossForTaxYTD = totalGrossYTD + (taxableBenefitsThisMonth * currentMonthNumber);
        
        const adjustedNetIncomeYTD = grossForTaxYTD - totalPensionYTD;
        const projectedAdjustedNetIncome = adjustedNetIncomeYTD / currentMonthNumber * 12;
        
        const paForYear = calculateAnnualPersonalAllowance(projectedAdjustedNetIncome, parsedCodeAllowance, taxYear);
        const paYTD = paForYear * currentMonthNumber / 12;

        const taxableIncomeYTD = Math.max(0, adjustedNetIncomeYTD - paYTD);

        const totalTaxDueYTD = calculateTaxOnIncome(taxableIncomeYTD, region, taxYear);
        const taxThisMonth = totalTaxDueYTD - totalTaxYTD;
        totalTaxYTD = totalTaxDueYTD;

        // Non-cumulative NI calculation
        const nicThisMonth = calculateNICForPeriod(grossThisMonth, taxYear);
        totalNicYTD += nicThisMonth;

        const takeHomeThisMonth = grossThisMonth - pensionThisMonth - taxThisMonth - nicThisMonth;

        monthlyBreakdown.push({
            month: months[monthIndex],
            gross: grossThisMonth,
            pension: pensionThisMonth,
            tax: taxThisMonth,
            nic: nicThisMonth,
            takeHome: takeHomeThisMonth,
        });
    }

    const annualGrossIncome = totalGrossYTD;
    const finalAnnualTakeHome = annualGrossIncome - totalPensionYTD - totalTaxYTD - totalNicYTD;
    const annualAdjustedNet = annualGrossIncome + taxableBenefits - totalPensionYTD;
    const finalPersonalAllowance = calculateAnnualPersonalAllowance(annualAdjustedNet, parsedCodeAllowance, taxYear);

    return {
        grossAnnualIncome: annualGrossIncome + taxableBenefits, // Display total including benefits
        annualTaxableIncome: Math.max(0, annualAdjustedNet - finalPersonalAllowance),
        annualTakeHome: finalAnnualTakeHome,
        annualTax: totalTaxYTD,
        annualNic: totalNicYTD,
        annualPension: totalPensionYTD,
        personalAllowance: finalPersonalAllowance,
        effectiveTaxRate: (annualGrossIncome + taxableBenefits) > 0 ? ((totalTaxYTD + totalNicYTD) / (annualGrossIncome + taxableBenefits)) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: finalAnnualTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: totalTaxYTD, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: totalNicYTD, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: totalPensionYTD, fill: 'hsl(var(--chart-4))' },
        ],
        monthlyBreakdown,
    };
}
    

    