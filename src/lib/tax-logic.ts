
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

function parseTaxCode(taxCode: string, defaultAllowance: number): number {
    if (!taxCode) {
        return defaultAllowance;
    }
    const code = taxCode.toUpperCase().trim();
    
    // Non-cumulative codes
    if (['BR', 'D0', 'D1', '0T', 'NT'].includes(code)) {
        return 0;
    }
    // K codes mean income to be added to taxable pay
    if (code.startsWith('K')) {
        const numPart = parseInt(code.substring(1), 10);
        return isNaN(numPart) ? 0 : -(numPart * 10);
    }
    
    // Standard codes like 1257L
    const match = code.match(/^(\d+)[LMNPTY]$/);
    if (match) {
        const num = parseInt(match[1], 10);
        return num * 10;
    }
    
    return defaultAllowance;
}

function calculateAnnualPersonalAllowance(adjustedNetIncome: number, parsedAllowance: number, year: TaxYear): number {
    const { PA_TAPER_THRESHOLD } = getTaxYearData(year);

    if (adjustedNetIncome <= PA_TAPER_THRESHOLD) {
        return parsedAllowance > 0 ? parsedAllowance : 0;
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


function calculateNICForIncome(grossIncome: number, year: TaxYear): number {
    const { pt, uel, rate1, rate2 } = getTaxYearData(year).NIC_BANDS;
    
    const monthlyPT = pt / 12;
    const monthlyUEL = uel / 12;

    if (grossIncome <= monthlyPT) {
        return 0;
    }
    
    let nic = 0;
    
    if (grossIncome > monthlyPT) {
        const earningsInMainBand = Math.min(grossIncome, monthlyUEL) - monthlyPT;
        nic += Math.max(0, earningsInMainBand) * rate1;
    }
    
    if (grossIncome > monthlyUEL) {
        const earningsInUpperBand = grossIncome - monthlyUEL;
        nic += earningsInUpperBand * rate2;
    }

    return nic > 0 ? nic : 0;
}

export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults {
    const { taxYear, salary, bonus = 0, pensionContribution, region, taxableBenefits = 0 } = input;
    const payRiseMonthIndex = input.hasPayRise ? months.indexOf(input.payRiseMonth) : 12;
    const bonusMonthIndex = bonus > 0 ? months.indexOf(input.bonusMonth) : -1;

    // --- 1. Calculate Annual Totals ---
    let annualSalary = 0;
    const prePayRiseMonths = payRiseMonthIndex;
    const postPayRiseMonths = 12 - payRiseMonthIndex;

    if(input.hasPayRise && input.newSalary && input.newSalary > salary) {
        annualSalary = (salary / 12 * prePayRiseMonths) + (input.newSalary / 12 * postPayRiseMonths);
    } else {
        annualSalary = salary;
    }
    
    const grossAnnualIncome = annualSalary + bonus;
    const totalAnnualIncomeForTapering = grossAnnualIncome + taxableBenefits;

    const pensionableBonus = input.isBonusPensionable ? bonus * (input.pensionableBonusPercentage / 100) : 0;
    const annualPension = (annualSalary + pensionableBonus) * (pensionContribution / 100);
    
    const adjustedNetIncome = totalAnnualIncomeForTapering - annualPension;
    
    const defaultAllowance = getTaxYearData(taxYear).PERSONAL_ALLOWANCE_DEFAULT;
    const parsedAllowanceFromCode = parseTaxCode(input.taxCode, defaultAllowance);
    
    const finalPersonalAllowance = calculateAnnualPersonalAllowance(adjustedNetIncome, parsedAllowanceFromCode, taxYear);
    
    const annualTaxableIncome = Math.max(0, adjustedNetIncome - finalPersonalAllowance);
    
    const annualTax = calculateTaxOnIncome(annualTaxableIncome, region, taxYear);

    // --- 2. Calculate Monthly Breakdown ---
    let annualNic = 0;
    const monthlyBreakdown: MonthlyResult[] = [];
    const baseMonthlySalary = salary / 12;
    const newMonthlySalary = (input.hasPayRise && input.newSalary) ? input.newSalary / 12 : baseMonthlySalary;

    // Distribute tax evenly, but account for the bonus month
    const annualIncomeWithoutBonus = annualSalary + taxableBenefits;
    const annualPensionWithoutBonus = annualSalary * (pensionContribution / 100);
    const adjNetWithoutBonus = annualIncomeWithoutBonus - annualPensionWithoutBonus;
    const paWithoutBonus = calculateAnnualPersonalAllowance(adjNetWithoutBonus, parsedAllowanceFromCode, taxYear);
    const taxableWithoutBonus = Math.max(0, adjNetWithoutBonus - paWithoutBonus);
    const taxOnSalary = calculateTaxOnIncome(taxableWithoutBonus, region, taxYear);
    
    const bonusTax = annualTax - taxOnSalary;
    
    let standardMonthlyTax: number;
    if (input.hasPayRise && input.newSalary && input.newSalary > salary) {
        // This is complex; for now, we'll average the salary tax. A true cumulative calc is needed for perfection.
        standardMonthlyTax = taxOnSalary / 12;
    } else {
        standardMonthlyTax = taxOnSalary / 12;
    }


    for (let i = 0; i < 12; i++) {
        const currentMonthlySalary = i < payRiseMonthIndex ? baseMonthlySalary : newMonthlySalary;
        const bonusThisMonth = (i === bonusMonthIndex) ? bonus : 0;
        
        const grossThisMonth = currentMonthlySalary + bonusThisMonth;

        const pensionableBonusThisMonth = (i === bonusMonthIndex && input.isBonusPensionable) ? bonus * (input.pensionableBonusPercentage / 100) : 0;
        const pensionThisMonth = (currentMonthlySalary + pensionableBonusThisMonth) * (pensionContribution / 100);
        
        const nicThisMonth = calculateNICForIncome(grossThisMonth, taxYear);
        annualNic += nicThisMonth;

        let taxThisMonth = standardMonthlyTax;
        if (i === bonusMonthIndex) {
            taxThisMonth += bonusTax;
        }

        const takeHomeThisMonth = grossThisMonth - taxThisMonth - nicThisMonth - pensionThisMonth;

        monthlyBreakdown.push({
            month: months[i],
            gross: grossThisMonth,
            tax: taxThisMonth,
            nic: nicThisMonth,
            pension: pensionThisMonth,
            takeHome: takeHomeThisMonth,
        });
    }

    const finalAnnualTakeHome = monthlyBreakdown.reduce((sum, month) => sum + month.takeHome, 0);

    return {
        grossAnnualIncome: totalAnnualIncomeForTapering, // Reflects benefits for display
        annualTaxableIncome: annualTaxableIncome,
        annualTakeHome: finalAnnualTakeHome,
        annualTax: annualTax,
        annualNic: annualNic,
        annualPension: annualPension,
        personalAllowance: finalPersonalAllowance,
        effectiveTaxRate: grossAnnualIncome > 0 ? ((annualTax + annualNic) / grossAnnualIncome) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: finalAnnualTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: annualTax, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: annualNic, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: annualPension, fill: 'hsl(var(--chart-4))' },
        ],
        monthlyBreakdown,
    };
}

    