'use server';

import { 
  validateSwapHealth,
  type SwapValidationInput,
} from '@/ai/flows/currency-conversion-validation';

export async function currencyConversionWithLLMValidation(input: SwapValidationInput) {
  // Trade Guardian AI check
  return await validateSwapHealth(input);
}
