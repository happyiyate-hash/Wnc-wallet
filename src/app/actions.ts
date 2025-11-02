'use server';

import { 
  currencyConversionWithLLMValidation as currencyConversionFlow,
  type CurrencyConversionWithLLMValidationInput,
} from '@/ai/flows/currency-conversion-validation';

export async function currencyConversionWithLLMValidation(input: CurrencyConversionWithLLMValidationInput) {
  // Add a delay to simulate network latency for better UX
  await new Promise(resolve => setTimeout(resolve, 1500));
  return await currencyConversionFlow(input);
}
