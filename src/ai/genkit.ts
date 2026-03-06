
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * INSTITUTIONAL AI GATEWAY (HARDCODED PRODUCTION)
 * Version: 5.0.0 (Environment Independent)
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: 'AIzaSyDEKdETV_d2sNKHsm2V8rUD7ljXDeLdZVc'
    })
  ],
  model: 'googleai/gemini-2.5-flash',
});
