"use client";

import { useState, useMemo, useEffect } from "react";
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
import { AlertTriangle, Lightbulb, Loader2 } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { Separator } from "@/components/ui/separator";

import { taxCalculatorSchema, type TaxCalculatorSchema, type CalculationResults, regions } from "@/lib/definitions";
import { calculateTakeHomePay } from "@/lib/tax-logic";
import { generateTaxSavingTipsAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

const initialValues: TaxCalculatorSchema = {
  salary: 50000,
  bonus: 0,
  pensionContribution: 5,
  region: "England",
};

export default function TaxCalculator() {
  const { toast } = useToast();
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [aiTips, setAiTips] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<TaxCalculatorSchema>({
    resolver: zodResolver(taxCalculatorSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  const watchedValues = form.watch();

  useEffect(() => {
    const subscription = form.watch((value) => {
      const parsed = taxCalculatorSchema.safeParse(value);
      if (parsed.success) {
        setResults(calculateTakeHomePay(parsed.data));
      } else {
        setResults(null);
      }
    });
    // Initial calculation
    setResults(calculateTakeHomePay(form.getValues()));
    return () => subscription.unsubscribe();
  }, [form]);


  const handleGenerateTips = async () => {
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

    setIsGenerating(true);
    setAiTips("");

    const actionResult = await generateTaxSavingTipsAction({
      salary: parsed.data.salary,
      bonus: parsed.data.bonus,
      pensionContributions: (parsed.data.salary + (parsed.data.bonus ?? 0)) * ((parsed.data.pensionContribution ?? 0) / 100),
      otherTaxableBenefits: 0,
      region: parsed.data.region,
    });

    if (actionResult.success && actionResult.data) {
      setAiTips(actionResult.data.tips);
    } else {
      toast({
        title: "Error",
        description: actionResult.error,
        variant: "destructive",
      });
    }

    setIsGenerating(false);
  };
  
  const chartConfig = useMemo(() => {
    if (!results) return {};
    return results.breakdown.reduce((acc, item) => {
        acc[item.name] = { label: item.name, color: item.fill };
        return acc;
    }, {} as any)
  }, [results]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);

  return (
    <FormProvider {...form}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline">Your Financial Details</CardTitle>
            <CardDescription>
              Enter your income details to calculate your take-home pay.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form>
              <CardContent className="space-y-6">
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
              </CardContent>
            </form>
          </Form>
        </Card>

        <div className="lg:col-span-3 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Your Results</CardTitle>
                    <CardDescription>An estimate of your take-home pay based on your details.</CardDescription>
                </CardHeader>
                <CardContent>
                    {results ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Monthly Take-Home</p>
                                    <p className="text-4xl font-bold text-primary">{formatCurrency(results.monthlyTakeHome)}</p>
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
                                        <p className="font-semibold">{formatCurrency(results.grossMonthlyIncome)}</p>
                                        <p className="font-semibold">{formatCurrency(results.monthlyTakeHome)}</p>
                                        <p className="font-semibold">{formatCurrency(results.monthlyTax)}</p>
                                        <p className="font-semibold">{formatCurrency(results.monthlyNic)}</p>
                                        <p className="font-semibold">{formatCurrency(results.monthlyPension)}</p>
                                    </div>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm text-muted-foreground">Effective Tax Rate (Annual)</p>
                                    <p className="text-lg font-semibold">{results.effectiveTaxRate.toFixed(2)}%</p>
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

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2"><Lightbulb className="text-accent" />AI Tax Advisor</CardTitle>
                    <CardDescription>Get personalized tips to potentially reduce your taxable income.</CardDescription>
                </CardHeader>
                <CardContent className="min-h-[100px] text-sm">
                    {isGenerating ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : aiTips ? (
                        <p className="whitespace-pre-wrap">{aiTips}</p>
                    ) : (
                        <p className="text-muted-foreground">Click the button below to generate your tax-saving tips.</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleGenerateTips} disabled={isGenerating}>
                        {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : "Generate Tax Saving Tips"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </FormProvider>
  );
}

    