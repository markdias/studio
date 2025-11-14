
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
      rate1: 0.12, 
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
        pt: 12570,
        uel: 50270,
        rate1: 0.08,
        rate2: 0.02,
    },
  }
};

function getTaxYearData(year: TaxYear) {
    if (year === '2023/24') {
        return {
            ...taxYearData[year],
            NIC_BANDS: {
                pt: 12570,
                uel: 50270,
                // From 6 July 2022 to 5 Jan 2023 rate was 13.25%, then 12% to 5 April 2023, then 10% from 6 Jan 2024.
                // It's complex. Let's use a blended rate for simplicity for this old tax year.
                rate1: 0.12, 
                rate2: 0.02,
            }
        }
    }
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

function calculateAnnualPersonalAllowance(adjustedNetIncome: number, taxCode: string, year: TaxYear): number {
  const { PERSONAL_ALLOWANCE_DEFAULT, PA_TAPER_THRESHOLD } = getTaxYearData(year);
  const { personalAllowance: parsedAllowance, isKCode, isFlatRate, code } = parseTaxCode(taxCode);
  
  if (isFlatRate || code === '0T') {
    return 0;
  }
  if (isKCode) {
    return parsedAllowance;
  }
  
  const allowanceToTaper = parsedAllowance > 0 ? parsedAllowance : PERSONAL_ALLOWANCE_DEFAULT;

  if (adjustedNetIncome <= PA_TAPER_THRESHOLD) {
    return allowanceToTaper;
  }
  
  const taperedAmount = Math.max(0, (adjustedNetIncome - PA_TAPER_THRESHOLD) / 2);
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
            case 'D1': return taxableIncome * (bands.additional?.rate ?? bands.top?.rate ?? bands.advanced.rate);
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
        '2023/24': SCOTLAND_BANDS,
        '2024/25': SCOTLAND_BANDS,
        '2025/26': SCOTLAND_BANDS
      };
      return handleTaxCalculation(scottishBands[year]);
    } else {
      return handleTaxCalculation(ENGLAND_WALES_NI_BANDS);
    }
}


function calculateNICForPayPeriod(periodIncome: number, year: TaxYear): number {
    const { pt, uel, rate1, rate2 } = getTaxYearData(year).NIC_BANDS;
    const ptMonthly = pt / 12;
    const uelMonthly = uel / 12;

    if (periodIncome <= ptMonthly) {
        return 0;
    }
    
    let nic = 0;
    
    const earningsInMainBand = Math.min(periodIncome, uelMonthly) - ptMonthly;
    if (earningsInMainBand > 0) {
        nic += earningsInMainBand * rate1;
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
    let annualPension = 0;
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
    annualPension = pensionPerMonth.reduce((a, b) => a + b, 0);

    const adjustedNetIncome = annualGross + (taxableBenefits ?? 0) - annualPension;
    const annualPersonalAllowance = calculateAnnualPersonalAllowance(adjustedNetIncome, taxCode, taxYear);
    
    const annualTaxableIncome = Math.max(0, adjustedNetIncome - annualPersonalAllowance);
    const totalAnnualTax = calculateTaxForIncome(annualTaxableIncome, region, taxYear, taxCode);

    const monthlyBreakdown: MonthlyResult[] = [];
    let cumulativeGrossYTD = 0;
    let cumulativePensionYTD = 0;
    let cumulativeTaxPaidYTD = 0;
    
    for (let i = 0; i < 12; i++) {
        const monthIndex = i + 1; // Month 1 to 12
        
        const monthGross = grossPerMonth[i];
        cumulativeGrossYTD += monthGross;

        const monthPension = pensionPerMonth[i];
        cumulativePensionYTD += monthPension;
        
        const benefitsYTD = (taxableBenefits ?? 0) * monthIndex / 12;
        const adjustedIncomeYTD = cumulativeGrossYTD + benefitsYTD - cumulativePensionYTD;

        const personalAllowanceYTD = calculateAnnualPersonalAllowance(adjustedNetIncome, taxCode, taxYear) * monthIndex / 12;

        const taxableIncomeYTD = Math.max(0, adjustedIncomeYTD - personalAllowanceYTD);

        const totalTaxDueYTD = calculateTaxForIncome(taxableIncomeYTD, region, taxYear, taxCode);

        const monthTax = totalTaxDueYTD - cumulativeTaxPaidYTD;
        cumulativeTaxPaidYTD += monthTax;

        const monthNic = calculateNICForPayPeriod(monthGross, taxYear);
        const monthTakeHome = monthGross - monthPension - monthNic - monthTax;

        monthlyBreakdown.push({
            month: months[i],
            gross: monthGross,
            pension: monthPension,
            tax: Math.max(0, monthTax), // Tax can't be negative in a month (rebates are complex)
            nic: monthNic,
            takeHome: monthTakeHome,
        });
    }

    const finalGross = monthlyBreakdown.reduce((sum, m) => sum + m.gross, 0);
    const finalPension = monthlyBreakdown.reduce((sum, m) => sum + m.pension, 0);
    const finalTax = monthlyBreakdown.reduce((sum, m) => sum + m.tax, 0);
    const finalNic = monthlyBreakdown.reduce((sum, m) => sum + m.nic, 0);
    const finalTakeHome = monthlyBreakdown.reduce((sum, m) => sum + m.takeHome, 0);

    return {
        grossAnnualIncome: finalGross,
        annualTaxableIncome: annualTaxableIncome,
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
