
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
    NIC_BANDS: {
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


function parseTaxCode(taxCode: string): { personalAllowance: number, isKCode: boolean, isFlatRate: boolean } {
    const code = taxCode.toUpperCase().trim();
    const matches = code.match(/^(\d+)/);
    const flatRateCodes = ['BR', 'D0', 'D1', '0T', 'NT'];

    if (flatRateCodes.includes(code)) {
        return { personalAllowance: 0, isKCode: false, isFlatRate: true };
    }

    if (code.startsWith('K')) {
        const numPart = parseInt(code.substring(1), 10);
        if (!isNaN(numPart)) {
            return { personalAllowance: -(numPart * 10), isKCode: true, isFlatRate: false };
        }
    }
    
    if (matches && matches[1]) {
        const num = parseInt(matches[1], 10);
        return { personalAllowance: num * 10, isKCode: false, isFlatRate: false };
    }
    
    return { personalAllowance: 0, isKCode: false, isFlatRate: false };
}

function calculateAnnualPersonalAllowance(grossIncome: number, taxCode: string, year: TaxYear): number {
  const { PERSONAL_ALLOWANCE_DEFAULT, PA_TAPER_THRESHOLD } = getTaxYearData(year);
  const { personalAllowance: baseAllowance, isKCode, isFlatRate } = parseTaxCode(taxCode);

  if (isKCode || isFlatRate) {
    return baseAllowance;
  }
  
  const allowanceToTaper = baseAllowance > 0 ? baseAllowance : PERSONAL_ALLOWANCE_DEFAULT;

  if (grossIncome <= PA_TAPER_THRESHOLD) {
    return allowanceToTaper;
  }
  
  const taperedAmount = Math.max(0, (grossIncome - PA_TAPER_THRESHOLD) / 2);
  return Math.max(0, allowanceToTaper - taperedAmount);
}


function calculateIncomeTax(taxableIncome: number, region: Region, year: TaxYear, taxCode: string): number {
  if (taxableIncome <= 0) return 0;

  const code = taxCode.toUpperCase().trim();
  const { ENGLAND_WALES_NI_BANDS, SCOTLAND_BANDS } = getTaxYearData(year);
  const ewniBandsRef = ENGLAND_WALES_NI_BANDS;
  const scotBandsRef = SCOTLAND_BANDS as any; // Cast to access dynamic keys

  if (code === 'BR') {
      const rate = region === 'Scotland' ? scotBandsRef.basic.rate : ewniBandsRef.basic.rate;
      return taxableIncome * rate;
  }
  if (code === 'D0') {
      const rate = region === 'Scotland' ? scotBandsRef.higher.rate : ewniBandsRef.higher.rate;
      return taxableIncome * rate;
  }
  if (code === 'D1') {
      const rate = region === 'Scotland' ? scotBandsRef.top.rate : ewniBandsRef.additional.rate;
      return taxableIncome * rate;
  }
   if (code === 'NT') {
      return 0;
   }

  let tax = 0;
  
  if (region === 'Scotland') {
    const bandLimits = {
      "2023/24": [
        { limit: 2162, rate: 0.19}, { limit: 13118 - 2162, rate: 0.20}, { limit: 31092 - 13118, rate: 0.21}, { limit: 125140 - 31092, rate: 0.42}, { limit: Infinity, rate: 0.47},
      ],
      "2024/25": [
        { limit: 2306, rate: 0.19}, { limit: 13991 - 2306, rate: 0.20}, { limit: 31092 - 13991, rate: 0.21}, { limit: 62430 - 31092, rate: 0.42}, { limit: 125140 - 62430, rate: 0.45}, { limit: Infinity, rate: 0.48}
      ],
      "2025/26": [
        { limit: 2306, rate: 0.19}, { limit: 13991 - 2306, rate: 0.20}, { limit: 31092 - 13991, rate: 0.21}, { limit: 62430 - 31092, rate: 0.42}, { limit: 125140 - 62430, rate: 0.45}, { limit: Infinity, rate: 0.48}
      ]
    };

    const sBands = bandLimits[year] || bandLimits["2024/25"];
    let remainingIncome = taxableIncome;

    for (const band of sBands) {
        if (remainingIncome <= 0) break;
        const taxableInBand = Math.min(remainingIncome, band.limit);
        tax += taxableInBand * band.rate;
        remainingIncome -= taxableInBand;
    }
    return tax;

  } else {
    let remainingIncome = taxableIncome;
    const { basic, higher, additional } = ewniBandsRef;
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

    const monthlyBreakdown: MonthlyResult[] = [];
    
    let totalAnnualGross = 0;
    let totalAnnualPension = 0;
    
    // First pass: Calculate total gross and pension to determine annual allowance
    for (let i = 0; i < 12; i++) {
        const currentAnnualSalary = (input.hasPayRise && input.newSalary && i >= payRiseMonthIndex) 
            ? input.newSalary 
            : input.salary;
        const monthlySalary = currentAnnualSalary / 12;

        const currentMonthBonus = i === bonusMonthIndex ? (input.bonus ?? 0) : 0;
        const currentMonthGross = monthlySalary + currentMonthBonus;
        totalAnnualGross += currentMonthGross;
        
        const pensionableSalaryForMonth = monthlySalary;
        const pensionableBonusForMonth = i === bonusMonthIndex && input.isBonusPensionable ? currentMonthBonus * (input.pensionableBonusPercentage / 100) : 0;
        const currentMonthPension = (pensionableSalaryForMonth + pensionableBonusForMonth) * (input.pensionContribution / 100);
        totalAnnualPension += currentMonthPension;
    }
    
    // Note: No back-pay logic in this simple model, pay rise is prospective.

    const adjustedGrossForAllowance = totalAnnualGross + (input.taxableBenefits ?? 0);
    const annualPersonalAllowance = calculateAnnualPersonalAllowance(adjustedGrossForAllowance - totalAnnualPension, input.taxCode, input.taxYear);
    const annualTaxableIncome = Math.max(0, adjustedGrossForAllowance - totalAnnualPension - annualPersonalAllowance);

    let ytdGross = 0;
    let ytdTax = 0;
    let ytdNic = 0;
    let ytdPension = 0;
    const { NIC_BANDS } = getTaxYearData(input.taxYear);
    
    // Second pass: Cumulative calculation month by month
    months.forEach((month, index) => {
        const currentAnnualSalary = (input.hasPayRise && input.newSalary && index >= payRiseMonthIndex) 
            ? input.newSalary 
            : input.salary;
        const monthlySalary = currentAnnualSalary / 12;

        const currentMonthBonus = index === bonusMonthIndex ? (input.bonus ?? 0) : 0;
        const monthGross = monthlySalary + currentMonthBonus;
        
        const pensionableSalaryForMonth = monthlySalary;
        const pensionableBonusForMonth = index === bonusMonthIndex && input.isBonusPensionable ? currentMonthBonus * (input.pensionableBonusPercentage / 100) : 0;
        const monthPension = (pensionableSalaryForMonth + pensionableBonusForMonth) * (input.pensionContribution / 100);
        
        ytdGross += monthGross;
        ytdPension += monthPension;

        // Cumulative Tax
        const ytdPA = annualPersonalAllowance * (index + 1) / 12;
        const ytdBenefits = (input.taxableBenefits ?? 0) * (index + 1) / 12;
        const ytdTaxable = Math.max(0, ytdGross + ytdBenefits - ytdPension - ytdPA);
        const totalTaxDueYtd = calculateIncomeTax(ytdTaxable, input.region, input.taxYear, input.taxCode);
        const monthTax = totalTaxDueYtd - ytdTax;

        // Cumulative NI
        const ytdPT = NIC_BANDS.primaryThreshold * (index + 1) / 12;
        const ytdUEL = NIC_BANDS.upperEarningsLimit * (index + 1) / 12;
        let totalNicDueYtd = 0;
        if (ytdGross > ytdPT) {
            const earningsInBand1 = Math.min(ytdGross, ytdUEL) - ytdPT;
            totalNicDueYtd += Math.max(0, earningsInBand1) * NIC_BANDS.rate1;
        }
        if (ytdGross > ytdUEL) {
            const earningsInBand2 = ytdGross - ytdUEL;
            totalNicDueYtd += earningsInBand2 * NIC_BANDS.rate2;
        }
        const monthNic = totalNicDueYtd - ytdNic;

        const takeHome = monthGross - monthTax - monthNic - monthPension;

        monthlyBreakdown.push({
            month,
            gross: monthGross,
            pension: monthPension,
            tax: monthTax,
            nic: monthNic,
            takeHome: takeHome,
        });

        ytdTax += monthTax;
        ytdNic += monthNic;
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

    