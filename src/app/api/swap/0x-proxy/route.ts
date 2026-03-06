
import { NextRequest, NextResponse } from 'next/server';

/**
 * INSTITUTIONAL 0X PROTOCOL PROXY
 * Version: 1.0.0
 * 
 * Safely handles indicative price and execution quote requests.
 * Enforces the 1.00% (100 BPS) platform fee.
 */

const ZEROX_API_KEY = '5eebaf6f-e024-41d2-a18f-e05c241129c3';

const BASE_URLS: { [key: string]: string } = {
  '1': 'https://api.0x.org',
  '137': 'https://polygon.api.0x.org',
  '56': 'https://bsc.api.0x.org',
  '43114': 'https://avalanche.api.0x.org',
  '42161': 'https://arbitrum.api.0x.org',
  '10': 'https://optimism.api.0x.org',
  '8453': 'https://base.api.0x.org',
  '59144': 'https://linea.api.0x.org',
  '534352': 'https://scroll.api.0x.org'
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chainId = searchParams.get('chainId') || '1';
  const mode = searchParams.get('mode') || 'price'; // 'price' or 'quote'
  
  const baseUrl = BASE_URLS[chainId];
  if (!baseUrl) {
    return NextResponse.json({ error: `Chain ${chainId} not supported by 0x` }, { status: 400 });
  }

  // Forward all other relevant params
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'chainId' && key !== 'mode') {
      params.append(key, value);
    }
  });

  // Strict Institutional Fee Parameters (1.00%)
  params.set('buyTokenPercentageFee', '0.01');
  params.set('feeRecipient', '0x7f3f4206017C0aACF7A94C9eF7B80563984aD288');

  try {
    const targetUrl = `${baseUrl}/swap/v1/${mode}?${params.toString()}`;
    console.log(`[0X_PROXY] Dispatching to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      headers: {
        '0x-api-key': ZEROX_API_KEY,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[0X_PROXY_ERROR]', data);
      return NextResponse.json({ 
        error: data.reason || '0x Protocol Handshake Failed',
        details: data.validationErrors
      }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[0X_PROXY_CRITICAL]', error.message);
    return NextResponse.json({ error: 'Internal 0x Proxy Failure' }, { status: 500 });
  }
}
