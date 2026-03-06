'use server';

import { 
  analyzeSwapConditions,
  type SwapAnalysisInput,
} from '@/ai/flows/currency-conversion-validation';

export async function currencyConversionWithLLMValidation(input: SwapAnalysisInput) {
  // Trade Guardian AI Analysis (Advisory Only)
  return await analyzeSwapConditions(input);
}
