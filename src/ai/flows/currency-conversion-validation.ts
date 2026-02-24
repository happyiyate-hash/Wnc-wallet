'use server';

/**
 * @fileOverview A Trade Guardian AI agent that validates swap quotes.
 * It analyzes price impact, gas fees, and liquidity to prevent bad trades.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SwapValidationInputSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
  amount: z.number(),
  convertedAmount: z.number(),
  priceImpact: z.number().describe('The price impact percentage (negative for loss).'),
  gasFeeUsd: z.number().describe('The estimated gas fee in USD.'),
  chainName: z.string(),
});

export type SwapValidationInput = z.infer<typeof SwapValidationInputSchema>;

const SwapValidationOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the trade is considered healthy.'),
  validationReason: z.string().describe('Explanation of the health status or warnings.'),
  suggestion: z.string().optional().describe('Actionable advice (e.g., "Wait for gas to drop").'),
});

export type SwapValidationOutput = z.infer<typeof SwapValidationOutputSchema>;

const swapValidationPrompt = ai.definePrompt({
  name: 'swapValidationPrompt',
  input: {schema: SwapValidationInputSchema},
  output: {schema: SwapValidationOutputSchema},
  prompt: `You are an expert Crypto Trade Guardian. Analyze the following swap quote on the {{chainName}} network.

Trade Details:
- Swap: {{amount}} {{fromCurrency}} -> {{convertedAmount}} {{toCurrency}}
- Price Impact: {{priceImpact}}%
- Gas Fee: ${{gasFeeUsd}}

Your Task:
1. Check if the price impact is too high (usually < -2% is bad).
2. Check if the gas fee is disproportionate to the trade amount (e.g., $20 gas for a $50 trade).
3. Determine if the trade is "Valid" (safe/healthy) or has warnings.

Provide a clear validationReason and a helpful suggestion.
If impact is < -3%, mark isValid: false.
If gas is > 20% of trade value, warn the user.`,
});

export async function validateSwapHealth(input: SwapValidationInput): Promise<SwapValidationOutput> {
  const {output} = await swapValidationPrompt(input);
  return output!;
}
