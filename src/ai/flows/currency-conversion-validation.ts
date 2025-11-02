'use server';

/**
 * @fileOverview Converts between different cryptocurrencies using a real-time conversion tool,
 * with an LLM validating the data before display to ensure accuracy and prevent misinformation.
 *
 * - currencyConversionWithLLMValidation - A function that handles the currency conversion process.
 * - CurrencyConversionWithLLMValidationInput - The input type for the currencyConversionWithLLMValidation function.
 * - CurrencyConversionWithLLMValidationOutput - The return type for the currencyConversionWithLLMValidation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CurrencyConversionWithLLMValidationInputSchema = z.object({
  fromCurrency: z.string().describe('The currency to convert from (e.g., BTC).'),
  toCurrency: z.string().describe('The currency to convert to (e.g., USD).'),
  amount: z.number().describe('The amount to convert.'),
});

export type CurrencyConversionWithLLMValidationInput = z.infer<typeof CurrencyConversionWithLLMValidationInputSchema>;

const CurrencyConversionWithLLMValidationOutputSchema = z.object({
  convertedAmount: z.number().describe('The converted amount in the target currency.'),
  isValid: z.boolean().describe('Whether the conversion data is valid according to the LLM.'),
  validationReason: z.string().optional().describe('The reason why the conversion data is invalid, if applicable.'),
});

export type CurrencyConversionWithLLMValidationOutput = z.infer<typeof CurrencyConversionWithLLMValidationOutputSchema>;


const currencyConverterTool = ai.defineTool(
    {
      name: 'currencyConverter',
      description: 'Converts an amount from one cryptocurrency to another using a real-time API.',
      inputSchema: z.object({
        fromCurrency: z.string().describe('The currency to convert from (e.g., BTC).'),
        toCurrency: z.string().describe('The currency to convert to (e.g., USD).'),
        amount: z.number().describe('The amount to convert.'),
      }),
      outputSchema: z.object({
        convertedAmount: z.number().describe('The converted amount in the target currency.'),
      }),
    },
    async (input) => {
      // Replace with actual API call to a currency conversion service
      console.log(`Calling currency conversion API with ${input.amount} ${input.fromCurrency} to ${input.toCurrency}`);
      const conversionRate = 0.000015; // Mock conversion rate for demonstration
      const convertedAmount = input.amount * conversionRate;

      return {
        convertedAmount: convertedAmount,
      };
    }
);

const currencyValidationPrompt = ai.definePrompt({
  name: 'currencyValidationPrompt',
  input: {schema: CurrencyConversionWithLLMValidationOutputSchema},
  prompt: `You are an expert at identifying misinformation, especially with currency values.  Given the following cryptocurrency conversion data, determine if the \"convertedAmount\" is plausible, safe and suitable to display to the user, considering the \"fromCurrency\", \"toCurrency\", and the original \"amount\".

  Return whether the data is valid, and if not, the reason.
  If the data seems accurate and safe, return isValid: true. If the data is potentially dangerous or inaccurate, return isValid: false and provide a validationReason.
  Here is the conversion data:
  From Currency: {{{fromCurrency}}}
  To Currency: {{{toCurrency}}}
  Amount: {{{amount}}}
  Converted Amount: {{{convertedAmount}}}

  Consider these factors to test for validity:
  - Is the conversion rate plausible given the currencies involved?
  - Is there any indication of fraud or malicious intent?
  - Could displaying this information mislead the user?

  Return in the following format:
  \"isValid\": true/false,
  \"validationReason\": \"reason\" // only if isValid is false`,
});

const currencyConversionFlow = ai.defineFlow(
  {
    name: 'currencyConversionFlow',
    inputSchema: CurrencyConversionWithLLMValidationInputSchema,
    outputSchema: CurrencyConversionWithLLMValidationOutputSchema,
  },
  async input => {
    const conversionResult = await currencyConverterTool(input);

    // Validate the data using the LLM
    const validationInput: CurrencyConversionWithLLMValidationOutput = {
      ...input,
      ...conversionResult,
      isValid: true, // initial value, prompt will override this
      validationReason: undefined,
    } as CurrencyConversionWithLLMValidationOutput;
    const {output} = await currencyValidationPrompt(validationInput);

    return output!;
  }
);

export async function currencyConversionWithLLMValidation(input: CurrencyConversionWithLLMValidationInput): Promise<CurrencyConversionWithLLMValidationOutput> {
  return currencyConversionFlow(input);
}

export type {currencyConversionFlow as CurrencyConversionFlow};
