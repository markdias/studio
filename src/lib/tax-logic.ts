
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

function getTaxYearData(year: TaxYear) {
  return taxYearData[year];
}

function parseTaxCode(taxCode: string, year: TaxYear): number {
    const code = taxCode.toUpperCase().trim();
    
    if (['BR', 'D0', 'D1', '0T', 'NT'].includes(code)) {
        return 0;
    }

    if (code.startsWith('K')) {
        const numPart = parseInt(code.substring(1), 10);
        return isNaN(numPart) ? 0 : -(numPart * 10);
    }
    
    const match = code.match(/^(\d+)[LMNPTY]$/);
    if (match) {
        const num = parseInt(match[1], 10);
        return num * 10;
    }
    
    if (code.match(/^\d+$/)) {
      return parseInt(code, 10) * 10;
    }
    
    return getTaxYearData(year).PERSONAL_ALLOWANCE_DEFAULT;
}


function calculateAnnualPersonalAllowance(adjustedNetIncome: number, parsedAllowance: number, year: TaxYear): number {
    const { PERSONAL_ALLOWANCE_DEFAULT, PA_TAPER_THRESHOLD } = getTaxYearData(year);

    if (parsedAllowance !== PERSONAL_ALLOWANCE_DEFAULT) {
        return parsedAllowance > 0 ? parsedAllowance : 0;
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

    const bands = Object.values(taxBandsData)
        .sort((a, b) => a.threshold - b.threshold);

    let tax = 0;
    let income = taxableIncome;
    let previousThreshold = 0;

    for (const band of bands) {
        if (income <= 0) break;
        
        const bandWidth = band.threshold - previousThreshold;
        
        if (bandWidth <= 0) {
           tax += income * band.rate;
           income = 0;
           break;
        }
        
        const taxableInBand = Math.min(income, bandWidth);
        tax += taxableInBand * band.rate;
        income -= taxableInBand;
        previousThreshold = band.threshold;
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

    const taxCode = input.taxCode || `${Math.floor(getTaxYearData(taxYear).PERSONAL_ALLOWANCE_DEFAULT / 10)}L`;
    const parsedAllowanceFromCode = parseTaxCode(taxCode, taxYear);

    let annualSalary = 0;
    const prePayRiseMonths = payRiseMonthIndex;
    const postPayRiseMonths = 12 - payRiseMonthIndex;

    if(input.hasPayRise && input.newSalary) {
        annualSalary = (salary / 12 * prePayRiseMonths) + (input.newSalary / 12 * postPayRiseMonths);
    } else {
        annualSalary = salary;
    }

    const pensionableBonus = input.isBonusPensionable ? bonus * (input.pensionableBonusPercentage / 100) : 0;
    const annualPensionableSalary = annualSalary;
    const totalPensionableIncome = annualPensionableSalary + pensionableBonus;
    const annualPension = totalPensionableIncome * (pensionContribution / 100);

    const grossAnnualIncome = annualSalary + bonus;
    const adjustedNetIncome = grossAnnualIncome + taxableBenefits - annualPension;
    const finalPersonalAllowance = calculateAnnualPersonalAllowance(adjustedNetIncome, parsedAllowanceFromCode, taxYear);
    
    const annualTaxableIncome = Math.max(0, adjustedNetIncome - finalPersonalAllowance);
    const annualTax = calculateTaxOnIncome(annualTaxableIncome, region, taxYear);
    
    let annualNic = 0;
    const monthlyBreakdown: MonthlyResult[] = [];
    const baseMonthlySalary = salary / 12;
    const newMonthlySalary = (input.hasPayRise && input.newSalary) ? input.newSalary / 12 : baseMonthlySalary;

    let cumulativeTaxPaid = 0;

    for (let i = 0; i < 12; i++) {
        const currentMonthlySalary = i < payRiseMonthIndex ? baseMonthlySalary : newMonthlySalary;
        const bonusThisMonth = (i === bonusMonthIndex) ? bonus : 0;
        const grossThisMonth = currentMonthlySalary + bonusThisMonth;

        const nicThisMonth = calculateNICForIncome(grossThisMonth, taxYear);
        annualNic += nicThisMonth;
        
        const standardMonthlyTax = annualTax / 12;
        let taxThisMonth = standardMonthlyTax;

        if (bonusThisMonth > 0) {
            // A simplified model to tax the bonus at the user's highest marginal rate
            const taxableIncomeWithoutBonus = Math.max(0, adjustedNetIncome - bonus - finalPersonalAllowance);
            const taxWithoutBonus = calculateTaxOnIncome(taxableIncomeWithoutBonus, region, taxYear);
            const bonusTax = annualTax - taxWithoutBonus;
            taxThisMonth += bonusTax;
            
            // Adjust tax for other months so total tax is correct
            if (cumulativeTaxPaid === 0) { // only adjust once
              for (let j = 0; j < 12; j++) {
                  if (j !== i) { // don't adjust the bonus month
                      monthlyBreakdown[j] = { ...monthlyBreakdown[j], tax: (annualTax - bonusTax) / 11 };
                  }
              }
            }
        }
        
        const pensionableBonusThisMonth = (i === bonusMonthIndex) ? pensionableBonus : 0;
        const pensionThisMonth = (currentMonthlySalary + pensionableBonusThisMonth) * (pensionContribution / 100);
        
        const takeHomeThisMonth = grossThisMonth - taxThisMonth - nicThisMonth - pensionThisMonth;

        monthlyBreakdown.push({
            month: months[i],
            gross: grossThisMonth,
            tax: taxThisMonth,
            nic: nicThisMonth,
            pension: pensionThisMonth,
            takeHome: takeHomeThisMonth,
        });

        cumulativeTaxPaid += taxThisMonth;
    }

    // Recalculate monthly tax if a bonus was present to ensure stable non-bonus months
    if (bonus > 0) {
        const taxableIncomeWithoutBonus = Math.max(0, adjustedNetIncome - bonus - finalPersonalAllowance);
        const taxWithoutBonus = calculateTaxOnIncome(taxableIncomeWithoutBonus, region, taxYear);
        const bonusTax = annualTax - taxWithoutBonus;
        const standardMonthlyTax = taxWithoutBonus / 12;

        for (let i = 0; i < 12; i++) {
            let taxThisMonth = standardMonthlyTax;
            if (i === bonusMonthIndex) {
                taxThisMonth += bonusTax;
            }
            monthlyBreakdown[i].tax = taxThisMonth;
            monthlyBreakdown[i].takeHome = monthlyBreakdown[i].gross - taxThisMonth - monthlyBreakdown[i].nic - monthlyBreakdown[i].pension;
        }
    }


    const finalTakeHome = monthlyBreakdown.reduce((sum, m) => sum + m.takeHome, 0);
    const finalTax = monthlyBreakdown.reduce((sum, m) => sum + m.tax, 0);

    return {
        grossAnnualIncome: grossAnnualIncome,
        annualTaxableIncome: annualTaxableIncome,
        annualTakeHome: finalTakeHome,
        annualTax: finalTax,
        annualNic: annualNic,
        annualPension: annualPension,
        personalAllowance: finalPersonalAllowance,
        effectiveTaxRate: grossAnnualIncome > 0 ? ((finalTax + annualNic) / grossAnnualIncome) * 100 : 0,
        breakdown: [
            { name: 'Take-Home Pay', value: finalTakeHome, fill: 'hsl(var(--chart-1))' },
            { name: 'Income Tax', value: finalTax, fill: 'hsl(var(--chart-2))' },
            { name: 'National Insurance', value: annualNic, fill: 'hsl(var(--chart-3))' },
            { name: 'Pension', value: annualPension, fill: 'hsl(var(--chart-4))' },
        ],
        monthlyBreakdown,
    };
}
