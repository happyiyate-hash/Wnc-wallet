
import { getGasFee } from "../wallets/services/fee-service";

/**
 * INSTITUTIONAL FEE & VALIDATION ENGINE
 * Version: 1.4.0 (Send-Fee Extension)
 */

const MIN_SWAP_USD_HIGH = 2.00; 
const MIN_SWAP_USD_LOW = 0.10;  

const HIGH_VALUE_TOKENS = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'MATIC', 'ARB', 'OP', 'DOT', 'LINK'];

const RESTRICTED_PAIRS = [
  { from: 'BTC', to: 'USDT' },
];

export function checkPairRestriction(fromSymbol: string, toSymbol: string): { isRestricted: boolean; message?: string } {
  const isRestricted = RESTRICTED_PAIRS.some(
    pair => pair.from === fromSymbol.toUpperCase() && pair.to === toSymbol.toUpperCase()
  );

  if (isRestricted) {
    return {
      isRestricted: true,
      message: "⚠️ This swap is currently unavailable. Support for this pair will be added in a future update."
    };
  }

  return { isRestricted: false };
}

export function validateSwapAmount(amount: number, tokenSymbol: string, tokenPriceUsd: number) {
  const amountUsd = amount * tokenPriceUsd;
  const isHighValue = HIGH_VALUE_TOKENS.includes(tokenSymbol.toUpperCase());
  const minRequired = isHighValue ? MIN_SWAP_USD_HIGH : MIN_SWAP_USD_LOW;

  if (amountUsd < minRequired) {
    throw new Error(`Amount below minimum limit ($${minRequired.toFixed(2)} USD equivalent required).`);
  }

  return true;
}

/**
 * Calculate institutional fees for a payment/send operation.
 */
export async function calculateSendFees(amountUsd: number, chain: string) {
    const blockchainFee = await getGasFee(chain);
    const networkFeeUSD = blockchainFee.estimatedFeeUSD;

    // Institutional 5% Fee Model
    const percentage = 0.05; 
    let adminFee = amountUsd * percentage;

    if (adminFee < 0.05 && amountUsd > 0) {
      adminFee = 0.05;
    }

    return {
      amountUsd,
      adminFee,
      networkFee: networkFeeUSD,
      totalProtocolFee: adminFee + networkFeeUSD,
    };
}

/**
 * Calculate admin and network fees for a swap.
 */
export async function calculateSwapFees(
  rawAmountUsd: number,
  chain: string,
  adminFeePercentage?: number
) {
  const blockchainFee = await getGasFee(chain);
  const networkFeeUSD = blockchainFee.estimatedFeeUSD;

  const percentage = adminFeePercentage ?? 0.05; 
  let adminFee = rawAmountUsd * percentage;

  if (adminFee < 0.05) {
    adminFee = 0.05;
  }

  const totalNetworkFee = adminFee + networkFeeUSD;

  return {
    rawAmountUsd,
    adminFee,
    blockchainFee: networkFeeUSD,
    networkFee: totalNetworkFee,
  };
}
