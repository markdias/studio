
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
      lowerEarningsLimit: 6396,
      primaryThreshold: 12570,
      upperEarningsLimit: 50270,
      rate1: 0.12, // Jan 2024 this changed to 10%, but for simplicity using full year rate
      rate2: 0.02,
    },
  },
  "2024/25": {
    PERSONAL_ALLOWANCE_DEFAULT: 12570,
    PA_TAPER_THRESHOLD: 100000,
    ENGLAND_WALES_NI_BANDS: {
      basic: { rate: 0.20, threshold: 37700 }, // 12571 to 50270
      higher: { rate: 0.40, threshold: 125140 }, // 50271 to 125140
      additional: { rate: 0.45, threshold: Infinity }, // above 125140
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
      lowerEarningsLimit: 6396,
      primaryThreshold: 12570,
      upperEarningsLimit: 50270,
      rate1: 0.08,
      rate2: 0.02,
    },
  },
  "2025/26": { // Using user-provided data
    PERSONAL_ALLOWANCE_DEFAULT: 12570,
    PA_TAPER_THRESHOLD: 100000,
    ENGLAND_WALES_NI_BANDS: {
      basic: { rate: 0.20, threshold: 37700 }, // 12571 to 50270
      higher: { rate: 0.40, threshold: 125140 }, // 50271 to 125140
      additional: { rate: 0.45, threshold: Infinity }, // above 125140
    },
    SCOTLAND_BANDS: { // Assuming same as 24/25 as not specified
      starter: { rate: 0.19, threshold: 2306 },
      basic: { rate: 0.20, threshold: 13991 },
      intermediate: { rate: 0.21, threshold: 31092 },
      higher: { rate: 0.42, threshold: 62430 },
      advanced: { rate: 0.45, threshold: 125140 },
      top: { rate: 0.48, threshold: Infinity },
    },
    NIC_BANDS: {
        lowerEarningsLimit: 6500, // Approx from user data
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
            return { personalAllowance: -(numPart * 10), isKCode: true, isFlatRate: false, code };
        }
    }
    
    if (matches && matches[1]) {
        const num = parseInt(matches[1], 10);
        return { personalAllowance: num * 10, isKCode: false, isFlatRate: false, code };
    }
    
    return { personalAllowance: 0, isKCode: false, isFlatRate: false, code };
}

function calculateAnnualPersonalAllowance(grossIncome: number, taxCode: string, year: TaxYear): number {
  const { PERSONAL_ALLOWANCE_DEFAULT, PA_TAPER_THRESHOLD } = getTaxYearData(year);
  const { personalAllowance: parsedAllowance, isKCode, isFlatRate, code } = parseTaxCode(taxCode);
  
  // For codes like BR, D0, D1, 0T, NT, the personal allowance is 0.
  if (isFlatRate || code === '0T') {
    return 0;
  }
  // For K codes, the allowance is negative and not subject to tapering
  if (isKCode) {
    return parsedAllowance;
  }
  
  // Use the allowance from the tax code if it's a standard code like 1257L
  const allowanceToTaper = parsedAllowance > 0 ? parsedAllowance : PERSONAL_ALLOWANCE_DEFAULT;

  if (grossIncome <= PA_TAPER_THRESHOLD) {
    return allowanceToTaper;
  }
  
  const taperedAmount = Math.max(0, (grossIncome - PA_TAPER_THRESHOLD) / 2);
  return Math.max(0, allowanceToTaper - taperedAmount);
}

function calculateTaxForIncome(taxableIncome: number, region: Region, year: TaxYear, taxCode: string): number {
    if (taxableIncome <= 0) return 0;
    const { code } = parseTaxCode(taxCode);
    const { ENGLAND_WALES_NI_BANDS, SCOTLAND_BANDS } = getTaxYearData(year);

    const handleTaxCalculation = (bands: any) => {
        let tax = 0;
        let remainingIncome = taxableIncome;
        
        // Handle flat rate codes first
        switch (code) {
            case 'BR': return taxableIncome * bands.basic.rate;
            case 'D0': return taxableIncome * bands.higher.rate;
            case 'D1': return taxableIncome * (bands.additional?.rate ?? bands.top.rate);
            case 'NT': return 0;
        }

        const bandOrder = Object.keys(bands);
        let previousThreshold = 0;

        for (const bandName of bandOrder) {
            const band = bands[bandName];
            const bandThreshold = band.threshold;
            
            if (remainingIncome <= 0) break;
            
            const taxableInBand = Math.min(remainingIncome, bandThreshold - previousThreshold);
            if (taxableInBand <= 0) continue;

            tax += taxableInBand * band.rate;
            remainingIncome -= taxableInBand;
            previousThreshold = bandThreshold;
        }

        return tax;
    };

    if (region === "Scotland") {
      const scottishBands = {
        '2023/24': {
          starter: { rate: 0.19, threshold: 2162 },
          basic: { rate: 0.20, threshold: 13118 },
          intermediate: { rate: 0.21, threshold: 31092 },
          higher: { rate: 0.42, threshold: 125140 },
          top: { rate: 0.47, threshold: Infinity },
        },
        '2024/25': {
          starter: { rate: 0.19, threshold: 2306 },
          basic: { rate: 0.20, threshold: 13991 },
          intermediate: { rate: 0.21, threshold: 31092 },
          higher: { rate: 0.42, threshold: 62430 },
          advanced: { rate: 0.45, threshold: 125140 },
          top: { rate: 0.48, threshold: Infinity },
        },
        '2025/26': {
          starter: { rate: 0.19, threshold: 2306 },
          basic: { rate: 0.20, threshold: 13991 },
          intermediate: { rate: 0.21, threshold: 31092 },
          higher: { rate: 0.42, threshold: 62430 },
          advanced: { rate: 0.45, threshold: 125140 },
          top: { rate: 0.48, threshold: Infinity },
        }
      };
      return handleTaxCalculation(scottishBands[year]);
    } else {
      return handleTaxCalculation(ENGLAND_WALES_NI_BANDS);
    }
}

