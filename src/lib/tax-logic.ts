
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
      pt: 12570, // Primary Threshold
      uel: 50270, // Upper Earnings Limit
      rate1: 0.12, 
      rate2: 0.02,
    },
  },
  "2024/25": {
    PERSONAL_ALLOWANCE_DEFAULT: 12570,
    PA_TAPER_THRESHOLD: 100000,
    ENGLAND_WALES_NI_BANDS: {
      basic: { rate: 0.20, threshold: 37700 }, // Taxable income up to 37,700
      higher: { rate: 0.40, threshold: 125140 }, // Taxable income 37,701 to 125,140
      additional: { rate: 0.45, threshold: Infinity }, // Taxable income above 125,140
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

function getTaxYearData(year: TaxYear) {
  return taxYearData[year];
}

function parseTaxCode(taxCode: string): { personalAllowance: number, isKCode: boolean, isFlatRate: boolean, code: string } {
    const code = taxCode.toUpperCase().trim();
    const matches = code.match(/^(\d+)/);
    const flatRateCodes = ['BR', 'D0', 'D1', '0T', 'NT'];

    if (flatRateCodes.includes(code)) {
        return { personalAllowance: 0, isKCode: false, isFlatRate: true, code };
    }

    if (code.startsWith('K')) {
        const numPart = parseInt(code.substring(1), 10);
        if (!isNaN(numPart)) {
            // A K-code adds income to be taxed, it doesn't represent an allowance
            return { personalAllowance: -(numPart * 10), isKCode: true, isFlatRate: false, code };
        }
    }
    
    if (matches && matches[1]) {
        const num = parseInt(matches[1], 10);
        const suffix = code.charAt(matches[1].length);
        if (['L', 'M', 'N', 'T', 'H'].includes(suffix)) {
            return { personalAllowance: num * 10, isKCode: false, isFlatRate: false, code };
        }
    }
    
    // Default to a standard allowance if code is unrecognized but looks like a standard code
    if (matches && matches[1]) {
        return { personalAllowance: parseInt(matches[1], 10) * 10, isKCode: false, isFlatRate: false, code };
    }

    return { personalAllowance: 0, isKCode: false, isFlatRate: true, code: '0T' };
}

function calculateAnnualPersonalAllowance(adjustedNetIncome: number, taxCode: string, year: TaxYear): number {
  const { PERSONAL_ALLOWANCE_DEFAULT, PA_TAPER_THRESHOLD } = getTaxYearData(year);
  const { personalAllowance: parsedAllowance, isKCode, isFlatRate } = parseTaxCode(taxCode);
  
  // If flat rate, K code, or 0T, the concept of a PA to be tapered doesn't apply in the same way.
  if (isFlatRate || isKCode || parsedAllowance === 0) {
    return parsedAllowance; // Will be 0 or negative
  }
  
  const allowanceToTaper = parsedAllowance;

  if (adjustedNetIncome <= PA_TAPER_THRESHOLD) {
    return allowanceToTaper;
  }
  
  const incomeOverThreshold = adjustedNetIncome - PA_TAPER_THRESHOLD;
  const reduction = Math.floor(incomeOverThreshold / 2);
  
  return Math.max(0, allowanceToTaper - reduction);
}


function calculateTaxOnIncome(taxableIncome: number, region: Region, year: TaxYear): number {
    const taxBandsData = region === 'Scotland' 
        ? taxYearData[year].SCOTLAND_BANDS 
        : taxYearData[year].ENGLAND_WALES_NI_BANDS;

    const bands = Object.values(taxBandsData)
        .sort((a, b) => a.threshold - b.threshold);

    let tax = 0;
    let income = taxableIncome;
    let previousThreshold = 0;

    for (const band of bands) {
        if (income <= 0) break;
        const bandWidth = band.threshold - previousThreshold;
        const taxableInBand = Math.min(income, bandWidth);
        tax += taxableInBand * band.rate;
        income -= taxableInBand;
        previousThreshold = band.threshold;
    }
    
    return tax;
}


function calculateNICForPayPeriod(periodIncome: number, year: TaxYear): number {
    const { pt, uel, rate1, rate2 } = getTaxYearData(year).NIC_BANDS;
    const ptMonthly = pt / 12;
    const uelMonthly = uel / 12;

    if (periodIncome <= ptMonthly) {
        return 0;
    }
    
    let nic = 0;
    
    if (periodIncome > ptMonthly) {
        const earningsInMainBand = Math.min(periodIncome, uelMonthly) - ptMonthly;
        nic += Math.max(0, earningsInMainBand) * rate1;
    }
    
    if (periodIncome > uelMonthly) {
        const earningsInUpperBand = periodIncome - uelMonthly;
        nic += earningsInUpperBand * rate2;
    }

    return nic;
}

export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults {
    const { taxYear, salary, bonus, pensionContribution, region, taxCode, taxableBenefits } = input;
    const payRiseMonthIndex = input.hasPayRise ? months.indexOf(input.payRiseMonth) : 12;
    const bonusMonthIndex = (bonus ?? 0) > 0 ? months.indexOf(input.bonusMonth) : -1;

    let annualGross = 0;
    const monthlySalaries: number[] = [];

    for (let i = 0; i < 12; i++) {
        const currentSalary = (input.hasPayRise && input.newSalary && i >= payRiseMonthIndex) ? input.newSalary : salary;
        monthlySalaries.push(currentSalary / 12);
    }
    
    const grossPerMonth = monthlySalaries.map((s, i) => s + (i === bonusMonthIndex ? (bonus ?? 0) : 0));
    annualGross = grossPerMonth.reduce((a, b) => a + b, 0);

    const pensionPerMonth = grossPerMonth.map((g, i) => {
        const baseSalaryPortion = monthlySalaries[i];
        const bonusPortion = g - baseSalaryPortion;
        
        let pensionablePay = baseSalaryPortion;
        if (input.isBonusPensionable && bonusPortion > 0) {
            pensionablePay += bonusPortion * (input.pensionableBonusPercentage / 100);
        }
        return pensionablePay * (pensionContribution / 100);
    });
    const annualPension = pensionPerMonth.reduce((a, b) => a + b, 0);
    
    const adjustedNetIncome = annualGross + (taxableBenefits ?? 0) - annualPension;
    const annualPersonalAllowance = calculateAnnualPersonalAllowance(adjustedNetIncome, taxCode, taxYear);

    const monthlyBreakdown: MonthlyResult[] = [];
    let cumulativeGrossYTD = 0;
    let cumulativePensionYTD = 0;
    let cumulativeTaxPaidYTD = 0;
    let cumulativeBenefitsYTD = 0;
    
    const { code, isFlatRate } = parseTaxCode(taxCode);
    const taxBands = region === 'Scotland' ? taxYearData[taxYear].SCOTLAND_BANDS : taxYearData[taxYear].ENGLAND_WALES_NI_BANDS;


    for (let i = 0; i < 12; i++) {
        const monthGross = grossPerMonth[i];
        const monthPension = pensionPerMonth[i];
        const monthBenefits = (taxableBenefits ?? 0) / 12;

        cumulativeGrossYTD += monthGross;
        cumulativePensionYTD += monthPension;
        cumulativeBenefitsYTD += monthBenefits;

        let monthTax = 0;
        if (isFlatRate && code !== '0T' && code !== 'NT') {
            let rate = 0;
            switch(code) {
                case 'BR': rate = taxBands.basic.rate; break;
                case 'D0': rate = taxBands.higher.rate; break;
                case 'D1': rate = taxBands.additional?.rate ?? (taxBands as any).top.rate; break;
            }
            const taxablePayThisMonth = monthGross + monthBenefits - monthPension;
            monthTax = taxablePayThisMonth * rate;
        } else if (code !== 'NT') {
             // Standard cumulative calculation
            const adjustedGrossYTD = cumulativeGrossYTD + cumulativeBenefitsYTD - cumulativePensionYTD;
            const personalAllowanceYTD = (annualPersonalAllowance / 12) * (i + 1);
            const taxableIncomeYTD = Math.max(0, adjustedGrossYTD - personalAllowanceYTD);
            
            const totalTaxDueYTD = calculateTaxOnIncome(taxableIncomeYTD, region, taxYear);
            monthTax = Math.max(0, totalTaxDueYTD - cumulativeTaxPaidYTD);
        }

        cumulativeTaxPaidYTD += monthTax;

        const monthNic = calculateNICForPayPeriod(monthGross, taxYear);
        const monthTakeHome = monthGross - monthPension - monthNic - monthTax;

        monthlyBreakdown.push({
            month: months[i],
            gross: monthGross,
            pension: monthPension,
            tax: monthTax,
            nic: monthNic,
            takeHome: monthTakeHome,
        });
    }

    const finalGross = monthlyBreakdown.reduce((sum, m) => sum + m.gross, 0);
    const finalPension = monthlyBreakdown.reduce((sum, m) => sum + m.pension, 0);
    const finalTax = monthlyBreakdown.reduce((sum, m) => sum + m.tax, 0);
    const finalNic = monthlyBreakdown.reduce((sum, m) => sum + m.nic, 0);
    const finalTakeHome = monthlyBreakdown.reduce((sum, m) => sum + m.takeHome, 0);

    // Recalculate annual taxable income at the end for final display
    const finalAnnualTaxableIncome = Math.max(0, adjustedNetIncome - annualPersonalAllowance);

    return {
        grossAnnualIncome: finalGross,
        annualTaxableIncome: finalAnnualTaxableIncome,
        annualTakeHome: finalTakeHome,
        annualTax: finalTax,
        annualNic: finalNic,
        annualPension: finalPension,
        personalAllowance: annualPersonalAllowance,
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
