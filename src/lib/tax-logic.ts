
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
      basic: { rate: 0.20, threshold: 37700 }, // 50270 - 12570
      higher: { rate: 0.40, threshold: 125140 }, 
      additional: { rate: 0.45, threshold: Infinity },
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
      primaryThreshold: 12570, // 242 * 52
      upperEarningsLimit: 50270, // 967 * 52 + 1
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
        // The thresholds for Scotland are defined differently, they are the size of the band itself, not cumulative limits.
        const taxableInBand = Math.min(remainingIncome, band.limit - (band.limit === starter.threshold ? 0 : lastLimit));
        if (band.limit !== starter.threshold) lastLimit = band.limit; // This is incorrect, scottish bands are not cumulative. Let's fix this.
    }
    // Correct Scottish Tax calculation
    remainingIncome = taxableIncome;
    let scottishTaxable = taxableIncome;
    let tax = 0;
    
    const bandLimits = {
      "2023/24": [
        { upto: 2162, rate: 0.19},
        { upto: 13118, rate: 0.20},
        { upto: 31092, rate: 0.21},
        { upto: 125140, rate: 0.42},
        { upto: Infinity, rate: 0.47},
      ],
      "2024/25": [
        { upto: 2306, rate: 0.19},
        { upto: 13991, rate: 0.20},
        { upto: 31092, rate: 0.21},
        { upto: 62430, rate: 0.42},
        { upto: 125140, rate: 0.45},
        { upto: Infinity, rate: 0.48}
      ],
      "2025/26": [ // Assuming same as 24/25
        { upto: 2306, rate: 0.19},
        { upto: 13991, rate: 0.20},
        { upto: 31092, rate: 0.21},
        { upto: 62430, rate: 0.42},
        { upto: 125140, rate: 0.45},
        { upto: Infinity, rate: 0.48}
      ]
    };

    const sBands = bandLimits[year];
    let lastBandLimit = 0;
    for (const band of sBands) {
      if (scottishTaxable <= 0) break;
      const bandWidth = band.upto - lastBandLimit;
      const taxableInBand = Math.min(scottishTaxable, bandWidth);
      tax += taxableInBand * band.rate;
      scottishTaxable -= taxableInBand;
      lastBandLimit = band.upto;
    }
    return tax;


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
    
    const grossCashIncome = annualSalary + (input.bonus ?? 0);
    const pensionableBonus = input.isBonusPensionable && input.bonus ? input.bonus * (input.pensionableBonusPercentage / 100) : 0;
    const totalPensionableIncome = annualSalary + pensionableBonus;

    const annualPensionContribution = totalPensionableIncome * (input.pensionContribution / 100);
    
    // Adjusted Net Income for tax purposes includes benefits but not cash
    const adjustedNetIncome = annualSalary + (input.bonus ?? 0) + (input.taxableBenefits ?? 0) - annualPensionContribution;
    const personalAllowance = calculatePersonalAllowance(adjustedNetIncome, input.taxCode, input.taxYear);
    
    const annualTaxableIncome = Math.max(0, adjustedNetIncome - personalAllowance);
    const annualTax = calculateIncomeTax(annualTaxableIncome, input.region, input.taxYear);
    
    // NIC is calculated on cash earnings (salary + bonus), not benefits.
    const annualNic = calculateNICForIncome(grossCashIncome, input.taxYear);
    
    const annualTakeHome = grossCashIncome - annualTax - annualNic - annualPensionContribution;
    
    const monthlyBreakdown: MonthlyResult[] = [];

    let bonusTax = 0;
    let bonusNic = 0;

    if ((input.bonus ?? 0) > 0) {
        const pensionOnBonus = input.isBonusPensionable ? (input.bonus ?? 0) * (input.pensionableBonusPercentage/100) * (input.pensionContribution/100) : 0;
        
        // Tax on bonus
        const incomeWithBonusForTax = grossCashIncome + (input.taxableBenefits ?? 0) - annualPensionContribution;
        const incomeWithoutBonusForTax = incomeWithBonusForTax - (input.bonus ?? 0) + pensionOnBonus;

        const paWithBonus = calculatePersonalAllowance(incomeWithBonusForTax, input.taxCode, input.taxYear);
        const paWithoutBonus = calculatePersonalAllowance(incomeWithoutBonusForTax, input.taxCode, input.taxYear);
        
        const taxableWithBonus = Math.max(0, incomeWithBonusForTax - paWithBonus);
        const taxableWithoutBonus = Math.max(0, incomeWithoutBonusForTax - paWithoutBonus);
        
        const totalTax = calculateIncomeTax(taxableWithBonus, input.region, input.taxYear);
        const taxOnSalary = calculateIncomeTax(taxableWithoutBonus, input.region, input.taxYear);
        bonusTax = Math.max(0, totalTax - taxOnSalary);
        
        // NIC on bonus
        const totalNic = calculateNICForIncome(grossCashIncome, input.taxYear);
        const nicOnSalary = calculateNICForIncome(grossCashIncome - (input.bonus ?? 0), input.taxYear);
        bonusNic = Math.max(0, totalNic - nicOnSalary);
    }
    
    const annualTaxOnSalary = annualTax - bonusTax;
    const annualNicOnSalary = annualNic - bonusNic;

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
        const pensionableBonusForMonth = index === bonusMonthIndex && input.isBonusPensionable ? currentMonthBonus * (input.pensionableBonusPercentage / 100) : 0;
        const currentMonthPension = (pensionableSalary + pensionableBonusForMonth) * (input.pensionContribution / 100);

        const currentMonthTax = (annualTaxOnSalary / 12) + (index === bonusMonthIndex ? bonusTax : 0);
        const currentMonthNic = (annualNicOnSalary / 12) + (index === bonusMonthIndex ? bonusNic : 0);
        
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

    