function calculateNICForPayPeriod(periodIncome: number, year: TaxYear): number {
    const { primaryThreshold, upperEarningsLimit, rate1, rate2 } = getTaxYearData(year).NIC_BANDS;
    const ptMonthly = primaryThreshold / 12;
    const uelMonthly = upperEarningsLimit / 12;

    if (periodIncome <= ptMonthly) {
        return 0;
    }
    
    let nic = 0;
    
    // Earnings between Primary Threshold and Upper Earnings Limit
    const earningsInMainBand = Math.min(periodIncome, uelMonthly) - ptMonthly;
    if (earningsInMainBand > 0) {
        nic += earningsInMainBand * rate1;
    }
    
    // Earnings above Upper Earnings Limit
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

    // 1. Calculate total annual figures
    let totalAnnualGross = 0;
    let totalAnnualPension = 0;

    for (let i = 0; i < 12; i++) {
        const currentSalary = (input.hasPayRise && input.newSalary && i >= payRiseMonthIndex) ? input.newSalary : salary;
        const monthlySalary = currentSalary / 12;
        const monthBonus = i === bonusMonthIndex ? (bonus ?? 0) : 0;
        
        const monthGross = monthlySalary + monthBonus;
        totalAnnualGross += monthGross;

        const pensionableSalary = monthlySalary;
        const pensionableBonus = (i === bonusMonthIndex && input.isBonusPensionable) ? (monthBonus * (input.pensionableBonusPercentage / 100)) : 0;
        totalAnnualPension += (pensionableSalary + pensionableBonus) * (pensionContribution / 100);
    }

    const adjustedGrossForPA = totalAnnualGross + (taxableBenefits ?? 0);
    const annualPersonalAllowance = calculateAnnualPersonalAllowance(adjustedGrossForPA - totalAnnualPension, taxCode, taxYear);
    const annualTaxableIncome = Math.max(0, adjustedGrossForPA - totalAnnualPension - annualPersonalAllowance);
    const totalAnnualTax = calculateTaxForIncome(annualTaxableIncome, region, taxYear, taxCode);

    // 2. Calculate monthly breakdown using cumulative PAYE logic
    const monthlyBreakdown: MonthlyResult[] = [];
    let cumulativeGrossYTD = 0;
    let cumulativePensionYTD = 0;
    let cumulativeTaxableYTD = 0;
    let cumulativeTaxPaidYTD = 0;
    
    for (let i = 0; i < 12; i++) {
        const monthIndex = i + 1; // Month 1 to 12
        const currentSalary = (input.hasPayRise && input.newSalary && i >= payRiseMonthIndex) ? input.newSalary : salary;
        const monthlySalary = currentSalary / 12;
        const monthBonus = i === bonusMonthIndex ? (bonus ?? 0) : 0;

        const monthGross = monthlySalary + monthBonus;
        cumulativeGrossYTD += monthGross;

        const pensionableSalary = monthlySalary;
        const pensionableBonus = (i === bonusMonthIndex && input.isBonusPensionable) ? (monthBonus * (input.pensionableBonusPercentage / 100)) : 0;
        const monthPension = (pensionableSalary + pensionableBonus) * (pensionContribution / 100);
        cumulativePensionYTD += monthPension;
        
        const benefitsYTD = (taxableBenefits ?? 0) * monthIndex / 12;
        const allowanceYTD = calculateAnnualPersonalAllowance(cumulativeGrossYTD + benefitsYTD - cumulativePensionYTD, taxCode, taxYear) * monthIndex / 12;

        const taxableIncomeYTD = Math.max(0, (cumulativeGrossYTD + benefitsYTD) - cumulativePensionYTD - allowanceYTD);

        const totalTaxDueYTD = calculateTaxForIncome(taxableIncomeYTD, region, taxYear, taxCode);

        const monthTax = totalTaxDueYTD - cumulativeTaxPaidYTD;
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

    // 3. Sum up final annual figures from monthly breakdown for accuracy
    const finalGross = monthlyBreakdown.reduce((sum, m) => sum + m.gross, 0);
    const finalPension = monthlyBreakdown.reduce((sum, m) => sum + m.pension, 0);
    const finalTax = monthlyBreakdown.reduce((sum, m) => sum + m.tax, 0);
    const finalNic = monthlyBreakdown.reduce((sum, m) => sum + m.nic, 0);
    const finalTakeHome = monthlyBreakdown.reduce((sum, m) => sum + m.takeHome, 0);

    return {
        grossAnnualIncome: finalGross,
        annualTaxableIncome,
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

    