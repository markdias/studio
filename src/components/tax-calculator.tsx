
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
import { AlertTriangle, Lightbulb, Loader2, CalendarIcon, Baby, Send, Download, Upload } from "lucide-react";
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
import { calculateTakeHomePay } from "@/lib/tax-logic";
import { generateTaxSavingTipsAction, generateChildcareAdviceAction, financialChatAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";


const initialValues: TaxCalculatorSchema = {
  taxYear: "2024/25",
  salary: 50000,
  bonus: 0,
  pensionContribution: 5,
  region: "England",
  bonusMonth: "April",
  taxCode: "1257L",
  taxableBenefits: 0,
  isBonusPensionable: false,
  pensionableBonusPercentage: 100,
  hasPayRise: false,
  newSalary: 60000,
  payRiseMonth: "April",
  // Childcare
  numberOfChildren: 0,
  daysPerWeekInChildcare: 0,
  dailyChildcareRate: 0,
};

export default function TaxCalculator() {
  const { toast } = useToast();
  const [results, setResults] = useState<CalculationResults | null>(null);
  
  const [taxChatHistory, setTaxChatHistory] = useState<ChatMessage[]>([]);
  const [taxChatInput, setTaxChatInput] = useState("");
  const [isTaxChatLoading, setIsTaxChatLoading] = useState(false);

  const [childcareAdvice, setChildcareAdvice] = useState<ChildcareAdviceOutput | null>(null);
  const [childcareChatHistory, setChildcareChatHistory] = useState<ChatMessage[]>([]);
  const [childcareChatInput, setChildcareChatInput] = useState("");
  const [isChildcareChatLoading, setIsChildcareChatLoading] = useState(false);

  const taxChatContainerRef = useRef<HTMLDivElement>(null);
  const childcareChatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const form = useForm<TaxCalculatorSchema>({
    resolver: zodResolver(taxCalculatorSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  const watchedValues = form.watch();

  const calculate = () => {
    const parsed = taxCalculatorSchema.safeParse(form.getValues());
    if (parsed.success) {
      setResults(calculateTakeHomePay(parsed.data));
    } else {
      setResults(null);
    }
  }

  useEffect(() => {
    const subscription = form.watch((value) => {
      calculate();
    });
    calculate();
    return () => subscription.unsubscribe();
  }, [form]);

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

    const { salary, bonus, pensionContribution, taxableBenefits, region, isBonusPensionable, pensionableBonusPercentage } = parsed.data;

    const pensionableBonus = isBonusPensionable && bonus ? bonus * (pensionableBonusPercentage / 100) : 0;
    const totalPensionableIncome = salary + pensionableBonus;
    const pensionAmount = totalPensionableIncome * (pensionContribution / 100);

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
      annualGrossIncome: results?.grossAnnualIncome ?? parsed.data.salary,
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
  
  
  const chartConfig = useMemo(() => {
    if (!results) return {};
    return results.breakdown.reduce((acc, item) => {
        acc[item.name] = { label: item.name, color: item.fill };
        return acc;
    }, {} as any)
  }, [results]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);

  const renderFormattedText = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  };

  return (
    <FormProvider {...form}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
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
              <CardContent className="space-y-6">
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
                      <FormControl>
                        <Input type="text" placeholder="e.g., 1257L" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxableBenefits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Annual Taxable Benefits (£)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 2000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-4 rounded-md border p-4">
                  <FormField
                    control={form.control}
                    name="hasPayRise"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <FormLabel>Have a pay rise?</FormLabel>
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
                          <FormLabel>Pay Rise Effective Month</FormLabel>
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
                <FormField
                  control={form.control}
                  name="pensionContribution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Pension Contribution ({field.value}%)</FormLabel>
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
                 <div className="space-y-4 rounded-md border p-4">
                  <FormField
                    control={form.control}
                    name="isBonusPensionable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <FormLabel>Bonus is Pensionable</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={(watchedValues.bonus ?? 0) <= 0}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                   {watchedValues.isBonusPensionable && (watchedValues.bonus ?? 0) > 0 && (
                      <FormField
                        control={form.control}
                        name="pensionableBonusPercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pensionable Portion of Bonus ({field.value}%)</FormLabel>
                            <FormControl>
                              <Slider
                                min={0}
                                max={100}
                                step={1}
                                value={[field.value ?? 100]}
                                onValueChange={(value) => field.onChange(value[0])}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                </div>
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

                <div className="space-y-4 rounded-md border p-4">
                  <h3 className="font-semibold text-base">Childcare Details</h3>
                   <FormField
                      control={form.control}
                      name="numberOfChildren"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Children in Childcare</FormLabel>
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
                          <FormLabel>Daily Childcare Rate (£)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 60" {...field} disabled={(watchedValues.numberOfChildren ?? 0) <= 0} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              </CardContent>
            </form>
          </Form>
        </Card>

        <div className="lg:col-span-3 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Your Annual Results</CardTitle>
                    <CardDescription>An estimate of your annual take-home pay for tax year {watchedValues.taxYear}.</CardDescription>
                </CardHeader>
                <CardContent>
                    {results ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Annual Take-Home</p>
                                    <p className="text-4xl font-bold text-primary">{formatCurrency(results.annualTakeHome)}</p>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="text-right">
                                        <p className="text-muted-foreground">Gross Pay</p>
                                        <p className="text-muted-foreground">Take-Home</p>
                                        <p className="text-muted-foreground">Income Tax</p>
                                        <p className="text-muted-foreground">Nat. Ins.</p>
                                        <p className="text-muted-foreground">Pension</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold">{formatCurrency(results.grossAnnualIncome)}</p>
                                        <p className="font-semibold">{formatCurrency(results.annualTakeHome)}</p>
                                        <p className="font-semibold">{formatCurrency(results.annualTax)}</p>
                                        <p className="font-semibold">{formatCurrency(results.annualNic)}</p>
                                        <p className="font-semibold">{formatCurrency(results.annualPension)}</p>
                                    </div>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                  <h4 className="font-semibold">Taxable Income Breakdown</h4>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-md border p-2">
                                      <div className="text-right text-muted-foreground">Gross Pay:</div>
                                      <div>{formatCurrency(results.grossAnnualIncome)}</div>

                                      <div className="text-right text-muted-foreground">Taxable Benefits:</div>
                                      <div>+ {formatCurrency(watchedValues.taxableBenefits ?? 0)}</div>

                                      <div className="text-right text-muted-foreground">Pension:</div>
                                      <div>- {formatCurrency(results.annualPension)}</div>

                                      <div className="text-right text-muted-foreground">Personal Allowance:</div>
                                      <div>- {formatCurrency(results.personalAllowance)}</div>
                                      
                                      <div className="col-span-2"><Separator className="my-1"/></div>
                                      
                                      <div className="text-right font-bold">Taxable Income:</div>
                                      <div className="font-bold">{formatCurrency(results.annualTaxableIncome)}</div>
                                  </div>
                                </div>
                            </div>
                            <div className="min-h-[250px]">
                                <ChartContainer config={chartConfig} className="w-full h-full">
                                    <PieChart>
                                        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                                        <Pie data={results.breakdown} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                            {results.breakdown.map((entry) => (
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
                {results && (results.grossAnnualIncome > 50000 || results.grossAnnualIncome > 100000) && (
                    <CardFooter className="flex-col items-start gap-4">
                        {results.grossAnnualIncome > 100000 && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>£100,000 Threshold</AlertTitle>
                                <AlertDescription>
                                    Your personal tax allowance is reduced as your income is over £100,000.
                                </AlertDescription>
                            </Alert>
                        )}
                         {results.grossAnnualIncome > 50000 && results.grossAnnualIncome < 100000 && (
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

            {results && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2"><CalendarIcon className="text-primary h-6 w-6" />Monthly Breakdown</CardTitle>
                  <CardDescription>A month-by-month view of your estimated earnings and deductions.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Month</TableHead>
                        <TableHead className="text-right font-semibold">Gross Pay</TableHead>
                        <TableHead className="text-right font-semibold">Pension</TableHead>
                        <TableHead className="text-right font-semibold">Income Tax</TableHead>
                        <TableHead className="text-right font-semibold">Nat. Ins.</TableHead>
                        <TableHead className="text-right font-semibold text-primary">Take-Home</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.monthlyBreakdown.map((row) => (
                        <TableRow key={row.month} className={row.gross > (results.grossAnnualIncome / 12) * 1.05 ? "bg-secondary hover:bg-secondary/80 font-semibold" : ""}>
                          <TableCell>{row.month}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.gross)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.pension)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.tax)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.nic)}</TableCell>
                          <TableCell className="text-right text-primary font-bold">{formatCurrency(row.takeHome)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

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
                            <div className="text-center p-4 text-muted-foreground">Click the button below to generate your initial tax-saving tips.</div>
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

             <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2"><Baby className="text-accent" />AI Childcare &amp; Salary Sacrifice Advisor</CardTitle>
                    <CardDescription>Analyze costs and ask questions about managing the £100k income threshold.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                   <div ref={childcareChatContainerRef} className="h-64 overflow-y-auto p-4 border rounded-md mb-4 bg-muted/20 space-y-4">
                        {isChildcareChatLoading && childcareChatHistory.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : childcareChatHistory.length === 0 ? (
                            <div className="text-center p-4 text-muted-foreground">Fill in childcare details and click below to generate advice.</div>
                        ) : (
                            childcareChatHistory.map((msg, index) => (
                                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`p-3 rounded-lg max-w-md ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
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

        </div>
      </div>
    </FormProvider>
  );
}

