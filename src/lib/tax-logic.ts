
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

function parseTaxCode(taxCode: string, year: TaxYear): { personalAllowance: number, isKCode: boolean, isFlatRate: boolean, code: string } {
    const code = taxCode.toUpperCase().trim();
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
    
    if (code.match(/^\d+[A-Z]$/)) {
        const num = parseInt(code.slice(0, -1), 10);
        return { personalAllowance: num * 10, isKCode: false, isFlatRate: false, code };
    }
    
    // Default to a standard allowance if code is just a number with L
    if (code.match(/^\d+L$/)) {
        const num = parseInt(code.slice(0, -1), 10);
         if (num * 10 === getTaxYearData(year).PERSONAL_ALLOWANCE_DEFAULT) {
            return { personalAllowance: getTaxYearData(year).PERSONAL_ALLOWANCE_DEFAULT, isKCode: false, isFlatRate: false, code };
        }
    }

    // Default for unrecognized codes
    return { personalAllowance: 0, isKCode: false, isFlatRate: true, code: '0T' };
}

function calculateAnnualPersonalAllowance(adjustedNetIncome: number, taxCode: string, year: TaxYear): number {
  const { PERSONAL_ALLOWANCE_DEFAULT, PA_TAPER_THRESHOLD } = getTaxYearData(year);
  const { personalAllowance: parsedAllowance, isKCode, isFlatRate, code } = parseTaxCode(taxCode, year);

  if (isKCode || isFlatRate || code === '0T') {
      return parsedAllowance > 0 ? 0 : parsedAllowance;
  }
  
  const allowanceToTaper = (code.includes(String(PERSONAL_ALLOWANCE_DEFAULT).slice(0,4))) ? PERSONAL_ALLOWANCE_DEFAULT : parsedAllowance;

  if (adjustedNetIncome <= PA_TAPER_THRESHOLD) {
    return allowanceToTaper;
  }
  
  const incomeOverThreshold = adjustedNetIncome - PA_TAPER_THRESHOLD;
  const reduction = Math.floor(incomeOverThreshold / 2);
  
  return Math.max(0, allowanceToTaper - reduction);
}


function calculateTaxOnIncome(taxableIncome: number, region: Region, year: TaxYear): number {
    const taxBandsData = region === 'Scotland' 
        ? getTaxYearData(year).SCOTLAND_BANDS 
        : getTaxYearData(year).ENGLAND_WALES_NI_BANDS;

    const bands = Object.values(taxBandsData)
        .sort((a, b) => a.threshold - b.threshold);

    let tax = 0;
    let income = taxableIncome;
    let previousThreshold = 0;

    for (const band of bands) {
        if (income <= 0) break;
        const bandWidth = band.threshold - previousThreshold;
        if (bandWidth <= 0) continue; // For additional/top rate
        
        const taxableInBand = Math.min(income, bandWidth);
        tax += taxableInBand * band.rate;
        income -= taxableInBand;
        previousThreshold = band.threshold;
    }
     if (income > 0) { // additional/top rate
        tax += income * bands[bands.length - 1].rate;
    }
    
    return tax > 0 ? tax : 0;
}


function calculateNICForIncome(grossIncome: number, year: TaxYear): number {
    const { pt, uel, rate1, rate2 } = getTaxYearData(year).NIC_BANDS;

    if (grossIncome <= pt) {
        return 0;
    }
    
    let nic = 0;
    
    if (grossIncome > pt) {
        const earningsInMainBand = Math.min(grossIncome, uel) - pt;
        nic += Math.max(0, earningsInMainBand) * rate1;
    }
    
    if (grossIncome > uel) {
        const earningsInUpperBand = grossIncome - uel;
        nic += earningsInUpperBand * rate2;
    }

    return nic > 0 ? nic : 0;
}

