
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
    NIC_BANDS: { // Weekly: 0% up to 242, 8% 242.01-967, 2% > 967
      primaryThreshold: 12584, // 242 * 52
      upperEarningsLimit: 50284, // 967 * 52
      rate1: 0.08, 
      rate2: 0.02,
    },
  }
};

function getTaxYearData(year: TaxYear) {
  return taxYearData[year];
}


function parseTaxCode(taxCode: string): { personalAllowance: number, isKCode: boolean } {
    const code = taxCode.toUpperCase().trim();
    const matches = code.match(/^(\d+)/);

    if (code.startsWith('K')) {
        const numPart = parseInt(code.substring(1), 10);
        if (!isNaN(numPart)) {
            // K code effectively adds income to be taxed, not reduces allowance
            return { personalAllowance: - (numPart * 10), isKCode: true };
        }
    }
    
    if (matches && matches[1]) {
        const num = parseInt(matches[1], 10);
        // The number in the tax code represents tax-free income / 10
        return { personalAllowance: num * 10, isKCode: false };
    }
    
    // For codes like BR, D0, D1, or invalid/other codes, there's no personal allowance.
    return { personalAllowance: 0, isKCode: false };
}

function calculatePersonalAllowance(adjustedNetIncome: number, taxCode: string, year: TaxYear): number {
  const { PA_TAPER_THRESHOLD } = getTaxYearData(year);
  const { personalAllowance: baseAllowance, isKCode } = parseTaxCode(taxCode);

  // K codes and other flat-rate codes are not subject to tapering
  if (baseAllowance <= 0 || isKCode) {
    return baseAllowance;
  }
  
  if (adjustedNetIncome <= PA_TAPER_THRESHOLD) {
    return baseAllowance;
  }
  
  const taperedAmount = Math.max(0, (adjustedNetIncome - PA_TAPER_THRESHOLD) / 2);
  return Math.max(0, baseAllowance - taperedAmount);
}

