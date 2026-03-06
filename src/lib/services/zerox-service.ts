
'use client';

import { FEE_RECIPIENTS } from '../wallets/services/fee-recipients';

/**
 * INSTITUTIONAL 0X AGGREGATOR SERVICE
 * Version: 2.0.0 (Revenue Update)
 * 
 * Increased fee to 1.00% (100 BPS) for platform sustainability.
 */

const ZEROX_API_KEY = process.env.NEXT_PUBLIC_ZEROX_API_KEY || '5eebaf6f-e024-41d2-a18f-e05c241129c3';
const ADMIN_VAULT = FEE_RECIPIENTS.evm; 
const FEE_PERCENTAGE = '0.01'; // 1.00% Institutional Integrator Fee (100 BPS)

const ZEROX_BASE_URLS: { [chainId: number]: string } = {
  1: 'https://api.0x.org',
  137: 'https://polygon.api.0x.org',
  56: 'https://bsc.api.0x.org',
  43114: 'https://avalanche.api.0x.org',
  42161: 'https://arbitrum.api.0x.org',
  10: 'https://optimism.api.0x.org',
  8453: 'https://base.api.0x.org',
  59144: 'https://linea.api.0x.org',
  534352: 'https://scroll.api.0x.org'
};

export const zeroXService = {
  /**
   * Fetches an indicative price for UI display.
   */
  async getPrice(chainId: number, sellToken: string, buyToken: string, sellAmount: string, takerAddress?: string) {
    const baseUrl = ZEROX_BASE_URLS[chainId];
    if (!baseUrl) throw new Error(`0x protocol not supported on chain ${chainId}`);

    const sellAddr = sellToken.toLowerCase() === 'eth' || sellToken.toLowerCase().length < 5 ? 'ETH' : sellToken;
    const buyAddr = buyToken.toLowerCase() === 'eth' || buyToken.toLowerCase().length < 5 ? 'ETH' : buyToken;

    let url = `${baseUrl}/swap/v1/price?sellToken=${sellAddr}&buyToken=${buyAddr}&sellAmount=${sellAmount}&buyTokenPercentageFee=${FEE_PERCENTAGE}&feeRecipient=${ADMIN_VAULT}`;
    
    if (takerAddress) {
        url += `&takerAddress=${takerAddress}`;
    }
    
    const response = await fetch(url, {
      headers: { 
        '0x-api-key': ZEROX_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.reason || '0x Price Handshake Failed');
    }

    return response.json();
  },

  /**
   * Generates a signed quote for execution.
   */
  async getQuote(chainId: number, sellToken: string, buyToken: string, sellAmount: string, takerAddress: string) {
    const baseUrl = ZEROX_BASE_URLS[chainId];
    if (!baseUrl) throw new Error(`0x protocol not supported on chain ${chainId}`);

    const sellAddr = sellToken.toLowerCase() === 'eth' || sellToken.toLowerCase().length < 5 ? 'ETH' : sellToken;
    const buyAddr = buyToken.toLowerCase() === 'eth' || buyToken.toLowerCase().length < 5 ? 'ETH' : buyToken;

    const url = `${baseUrl}/swap/v1/quote?sellToken=${sellAddr}&buyToken=${buyAddr}&sellAmount=${sellAmount}&takerAddress=${takerAddress}&buyTokenPercentageFee=${FEE_PERCENTAGE}&feeRecipient=${ADMIN_VAULT}`;
    
    const response = await fetch(url, {
      headers: { 
        '0x-api-key': ZEROX_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
        const error = await response.json();
        if (error.validationErrors) {
            const firstErr = error.validationErrors[0];
            throw new Error(`0x Validation: ${firstErr.reason} (${firstErr.field})`);
        }
        throw new Error(error.reason || '0x Quote Handshake Failed');
    }

    return response.json();
  }
};
