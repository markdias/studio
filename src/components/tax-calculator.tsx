

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Lightbulb, Loader2, CalendarIcon, Baby, Send, Download, Upload, Edit, Save, HelpCircle, GraduationCap, Eye } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { taxCalculatorSchema, type TaxCalculatorSchema, type CalculationResults, regions, months, taxYears, type ChildcareAdviceOutput, ChatMessage } from "@/lib/definitions";
import { calculateTakeHomePay, getTaxYearData, parseTaxCode } from "@/lib/tax-logic";
import { generateTaxSavingTipsAction, generateChildcareAdviceAction, financialChatAction, taxChildcareChatAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const initialValues: TaxCalculatorSchema = {
  taxYear: "2024/25",
  salary: 50000,
  region: "England",
  taxCode: "1257L",

  // Optional Sections
  showBonus: false,
  showPension: false,
  showBenefits: false,
  showPayRise: false,
  showChildcareCalculator: false,
  showStudentLoan: false,
  
  // Bonus
  bonus: 0,
  bonusMonth: "April",
  
  // Pension
  pensionContribution: 5,
  bonusPensionContribution: 0,
  enablePensionComparison: false,
  adjustedPensionContribution: 10,
  
  // Benefits
  taxableBenefits: 0,
  blind: false,

  // Pay Rise
  hasPayRise: false,
  newSalary: 60000,
  payRiseMonth: "April",

  // Childcare
  numberOfChildren: 0,
  daysPerWeekInChildcare: 0,
  dailyChildcareRate: 0,
  partnerIncome: 0,
  registeredChildcareProvider: false,
  childDisabled: false,
  claimingUniversalCredit: false,
  claimingTaxFreeChildcare: false,

  // Student Loan
  studentLoanPlan1: false,
  studentLoanPlan2: false,
  studentLoanPlan4: false,
  studentLoanPlan5: false,
  postgraduateLoan: false,
};

const defaultTaxCodes: Record<string, string> = {
    "2023/24": "1257L",
    "2024/25": "1257L",
    "2025/26": "1257L",
}

export default function TaxCalculator() {
  const { toast } = useToast();
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [adjustedResults, setAdjustedResults] = useState<CalculationResults | null>(null);
  
  const [taxChatHistory, setTaxChatHistory] = useState<ChatMessage[]>([]);
  const [taxChatInput, setTaxChatInput] = useState("");
  const [isTaxChatLoading, setIsTaxChatLoading] = useState(false);

  const [childcareAdvice, setChildcareAdvice] = useState<ChildcareAdviceOutput | null>(null);
  const [childcareChatHistory, setChildcareChatHistory] = useState<ChatMessage[]>([]);
  const [childcareChatInput, setChildcareChatInput] = useState("");
  const [isChildcareChatLoading, setIsChildcareChatLoading] = useState(false);

  const [taxChildcareChatHistory, setTaxChildcareChatHistory] = useState<ChatMessage[]>([]);
  const [taxChildcareChatInput, setTaxChildcareChatInput] = useState("");
  const [isTaxChildcareChatLoading, setIsTaxChildcareChatLoading] = useState(false);


  const [isTaxCodeEditing, setIsTaxCodeEditing] = useState(false);
  const [isTaxCodeManuallySet, setIsTaxCodeManuallySet] = useState(false);

  const taxChatContainerRef = useRef<HTMLDivElement>(null);
  const childcareChatContainerRef = useRef<HTMLDivElement>(null);
  const taxChildcareChatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const form = useForm<TaxCalculatorSchema>({
    resolver: zodResolver(taxCalculatorSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  const watchedValues = form.watch();

  const calculate = () => {
    const values = form.getValues();
    const parsed = taxCalculatorSchema.safeParse(values);
    if (parsed.success) {
      setResults(calculateTakeHomePay(parsed.data));
      if (parsed.data.enablePensionComparison) {
        setAdjustedResults(calculateTakeHomePay({
          ...parsed.data,
          pensionContribution: parsed.data.adjustedPensionContribution ?? 0,
        }));
      } else {
        setAdjustedResults(null);
      }
    } else {
      setResults(null);
      setAdjustedResults(null);
      console.log(parsed.error);
    }
  }

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
        if(name === 'taxYear' && value.taxYear && !isTaxCodeManuallySet){
            const newTaxCode = defaultTaxCodes[value.taxYear] || "1257L";
            form.setValue('taxCode', newTaxCode, { shouldValidate: true });
        }
      calculate();
    });
    calculate();
    return () => subscription.unsubscribe();
  }, [form, isTaxCodeManuallySet]);
  
  useEffect(() => {
    if (taxChatHistory.length > 0) {
      setTaxChatHistory([]);
    }
    if (childcareAdvice || childcareChatHistory.length > 0) {
      setChildcareAdvice(null);
      setChildcareChatHistory([]);
    }
     if (taxChildcareChatHistory.length > 0) {
      setTaxChildcareChatHistory([]);
    }
  }, [watchedValues.salary]);


   useEffect(() => {
    if (isTaxCodeManuallySet || isTaxCodeEditing) {
      return; // Don't auto-update if user is in control
    }

    if (results) {
      const taxYearData = getTaxYearData(watchedValues.taxYear);
      const grossIncome = results.grossAnnualIncome;
      const adjustedNetIncome = grossIncome - results.annualPension;
      
       if (adjustedNetIncome <= taxYearData.PERSONAL_ALLOWANCE_DEFAULT) {
        const newTaxCode = defaultTaxCodes[watchedValues.taxYear];
        if (form.getValues('taxCode') !== newTaxCode) {
            form.setValue('taxCode', newTaxCode, { shouldValidate: true, shouldDirty: true });
        }
        return;
      }
      
      let newTaxCode = defaultTaxCodes[watchedValues.taxYear];
      
      if (adjustedNetIncome > taxYearData.PERSONAL_ALLOWANCE_DEFAULT && adjustedNetIncome > taxYearData.PA_TAPER_THRESHOLD) {
        if (results.personalAllowance <= 0) {
          newTaxCode = '0T';
        } else {
          // Round down to nearest 10 and add 'L'
          const allowanceCode = Math.floor(results.personalAllowance / 10);
          newTaxCode = `${allowanceCode}L`;
        }
      }
      
      if(form.getValues('taxCode') !== newTaxCode) {
         form.setValue('taxCode', newTaxCode, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [results?.grossAnnualIncome, results?.personalAllowance, watchedValues.taxYear, isTaxCodeManuallySet, isTaxCodeEditing, form]);


  useEffect(() => {
    if (taxChatContainerRef.current) {
      taxChatContainerRef.current.scrollTop = taxChatContainerRef.current.scrollHeight;
    }
  }, [taxChatHistory]);

  useEffect(() => {
    if (childcareChatContainerRef.current) {
      childcareChatContainerRef.current.scrollTop = childcareChatContainerRef.current.scrollHeight;
    }
  }, [childcareChatHistory]);

   useEffect(() => {
    if (taxChildcareChatContainerRef.current) {
      taxChildcareChatContainerRef.current.scrollTop = taxChildcareChatContainerRef.current.scrollHeight;
    }
  }, [taxChildcareChatHistory]);


   const handleExport = () => {
    const values = form.getValues();
    const jsonString = JSON.stringify(values, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tax-figures.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Data Exported",
      description: "Your financial details have been saved to tax-figures.json.",
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error("File is not valid text.");
        }
        const importedData = JSON.parse(text);

        // Basic validation
        const parsedData = taxCalculatorSchema.safeParse(importedData);
        if (parsedData.success) {
          form.reset(parsedData.data);
          setIsTaxCodeManuallySet(true); // Assume imported tax code is intentional
          calculate();
          toast({
            title: "Data Imported",
            description: "Your financial details have been loaded from the file.",
          });
        } else {
           throw new Error("File content does not match the required format.");
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: error.message || "Could not read or parse the file. Please ensure it's a valid JSON export.",
        });
      } finally {
        // Reset the file input so the same file can be loaded again
        if(event.target) {
          event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };


  const getFinancialContext = () => {
    const values = form.getValues();
    return {
      taxYear: values.taxYear,
      salary: values.salary,
      bonus: values.bonus,
      pensionContribution: values.pensionContribution,
      region: values.region,
      taxCode: values.taxCode,
      taxableBenefits: values.taxableBenefits,
      annualGrossIncome: results?.grossAnnualIncome,
      annualTaxableIncome: results?.annualTaxableIncome,
      annualTakeHome: results?.annualTakeHome,
      annualTax: results?.annualTax,
      annualNic: results?.annualNic,
      annualPension: results?.annualPension,
      personalAllowance: results?.personalAllowance,
      // For childcare chat
      partnerIncome: values.partnerIncome,
      registeredChildcareProvider: values.registeredChildcareProvider,
      childDisabled: values.childDisabled,
      claimingUniversalCredit: values.claimingUniversalCredit,
      claimingTaxFreeChildcare: values.claimingTaxFreeChildcare,
    };
  }

  const handleGenerateInitialTips = async () => {
    const values = form.getValues();
    const parsed = taxCalculatorSchema.safeParse(values);
    if (!parsed.success) {
      toast({
        title: "Invalid Input",
        description: "Please check your inputs before generating tips.",
        variant: "destructive",
      });
      return;
    }

    setIsTaxChatLoading(true);
    setTaxChatHistory([]);

    const { salary, bonus, pensionContribution, taxableBenefits, region, bonusPensionContribution } = parsed.data;

    const pensionFromSalary = salary * (pensionContribution / 100);
    const pensionFromBonus = (bonus ?? 0) * ((bonusPensionContribution ?? 0) / 100);
    const pensionAmount = pensionFromSalary + pensionFromBonus;

    const actionResult = await generateTaxSavingTipsAction({
      salary: salary,
      bonus: bonus,
      pensionContributions: pensionAmount,
      otherTaxableBenefits: taxableBenefits,
      region: region,
    });

    if (actionResult.success && actionResult.data) {
      setTaxChatHistory([{ role: 'model', content: actionResult.data.tips }]);
    } else {
      toast({
        title: "Error",
        description: actionResult.error,
        variant: "destructive",
      });
    }

    setIsTaxChatLoading(false);
  };

  const handleTaxChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxChatInput.trim()) return;

    const newHistory: ChatMessage[] = [...taxChatHistory, { role: 'user', content: taxChatInput }];
    setTaxChatHistory(newHistory);
    setTaxChatInput("");
    setIsTaxChatLoading(true);

    const actionResult = await financialChatAction({
      financialContext: getFinancialContext(),
      history: newHistory,
      question: taxChatInput,
    });

    if (actionResult.success && actionResult.data) {
      setTaxChatHistory(prev => [...prev, { role: 'model', content: actionResult.data.answer }]);
    } else {
      setTaxChatHistory(prev => [...prev, { role: 'model', content: `Sorry, I ran into an error: ${actionResult.error}` }]);
    }
    setIsTaxChatLoading(false);
  }

  const handleGenerateChildcareAdvice = async () => {
    const values = form.getValues();
    const parsed = taxCalculatorSchema.safeParse(values);
    if (!parsed.success) {
      toast({
        title: "Invalid Input",
        description: "Please check your inputs before generating advice.",
        variant: "destructive",
      });
      return;
    }
     if ((parsed.data.numberOfChildren ?? 0) <= 0) {
      toast({
        title: "No children specified",
        description: "Please enter the number of children to get childcare advice.",
        variant: "destructive",
      });
      return;
    }

    setIsChildcareChatLoading(true);
    setChildcareAdvice(null);
    setChildcareChatHistory([]);

    const actionResult = await generateChildcareAdviceAction({
      annualGrossIncome: parsed.data.salary + (parsed.data.bonus ?? 0),
      taxableBenefits: parsed.data.taxableBenefits ?? 0,
      pensionContributionPercentage: parsed.data.pensionContribution,
      numberOfChildren: parsed.data.numberOfChildren,
      daysPerWeekInChildcare: parsed.data.daysPerWeekInChildcare,
      dailyChildcareRate: parsed.data.dailyChildcareRate,
      taxYear: parsed.data.taxYear,
    });

    if (actionResult.success && actionResult.data) {
      setChildcareAdvice(actionResult.data);
      const initialContent = `
**Childcare Cost Summary:**
${actionResult.data.costSummary}

**Income & Tax Allowance Analysis:**
${actionResult.data.incomeAnalysis}

**Optimization Strategies:**
${actionResult.data.optimizationStrategies}

**Summary:**
${actionResult.data.summary}
      `.trim();
      setChildcareChatHistory([{ role: 'model', content: initialContent }]);
    } else {
      toast({
        title: "Error",
        description: actionResult.error,
        variant: "destructive",
      });
    }

    setIsChildcareChatLoading(false);
  };

  const handleChildcareChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childcareChatInput.trim()) return;

    const newHistory: ChatMessage[] = [...childcareChatHistory, { role: 'user', content: childcareChatInput }];
    setChildcareChatHistory(newHistory);
    setChildcareChatInput("");
    setIsChildcareChatLoading(true);

    const actionResult = await financialChatAction({
      financialContext: getFinancialContext(),
      history: newHistory,
      question: childcareChatInput,
    });

    if (actionResult.success && actionResult.data) {
      setChildcareChatHistory(prev => [...prev, { role: 'model', content: actionResult.data.answer }]);
    } else {
      setChildcareChatHistory(prev => [...prev, { role: 'model', content: `Sorry, I ran into an error: ${actionResult.error}` }]);
    }
    setIsChildcareChatLoading(false);
  }

  const handleTaxChildcareChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxChildcareChatInput.trim()) return;

    const newHistory: ChatMessage[] = [...taxChildcareChatHistory, { role: 'user', content: taxChildcareChatInput }];
    setTaxChildcareChatHistory(newHistory);
    setTaxChildcareChatInput("");
    setIsTaxChildcareChatLoading(true);

    const actionResult = await taxChildcareChatAction({
      financialContext: getFinancialContext(),
      history: newHistory,
      question: taxChildcareChatInput,
    });

    if (actionResult.success && actionResult.data) {
      setTaxChildcareChatHistory(prev => [...prev, { role: 'model', content: actionResult.data.answer }]);
    } else {
      setTaxChildcareChatHistory(prev => [...prev, { role: 'model', content: `Sorry, I ran into an error: ${actionResult.error}` }]);
    }
    setIsTaxChildcareChatLoading(false);
  }
  
  
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);

 const renderFormattedText = (text: string) => {
    // Convert markdown bold to strong tags
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Convert markdown table to HTML table
    const tableRegex = /\|(.+)\|\n\|-+\|.+\n((?:\|.*\|\n?)+)/g;
    text = text.replace(tableRegex, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map(h => h.trim()).filter(Boolean);
      const rows = bodyRows.trim().split('\n').map(row => row.split('|').map(c => c.trim()).filter(Boolean));

      const tableHead = `<thead><tr class="border-b">${headers.map(h => `<th class="p-2 text-left font-semibold">${h}</th>`).join('')}</tr></thead>`;
      const tableBody = `<tbody>${rows.map(row => `<tr class="border-b">${row.map(c => `<td class="p-2">${c}</td>`).join('')}</tr>`).join('')}</tbody>`;

      return `<div class="overflow-x-auto"><table class="w-full text-left my-4">${tableHead}${tableBody}</table></div>`;
    });

    // Convert JSON blocks to pre-formatted code blocks
    text = text.replace(/```json\n([\s\S]*?)```/g, (match, p1) => {
      try {
        const parsedJson = JSON.parse(p1);
        const formattedJson = JSON.stringify(parsedJson, null, 2);
        return `<pre class="bg-secondary p-4 rounded-md overflow-x-auto text-sm"><code>${formattedJson}</code></pre>`;
      } catch (e) {
        return `<pre class="bg-secondary p-4 rounded-md overflow-x-auto text-sm"><code>${p1}</code></pre>`;
      }
    });

    return text;
  };

  const renderResultsPanel = (res: CalculationResults | null, title: string) => {
    const chartConfig = res?.breakdown.reduce((acc, item) => {
        acc[item.name] = { label: item.name, color: item.fill };
        return acc;
    }, {} as any) || {};

    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">{title}</CardTitle>
          <CardDescription>An estimate of your annual take-home pay for tax year {watchedValues.taxYear}.</CardDescription>
        </CardHeader>
        <CardContent>
          {res ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Annual Take-Home</p>
                  <p className="text-4xl font-bold text-primary">{formatCurrency(res.annualTakeHome)}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-right">
                    <p className="text-muted-foreground">Gross Pay</p>
                    <p className="text-muted-foreground">Take-Home</p>
                    <p className="text-muted-foreground">Income Tax</p>
                    <p className="text-muted-foreground">Nat. Ins.</p>
                    {res.annualStudentLoan > 0 && <p className="text-muted-foreground">Student Loan</p>}
                    <p className="text-muted-foreground">Pension</p>
                  </div>
                  <div>
                    <p className="font-semibold">{formatCurrency(res.grossAnnualIncome)}</p>
                    <p className="font-semibold">{formatCurrency(res.annualTakeHome)}</p>
                    <p className="font-semibold">{formatCurrency(res.annualTax)}</p>
                    <p className="font-semibold">{formatCurrency(res.annualNic)}</p>
                    {res.annualStudentLoan > 0 && <p className="font-semibold">{formatCurrency(res.annualStudentLoan)}</p>}
                    <p className="font-semibold">{formatCurrency(res.annualPension)}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold">Taxable Income Breakdown</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-md border p-2">
                    <div className="text-right text-muted-foreground">Gross Pay:</div>
                    <div>{formatCurrency(res.grossAnnualIncome)}</div>
                     <div className="text-right text-muted-foreground">Taxable Benefits:</div>
                    <div>+ {formatCurrency(watchedValues.taxableBenefits ?? 0)}</div>
                    <div className="text-right text-muted-foreground">Pension:</div>
                    <div>- {formatCurrency(res.annualPension)}</div>
                    <div className="text-right text-muted-foreground">Personal Allowance:</div>
                    <div>- {formatCurrency(res.personalAllowance)}</div>
                    <div className="col-span-2"><Separator className="my-1"/></div>
                    <div className="text-right font-bold">Taxable Income:</div>
                    <div className="font-bold">{formatCurrency(res.annualTaxableIncome)}</div>
                  </div>
                </div>
              </div>
              <div className="min-h-[250px]">
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                    <Pie data={res.breakdown} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                      {res.breakdown.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent />} />
                  </PieChart>
                </ChartContainer>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              Enter your details to see your results.
            </div>
          )}
        </CardContent>
        {res && (res.grossAnnualIncome > 50000 || res.grossAnnualIncome > 100000) && (
          <CardFooter className="flex-col items-start gap-4">
            {res.grossAnnualIncome > 100000 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>£100,000 Threshold</AlertTitle>
                <AlertDescription>
                  Your personal tax allowance is reduced as your income is over £100,000. This results in an effective marginal tax rate of ~60% on income between £100,000 and £125,140.
                </AlertDescription>
              </Alert>
            )}
            {res.grossAnnualIncome > 50000 && res.grossAnnualIncome < 100000 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>£50,000 Threshold</AlertTitle>
                <AlertDescription>
                  You are in a higher tax bracket and may be subject to the High Income Child Benefit Charge if applicable.
                </AlertDescription>
              </Alert>
            )}
          </CardFooter>
        )}
      </Card>
    );
  };

  const renderMonthlyBreakdownPanel = (res: CalculationResults | null, title: string) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2"><CalendarIcon className="text-primary h-6 w-6" />{title}</CardTitle>
          <CardDescription>A month-by-month view of your estimated earnings and deductions.</CardDescription>
        </CardHeader>
        <CardContent>
          {res ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Month</TableHead>
                  <TableHead className="text-right font-semibold">Gross Pay</TableHead>
                  <TableHead className="text-right font-semibold">Pension</TableHead>
                  <TableHead className="text-right font-semibold">Loan</TableHead>
                  <TableHead className="text-right font-semibold">Income Tax</TableHead>
                  <TableHead className="text-right font-semibold">Nat. Ins.</TableHead>
                  <TableHead className="text-right font-semibold text-primary">Take-Home</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.monthlyBreakdown.map((row) => (
                  <TableRow key={row.month} className={row.gross > (res.grossAnnualIncome / 12) * 1.05 ? "bg-secondary hover:bg-secondary/80 font-semibold" : ""}>
                    <TableCell>{row.month}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.gross)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.pension)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.studentLoan)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.tax)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.nic)}</TableCell>
                    <TableCell className="text-right text-primary font-bold">{formatCurrency(row.takeHome)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              Results will be shown here.
            </div>
          )}
        </CardContent>
      </Card>
    );
  };


  return (
    <FormProvider {...form}>
      <div className="space-y-8">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="font-headline">Your Financial Details</CardTitle>
              <CardDescription>
                Enter your income details to calculate your take-home pay.
              </CardDescription>
            </div>
             <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="application/json"
                />
                <Button variant="outline" size="icon" onClick={handleImportClick} title="Import data from JSON">
                    <Upload className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleExport} title="Export data to JSON">
                    <Download className="h-4 w-4" />
                </Button>
            </div>
          </CardHeader>
          <Form {...form}>
            <form>
              <CardContent>
                <div className="space-y-4 rounded-md border p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="showChildcareCalculator"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Childcare & Benefits</FormLabel>
                                    <FormDescription>
                                        Tools for childcare costs and support.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="showStudentLoan"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Student Loan</FormLabel>
                                </div>
                                <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={(checked) => {
                                        field.onChange(checked);
                                        if (!checked) {
                                            form.setValue('studentLoanPlan1', false);
                                            form.setValue('studentLoanPlan2', false);
                                            form.setValue('studentLoanPlan4', false);
                                            form.setValue('studentLoanPlan5', false);
                                            form.setValue('postgraduateLoan', false);
                                        }
                                    }}
                                />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="showBonus"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Bonus</FormLabel>
                                </div>
                                <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="showPension"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Pension</FormLabel>
                                </div>
                                <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="showBenefits"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Benefits & Allowances</FormLabel>
                                </div>
                                <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="showPayRise"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Pay Rise</FormLabel>
                                </div>
                                <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
                    {/* Column 1 */}
                    <div className="space-y-6 md:col-span-2 lg:col-span-4">
                         <div className="space-y-4 rounded-md border p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
                            <h3 className="font-semibold text-base md:col-span-2 lg:col-span-4">Your Income</h3>
                            <FormField
                                control={form.control}
                                name="taxYear"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Tax Year</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select tax year" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {taxYears.map((year) => (
                                            <SelectItem key={year} value={year}>
                                            {year}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="region"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>UK Region</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select your region" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {regions.map((region) => (
                                            <SelectItem key={region} value={region}>
                                            {region}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="salary"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Annual Salary (£)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 50000" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="taxCode"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tax Code</FormLabel>
                                    <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Input
                                        type="text"
                                        placeholder="e.g., 1257L"
                                        {...field}
                                        readOnly={!isTaxCodeEditing}
                                        className={!isTaxCodeEditing ? "bg-muted cursor-not-allowed" : ""}
                                        />
                                    </FormControl>
                                    {isTaxCodeEditing ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon"
                                            onClick={() => {
                                            setIsTaxCodeEditing(false);
                                            setIsTaxCodeManuallySet(true);
                                            calculate();
                                            }}
                                            title="Save Tax Code"
                                        >
                                            <Save className="h-4 w-4" />
                                        </Button>
                                        ) : (
                                        <Button type="button" variant="outline" size="icon" onClick={() => setIsTaxCodeEditing(true)} title="Edit Tax Code">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        )}
                                    </div>
                                    {isTaxCodeManuallySet && !isTaxCodeEditing && (
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-xs text-muted-foreground">Tax code is set manually.</p>
                                            <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => {
                                                setIsTaxCodeManuallySet(false);
                                                const currentTaxYear = form.getValues('taxYear');
                                                form.setValue('taxCode', defaultTaxCodes[currentTaxYear], { shouldValidate: true, shouldDirty: true });
                                            }}>Use Automatic</Button>
                                        </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {watchedValues.showBonus && (
                        <div className="space-y-4 rounded-md border p-4 md:col-span-2">
                            <h3 className="font-semibold text-base">Bonus</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <FormField
                            control={form.control}
                            name="bonus"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Annual Bonus (£)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g., 5000" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="bonusMonth"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Bonus Month</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={(watchedValues.bonus ?? 0) <= 0}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select bonus month" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {months.map((month) => (
                                        <SelectItem key={month} value={month}>
                                        {month}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            </div>
                        </div>
                    )}
                    {watchedValues.showBenefits && (
                        <div className="space-y-4 rounded-md border p-4 md:col-span-2">
                             <h3 className="font-semibold text-base">Benefits & Allowances</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                             <FormField
                                control={form.control}
                                name="taxableBenefits"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Annual Taxable Benefits (£)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 2000" {...field} />
                                    </FormControl>
                                    <FormDescription className="text-xs">e.g. company car, medical insurance. Affects tax, not NI.</FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="blind"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-8">
                                    <FormLabel className="flex items-center gap-2"><Eye className="h-4 w-4" /> Blind Person's Allowance</FormLabel>
                                    <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            </div>
                        </div>
                    )}

                    {watchedValues.showPension && (
                         <div className="space-y-4 rounded-md border p-4 md:col-span-2">
                            <h3 className="font-semibold text-base">Pension</h3>
                             <FormField
                                control={form.control}
                                name="pensionContribution"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Salary Contribution ({field.value}%)</FormLabel>
                                    <FormControl>
                                        <Slider
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[field.value ?? 0]}
                                        onValueChange={(value) => field.onChange(value[0])}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bonusPensionContribution"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bonus Contribution ({field.value}%)</FormLabel>
                                     <FormControl>
                                        <Slider
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[field.value ?? 0]}
                                        onValueChange={(value) => field.onChange(value[0])}
                                        disabled={(watchedValues.bonus ?? 0) <= 0}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <Separator />
                            <h4 className="font-semibold text-sm">Comparison</h4>
                             <FormField
                                control={form.control}
                                name="enablePensionComparison"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between">
                                    <FormLabel>Enable Pension Comparison</FormLabel>
                                    <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            {watchedValues.enablePensionComparison && (
                                <FormField
                                    control={form.control}
                                    name="adjustedPensionContribution"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Adjusted Contribution ({field.value}%)</FormLabel>
                                        <FormControl>
                                            <Slider
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={[field.value ?? 0]}
                                            onValueChange={(value) => field.onChange(value[0])}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    )}
                    {watchedValues.showPayRise && (
                        <div className="space-y-4 rounded-md border p-4 md:col-span-2">
                            <h3 className="font-semibold text-base">Pay Rise</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <FormField
                                control={form.control}
                                name="hasPayRise"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm col-span-2">
                                    <FormLabel>Do you have a planned pay rise?</FormLabel>
                                    <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            {watchedValues.hasPayRise && (
                                <>
                                <FormField
                                control={form.control}
                                name="newSalary"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>New Annual Salary (£)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 60000" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={form.control}
                                name="payRiseMonth"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Effective Month</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select month" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {months.map((month) => (
                                            <SelectItem key={month} value={month}>
                                            {month}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                </>
                            )}
                            </div>
                        </div>
                    )}

                    {watchedValues.showStudentLoan && (
                        <div className="space-y-4 rounded-md border p-4 md:col-span-2 lg:col-span-2">
                            <h3 className="font-semibold text-base flex items-center gap-2"><GraduationCap className="h-5 w-5" />Student Loan</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="studentLoanPlan1"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <FormLabel>Plan 1</FormLabel>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="studentLoanPlan2"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <FormLabel>Plan 2</FormLabel>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="studentLoanPlan4"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <FormLabel>Plan 4</FormLabel>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="studentLoanPlan5"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <FormLabel>Plan 5</FormLabel>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="postgraduateLoan"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <FormLabel>Postgraduate Loan</FormLabel>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            </div>
                        </div>
                    )}

                    {watchedValues.showChildcareCalculator && (
                        <div className="space-y-6 md:col-span-2 lg:col-span-2">
                            <div className="space-y-4 rounded-md border p-4">
                                <h3 className="font-semibold text-base">Childcare Details</h3>
                                <FormField
                                    control={form.control}
                                    name="numberOfChildren"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Number of Children</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="e.g., 1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="daysPerWeekInChildcare"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Days per Week (per child)</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="e.g., 3" {...field} disabled={(watchedValues.numberOfChildren ?? 0) <= 0} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="dailyChildcareRate"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Daily Rate (£ per child)</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="e.g., 60" {...field} disabled={(watchedValues.numberOfChildren ?? 0) <= 0} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                            </div>
                            <div className="space-y-4 rounded-md border p-4">
                                <h3 className="font-semibold text-base">Partner & Benefits</h3>
                                <FormField
                                    control={form.control}
                                    name="partnerIncome"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Partner's Annual Income (£)</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="e.g., 50000" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="registeredChildcareProvider"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between">
                                        <FormLabel>Provider is registered?</FormLabel>
                                        <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={(watchedValues.numberOfChildren ?? 0) <= 0}
                                        />
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="childDisabled"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between">
                                        <FormLabel>Any child disabled?</FormLabel>
                                        <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={(watchedValues.numberOfChildren ?? 0) <= 0}
                                        />
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="claimingUniversalCredit"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between">
                                        <FormLabel>Claiming Universal Credit?</FormLabel>
                                        <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="claimingTaxFreeChildcare"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between">
                                        <FormLabel>Claiming Tax-Free Childcare?</FormLabel>
                                        <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    )}
                </div>
              </CardContent>
            </form>
          </Form>
        </Card>

        <div className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {watchedValues.enablePensionComparison ? (
                    <Tabs defaultValue="current">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="current">Current Results</TabsTrigger>
                            <TabsTrigger value="adjusted">Adjusted Results ({watchedValues.adjustedPensionContribution}%)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="current">
                            {renderResultsPanel(results, "Your Annual Results (Current)")}
                        </TabsContent>
                        <TabsContent value="adjusted">
                            {renderResultsPanel(adjustedResults, `Your Annual Results (Adjusted ${watchedValues.adjustedPensionContribution}%)`)}
                        </TabsContent>
                    </Tabs>
                ) : (
                    renderResultsPanel(results, "Your Annual Results")
                )}

                {watchedValues.enablePensionComparison ? (
                     <Tabs defaultValue="current">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="current">Current Breakdown</TabsTrigger>
                            <TabsTrigger value="adjusted">Adjusted Breakdown ({watchedValues.adjustedPensionContribution}%)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="current">
                           {renderMonthlyBreakdownPanel(results, "Monthly Breakdown (Current)")}
                        </TabsContent>
                        <TabsContent value="adjusted">
                           {renderMonthlyBreakdownPanel(adjustedResults, `Monthly Breakdown (Adjusted ${watchedValues.adjustedPensionContribution}%)`)}
                        </TabsContent>
                    </Tabs>
                ) : (
                    results && renderMonthlyBreakdownPanel(results, "Monthly Breakdown")
                )}
            </div>

            <Tabs defaultValue="tax-advisor" className="w-full">
              <TabsList className={`grid w-full ${watchedValues.showChildcareCalculator ? 'grid-cols-3' : 'grid-cols-1'}`}>
                <TabsTrigger value="tax-advisor"><Lightbulb className="text-accent" />AI Tax Advisor</TabsTrigger>
                {watchedValues.showChildcareCalculator && <>
                    <TabsTrigger value="childcare-advisor"><Baby className="text-accent" />AI £100k Advisor</TabsTrigger>
                    <TabsTrigger value="childcare-calculator"><HelpCircle className="text-accent" />Childcare Support Calculator</TabsTrigger>
                </>}
              </TabsList>
              <TabsContent value="tax-advisor">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2"><Lightbulb className="text-accent" />AI Tax Advisor</CardTitle>
                        <CardDescription>Get personalized tips and ask follow-up questions.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        <div ref={taxChatContainerRef} className="h-64 overflow-y-auto p-4 border rounded-md mb-4 bg-muted/20 space-y-4">
                            {isTaxChatLoading && taxChatHistory.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : taxChatHistory.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center text-muted-foreground">
                                        Click the button to generate your initial tax-saving tips.
                                    </div>
                                </div>
                            ) : (
                                taxChatHistory.map((msg, index) => (
                                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`p-3 rounded-lg max-w-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            {isTaxChatLoading && taxChatHistory.length > 0 && (
                                <div className="flex justify-start">
                                    <div className="p-3 rounded-lg bg-secondary">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                </div>
                            )}
                        </div>
                        {taxChatHistory.length === 0 ? (
                            <Button onClick={handleGenerateInitialTips} disabled={isTaxChatLoading}>
                                {isTaxChatLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : "Generate Tax Saving Tips"}
                            </Button>
                        ) : (
                            <form onSubmit={handleTaxChatSubmit} className="flex gap-2">
                                <Textarea
                                    placeholder="Ask a follow-up question..."
                                    value={taxChatInput}
                                    onChange={(e) => setTaxChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleTaxChatSubmit(e as any);
                                    }
                                    }}
                                    disabled={isTaxChatLoading}
                                    rows={1}
                                    className="flex-grow resize-none"
                                />
                                <Button type="submit" disabled={isTaxChatLoading || !taxChatInput.trim()} size="icon">
                                    <Send />
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>
              {watchedValues.showChildcareCalculator && <>
                <TabsContent value="childcare-advisor">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center gap-2"><Baby className="text-accent" />AI Childcare &amp; Salary Sacrifice Advisor</CardTitle>
                            <CardDescription>Analyze costs and ask questions about managing the £100k income threshold.</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm">
                        <div ref={childcareChatContainerRef} className="h-auto p-4 border rounded-md mb-4 bg-muted/20 space-y-4">
                                {isChildcareChatLoading && childcareChatHistory.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : childcareChatHistory.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center text-muted-foreground">
                                            Fill in childcare details and click below to generate advice.
                                        </div>
                                    </div>
                                ) : (
                                    childcareChatHistory.map((msg, index) => (
                                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                                            <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderFormattedText(msg.content) }} />
                                            </div>
                                        </div>
                                    ))
                                )}
                                {isChildcareChatLoading && childcareChatHistory.length > 0 && (
                                    <div className="flex justify-start">
                                        <div className="p-3 rounded-lg bg-secondary">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            {childcareChatHistory.length === 0 ? (
                                <Button onClick={handleGenerateChildcareAdvice} disabled={isChildcareChatLoading || (watchedValues.numberOfChildren ?? 0) <= 0}>
                                    {isChildcareChatLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> : "Analyze Childcare Costs"}
                                </Button>
                            ) : (
                                <form onSubmit={handleChildcareChatSubmit} className="flex gap-2">
                                    <Textarea
                                        placeholder="Ask a follow-up question..."
                                        value={childcareChatInput}
                                        onChange={(e) => setChildcareChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleChildcareChatSubmit(e as any);
                                        }
                                        }}
                                        disabled={isChildcareChatLoading}
                                        rows={1}
                                        className="flex-grow resize-none"
                                    />
                                    <Button type="submit" disabled={isChildcareChatLoading || !childcareChatInput.trim()} size="icon">
                                        <Send />
                                    </Button>
                                </form>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col items-start gap-4">
                            {childcareAdvice && childcareAdvice.suggestedPensionContributionPercentage && (
                            <div className="rounded-md border p-4 w-full bg-secondary/50">
                                <p className="text-sm font-medium mb-2">
                                To reduce your adjusted net income to £100,000, the AI suggests increasing your pension contribution to <strong>{childcareAdvice.suggestedPensionContributionPercentage}%</strong>.
                                </p>
                                <Button
                                size="sm"
                                onClick={() => {
                                    form.setValue('pensionContribution', childcareAdvice.suggestedPensionContributionPercentage!, { shouldValidate: true });
                                    toast({
                                    title: "Pension Updated",
                                    description: `Your pension contribution has been set to ${childcareAdvice.suggestedPensionContributionPercentage}%.`,
                                    });
                                }}
                                >
                                Apply Suggestion
                                </Button>
                            </div>
                            )}
                        </CardFooter>
                    </Card>
                </TabsContent>
                <TabsContent value="childcare-calculator">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center gap-2"><HelpCircle className="text-accent" />Childcare Support Calculator</CardTitle>
                            <CardDescription>Answer the questions to get a detailed breakdown of your childcare support eligibility.</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm">
                        <div ref={taxChildcareChatContainerRef} className="h-96 overflow-y-auto p-4 border rounded-md mb-4 bg-muted/20 space-y-4">
                                {isTaxChildcareChatLoading && taxChildcareChatHistory.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : taxChildcareChatHistory.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center text-muted-foreground">
                                            Ask the AI to start the calculation. For example, type "Start".
                                        </div>
                                    </div>
                                ) : (
                                    taxChildcareChatHistory.map((msg, index) => (
                                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                                                <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderFormattedText(msg.content) }} />
                                            </div>
                                        </div>
                                    ))
                                )}
                                {isTaxChildcareChatLoading && taxChildcareChatHistory.length > 0 && (
                                    <div className="flex justify-start">
                                        <div className="p-3 rounded-lg bg-secondary">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <form onSubmit={handleTaxChildcareChatSubmit} className="flex gap-2">
                                <Textarea
                                    placeholder="Your answer..."
                                    value={taxChildcareChatInput}
                                    onChange={(e) => setTaxChildcareChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleTaxChildcareChatSubmit(e as any);
                                    }
                                    }}
                                    disabled={isTaxChildcareChatLoading}
                                    rows={1}
                                    className="flex-grow resize-none"
                                />
                                <Button type="submit" disabled={isTaxChildcareChatLoading || !taxChildcareChatInput.trim()} size="icon">
                                    <Send />
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
              </>}
            </Tabs>
        </div>
      </div>
    </FormProvider>
  );
}

    
