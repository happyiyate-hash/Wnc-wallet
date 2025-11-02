"use client";

import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { currencyConversionWithLLMValidation } from "@/app/actions";
import { CRYPTO_CURRENCIES, FIAT_CURRENCIES } from "@/lib/constants";
import type { CurrencyConversionWithLLMValidationOutput } from "@/ai/flows/currency-conversion-validation";

const formSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  fromCurrency: z.string().min(1, "Please select a currency"),
  toCurrency: z.string().min(1, "Please select a currency"),
});

type FormValues = z.infer<typeof formSchema>;

export default function ConverterTab() {
  const [result, setResult] = useState<CurrencyConversionWithLLMValidationOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 1,
      fromCurrency: "BTC",
      toCurrency: "USD",
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsLoading(true);
    setResult(null);
    const response = await currencyConversionWithLLMValidation(data);
    setResult(response);
    setIsLoading(false);
  };

  return (
    <Card className="mt-6 shadow-lg border-none">
      <CardHeader>
        <CardTitle>Currency Converter</CardTitle>
        <CardDescription>Convert between cryptocurrencies with AI-powered validation.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" placeholder="1.0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-4">
              <FormField
                control={form.control}
                name="fromCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CRYPTO_CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pb-3 hidden sm:block">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <FormField
                control={form.control}
                name="toCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...CRYPTO_CURRENCIES, ...FIAT_CURRENCIES].map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isLoading && (
              <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Converting and validating with AI...</p>
              </div>
            )}
            {result && (
              <div className="pt-4">
                {result.isValid ? (
                  <Card className="bg-primary/5 border-primary/20 text-center">
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground">
                            {form.getValues('amount').toLocaleString()} {form.getValues('fromCurrency')} is approximately
                        </p>
                        <p className="text-4xl font-bold tracking-tighter text-primary">
                            {result.convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                            <span className="ml-2 text-2xl font-medium">{form.getValues('toCurrency')}</span>
                        </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>AI Validation Failed!</AlertTitle>
                    <AlertDescription>{result.validationReason || "The conversion rate seems implausible or risky."}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto ml-auto bg-accent text-accent-foreground hover:bg-accent/90">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait
                </>
              ) : (
                "Convert"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