function calculateIncomeTax(taxableIncome: number, region: Region, year: TaxYear, taxCode: string): number {
  if (taxableIncome <= 0) return 0;

  const code = taxCode.toUpperCase().trim();
  const { ENGLAND_WALES_NI_BANDS, SCOTLAND_BANDS } = getTaxYearData(year);
  const bands = region === 'Scotland' ? SCOTLAND_BANDS : ENGLAND_WALES_NI_BANDS;

  // Handle flat rate codes first
  if (code === 'BR') {
      return taxableIncome * bands.basic.rate;
  }
  // For D0, use higher rate
  if (code === 'D0') {
      return taxableIncome * bands.higher.rate;
  }
  // For D1, use additional/top rate
  if (code === 'D1') {
      const rate = region === 'Scotland' 
          ? ('top' in SCOTLAND_BANDS ? SCOTLAND_BANDS.top.rate : SCOTLAND_BANDS.advanced.rate) 
          : ENGLAND_WALES_NI_BANDS.additional.rate;
      return taxableIncome * rate;
  }


  // Standard tax calculation for other codes
  let tax = 0;
  
  if (region === 'Scotland') {
    let scottishTaxable = taxableIncome;
    let tax = 0;
    
    const bandLimits = {
      "2023/24": [
        { upto: 2162, rate: 0.19},
        { upto: 13118 - 2162, rate: 0.20},
        { upto: 31092 - 13118, rate: 0.21},
        { upto: 125140 - 31092, rate: 0.42},
        { upto: Infinity, rate: 0.47},
      ],
      "2024/25": [
        { upto: 2306, rate: 0.19},
        { upto: 13991 - 2306, rate: 0.20},
        { upto: 31092 - 13991, rate: 0.21},
        { upto: 62430 - 31092, rate: 0.42},
        { upto: 125140 - 62430, rate: 0.45},
        { upto: Infinity, rate: 0.48}
      ],
      "2025/26": [ // Assuming same as 24/25
        { upto: 2306, rate: 0.19},
        { upto: 13991 - 2306, rate: 0.20},
        { upto: 31092 - 13991, rate: 0.21},
        { upto: 62430 - 31092, rate: 0.42},
        { upto: 125140 - 62430, rate: 0.45},
        { upto: Infinity, rate: 0.48}
      ]
    };

    const sBands = bandLimits[year] || bandLimits["2024/25"];
    let remainingIncome = scottishTaxable;

    for (const band of sBands) {
        if (remainingIncome <= 0) break;
        const taxableInBand = Math.min(remainingIncome, band.upto);
        tax += taxableInBand * band.rate;
        remainingIncome -= taxableInBand;
    }
    return tax;

  } else {
    // England, Wales, NI
    let remainingIncome = taxableIncome;
    const { basic, higher, additional } = ENGLAND_WALES_NI_BANDS;
    const ewniBands = [
        { limit: basic.threshold, rate: basic.rate },
        { limit: higher.threshold - basic.threshold, rate: higher.rate },
        { limit: Infinity, rate: additional.rate }
    ];
    
    for (const band of ewniBands) {
      if (remainingIncome <= 0) break;
      const taxableInBand = Math.min(remainingIncome, band.limit);
      tax += taxableInBand * band.rate;
      remainingIncome -= taxableInBand;
    }
    return tax;
  }
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
    
    // Total cash received by employee
    const grossAnnualCashIncome = annualSalary + (input.bonus ?? 0);
    
    const pensionableBonus = input.isBonusPensionable && input.bonus ? input.bonus * (input.pensionableBonusPercentage / 100) : 0;
    const totalPensionableIncome = annualSalary + pensionableBonus;

    const annualPensionContribution = totalPensionableIncome * (input.pensionContribution / 100);
    
    // Income for tax purposes = cash income + non-cash benefits
    const incomeForTaxPurposes = grossAnnualCashIncome + (input.taxableBenefits ?? 0);
    
    // Adjusted Net Income for PA tapering = income for tax - pension
    const adjustedNetIncome = incomeForTaxPurposes - annualPensionContribution;
    
    const { isKCode } = parseTaxCode(input.taxCode);
    const personalAllowance = calculatePersonalAllowance(adjustedNetIncome, input.taxCode, input.taxYear);
    
    // Taxable income = adjusted net income - personal allowance (or + added income for K code)
    const annualTaxableIncome = isKCode 
      ? adjustedNetIncome - personalAllowance // personalAllowance is negative for K-code
      : Math.max(0, adjustedNetIncome - personalAllowance);

    const annualTax = calculateIncomeTax(annualTaxableIncome, input.region, input.taxYear, input.taxCode);
    
    // NIC is calculated on cash earnings only, before pension deductions
    const annualNic = calculateNICForIncome(grossAnnualCashIncome, input.taxYear);
    
    // Take-home is cash income minus all deductions
    const annualTakeHome = grossAnnualCashIncome - annualTax - annualNic - annualPensionContribution;
    
    const monthlyBreakdown: MonthlyResult[] = [];
    
    // Apportion tax and NIC more smoothly
    let taxOnBonus = 0;
    if ((input.bonus ?? 0) > 0) {
      const taxableWithoutBonus = annualTaxableIncome - (input.bonus ?? 0);
      const taxWithoutBonus = calculateIncomeTax(taxableWithoutBonus, input.region, input.taxYear, input.taxCode);
      taxOnBonus = Math.max(0, annualTax - taxWithoutBonus);
    }
    const taxOnSalaryAndBenefits = annualTax - taxOnBonus;

    let nicOnBonus = 0;
    if ((input.bonus ?? 0) > 0) {
        const nicWithoutBonus = calculateNICForIncome(annualSalary, input.taxYear);
        nicOnBonus = Math.max(0, annualNic - nicWithoutBonus);
    }
    const nicOnSalary = annualNic - nicOnBonus;
    
    months.forEach((month, index) => {
        const currentAnnualSalary = (input.hasPayRise && input.newSalary && index >= payRiseMonthIndex) 
            ? input.newSalary 
            : input.salary;

        let monthlySalary = currentAnnualSalary / 12;
        
        let backPay = 0;
        // Simple back pay calculation if pay rise month has passed
        if(input.hasPayRise && input.newSalary && index === payRiseMonthIndex && payRiseMonthIndex > 0) {
            const salaryDifference = (input.newSalary - input.salary) / 12;
            backPay = salaryDifference * payRiseMonthIndex;
        }
        
        const currentMonthBonus = index === bonusMonthIndex ? (input.bonus ?? 0) : 0;
        const currentMonthGross = monthlySalary + backPay + currentMonthBonus;
        
        const pensionableSalaryForMonth = monthlySalary + backPay;
        const pensionableBonusForMonth = index === bonusMonthIndex && input.isBonusPensionable ? currentMonthBonus * (input.pensionableBonusPercentage / 100) : 0;
        const currentMonthPension = (pensionableSalaryForMonth + pensionableBonusForMonth) * (input.pensionContribution / 100);
        
        const currentMonthTax = (taxOnSalaryAndBenefits / 12) + (index === bonusMonthIndex ? taxOnBonus : 0);
        const currentMonthNic = (nicOnSalary / 12) + (index === bonusMonthIndex ? nicOnBonus : 0);
        
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
        annualTaxableIncome: annualTaxableIncome,
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
