'use server';

/**
 * @fileOverview A Trade Guardian AI agent that analyzes swap quotes.
 * It provides supplementary market advice and explanations to the user.
 * It does NOT decide whether a trade is allowed to proceed.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SwapAnalysisInputSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
  amount: z.number(),
  convertedAmount: z.number(),
  priceImpact: z.number().describe('The price impact percentage (negative for loss).'),
  gasFeeUsd: z.number().describe('The estimated gas fee in USD.'),
  chainName: z.string(),
});

export type SwapAnalysisInput = z.infer<typeof SwapAnalysisInputSchema>;

const SwapAnalysisOutputSchema = z.object({
  analysis: z.string().describe('A professional summary of the trade conditions.'),
  advice: z.string().describe('Actionable advice for the user (e.g., "Optimal conditions" or "High gas alert").'),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe('The calculated risk level based on price impact and fees.'),
});

export type SwapAnalysisOutput = z.infer<typeof SwapAnalysisOutputSchema>;

const swapAnalysisPrompt = ai.definePrompt({
  name: 'swapAnalysisPrompt',
  input: {schema: SwapAnalysisInputSchema},
  output: {schema: SwapAnalysisOutputSchema},
  prompt: `You are an expert Crypto Trade Analyst. Analyze the following swap quote on the {{{chainName}}} network.

Trade Details:
- Swap: {{{amount}}} {{{fromCurrency}}} -> {{{convertedAmount}}} {{{toCurrency}}}
- Price Impact: {{{priceImpact}}}%
- Gas Fee: \${{{gasFeeUsd}}}

Your Task:
1. Explain the market conditions for this trade in simple but professional language.
2. Evaluate the gas fee relative to the trade size.
3. Provide helpful advice (e.g., "This is a highly efficient route" or "Consider a larger swap to offset the gas cost").
4. Assign a risk level based on slippage and fee overhead.

Do NOT block the trade. Your role is purely advisory. Provide clear, concise insights for the user's information.`,
});

export async function analyzeSwapConditions(input: SwapAnalysisInput): Promise<SwapAnalysisOutput> {
  const {output} = await swapAnalysisPrompt(input);
  return output!;
}