export function calculateTakeHomePay(input: TaxCalculatorSchema): CalculationResults {
    const { taxYear, salary, bonus = 0, pensionContribution, region, taxCode, taxableBenefits = 0 } = input;
    const payRiseMonthIndex = input.hasPayRise ? months.indexOf(input.payRiseMonth) : 12;
    const bonusMonthIndex = bonus > 0 ? months.indexOf(input.bonusMonth) : -1;

    let annualSalary = 0;
    const prePayRiseMonths = payRiseMonthIndex;
    const postPayRiseMonths = 12 - payRiseMonthIndex;

    if(input.hasPayRise && input.newSalary) {
        annualSalary = (salary / 12 * prePayRiseMonths) + (input.newSalary / 12 * postPayRiseMonths);
    } else {
        annualSalary = salary;
    }

    const annualGross = annualSalary + bonus;

    // Calculate annual pension
    let annualPensionableSalary = salary;
    if (input.hasPayRise && input.newSalary) {
        annualPensionableSalary = (salary / 12 * prePayRiseMonths) + (input.newSalary / 12 * postPayRiseMonths);
    }
    
    let pensionableBonus = 0;
    if (input.isBonusPensionable) {
        pensionableBonus = bonus * (input.pensionableBonusPercentage / 100);
    }
    const annualPension = (annualPensionableSalary + pensionableBonus) * (pensionContribution / 100);

    const adjustedNetIncome = annualGross + taxableBenefits - annualPension;
    const personalAllowance = calculateAnnualPersonalAllowance(adjustedNetIncome, taxCode, taxYear);
    const annualTaxableIncome = Math.max(0, adjustedNetIncome - personalAllowance);
    const annualTax = calculateTaxOnIncome(annualTaxableIncome, region, taxYear);
    const annualNic = calculateNICForIncome(annualGross, taxYear);
    const annualTakeHome = annualGross - annualTax - annualNic - annualPension;

    // Monthly breakdown
    const monthlyBreakdown: MonthlyResult[] = [];
    const baseMonthlySalary = salary / 12;
    const newMonthlySalary = (input.hasPayRise && input.newSalary) ? input.newSalary / 12 : baseMonthlySalary;

    // Standard monthly deductions (without bonus)
    let standardAnnualGross = annualSalary;
    let standardAnnualPensionable = annualPensionableSalary;
    let standardAnnualPension = standardAnnualPensionable * (pensionContribution / 100);
    let standardAdjNetIncome = standardAnnualGross + taxableBenefits - standardAnnualPension;
    let standardPA = calculateAnnualPersonalAllowance(standardAdjNetIncome, taxCode, taxYear);
    let standardTaxable = Math.max(0, standardAdjNetIncome - standardPA);
    let standardAnnualTax = calculateTaxOnIncome(standardTaxable, region, taxYear);
    let standardMonthlyTax = standardAnnualTax / 12;
    
    // Calculate NIC per month based on that month's salary
    const standardMonthlyNic = calculateNICForIncome(annualSalary / 12, taxYear);
    const standardMonthlyPension = (annualPensionableSalary / 12) * (pensionContribution / 100);
    
    // Tax on bonus
    const bonusTax = calculateTaxOnIncome(adjustedNetIncome, region, taxYear) - calculateTaxOnIncome(adjustedNetIncome - bonus, region, taxYear);
    const bonusNic = calculateNICForIncome(annualGross, taxYear) - calculateNICForIncome(annualSalary, taxYear);
    const bonusPension = annualPension - standardAnnualPension;

    for (let i = 0; i < 12; i++) {
        const currentMonthlySalary = i < payRiseMonthIndex ? baseMonthlySalary : newMonthlySalary;
        let monthGross = currentMonthlySalary;
        let monthTax = i < payRiseMonthIndex ? (calculateTaxOnIncome(Math.max(0, (salary+taxableBenefits- (salary * (pensionContribution/100)) ) - standardPA), region, taxYear)/12) : (calculateTaxOnIncome(Math.max(0,(input.newSalary!+taxableBenefits- (input.newSalary! * (pensionContribution/100)))-standardPA), region, taxYear)/12);
        let monthNic = calculateNICForIncome(currentMonthlySalary, taxYear);
        let monthPension = currentMonthlySalary * (pensionContribution / 100);

        if (i === bonusMonthIndex) {
            monthGross += bonus;
            monthTax += bonusTax;
            monthNic += bonusNic;
            monthPension += bonusPension;
        }

        const monthTakeHome = monthGross - monthTax - monthNic - monthPension;

        monthlyBreakdown.push({
            month: months[i],
            gross: monthGross,
            tax: monthTax,
            nic: monthNic,
            pension: monthPension,
            takeHome: monthTakeHome,
        });
    }
     // Correct final totals from the accurate monthly breakdown
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
        personalAllowance: personalAllowance,
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
