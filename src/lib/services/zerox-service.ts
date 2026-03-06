
'use client';

/**
 * INSTITUTIONAL 0X AGGREGATOR SERVICE (PROXY ENABLED)
 * Version: 3.0.0 (Revenue & Stability Update)
 * 
 * Routes requests through the secure backend proxy to prevent 
 * client-side key exposure and parameter malformation.
 */

export const zeroXService = {
  /**
   * Fetches an indicative price from the proxy.
   */
  async getPrice(chainId: number, sellToken: string, buyToken: string, sellAmount: string, takerAddress?: string) {
    const params = new URLSearchParams({
      chainId: chainId.toString(),
      mode: 'price',
      sellToken,
      buyToken,
      sellAmount
    });

    if (takerAddress) params.append('takerAddress', takerAddress);

    const response = await fetch(`/api/swap/0x-proxy?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '0x Price Handshake Failed');
    }

    return data;
  },

  /**
   * Generates a signed quote for execution via the proxy.
   */
  async getQuote(chainId: number, sellToken: string, buyToken: string, sellAmount: string, takerAddress: string) {
    const params = new URLSearchParams({
      chainId: chainId.toString(),
      mode: 'quote',
      sellToken,
      buyToken,
      sellAmount,
      takerAddress
    });

    const response = await fetch(`/api/swap/0x-proxy?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      if (data.details) {
        const firstErr = data.details[0];
        throw new Error(`0x Validation: ${firstErr.reason} (${firstErr.field})`);
      }
      throw new Error(data.error || '0x Quote Handshake Failed');
    }

    return data;
  }
};
