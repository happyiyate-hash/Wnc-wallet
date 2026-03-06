
import { getGasFee } from "../wallets/services/fee-service";
import { getFeeRecipient } from "../wallets/services/fee-recipients";

/**
 * INSTITUTIONAL FEE & VALIDATION ENGINE
 * Version: 1.6.0 (Monetization Sync)
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
 * Standardized at 5% for P2P/Transfers.
 */
export async function calculateSendFees(amountUsd: number, chain: string) {
    const blockchainFee = await getGasFee(chain);
    const networkFeeUSD = blockchainFee.estimatedFeeUSD;
    const recipient = getFeeRecipient(chain);

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
      feeRecipient: recipient
    };
}

/**
 * Calculate admin and network fees for a swap.
 * Standardized at 0.5% (50 BPS) to match 0x integrator protocol.
 */
export async function calculateSwapFees(
  rawAmountUsd: number,
  chain: string,
  adminFeePercentage?: number
) {
  const blockchainFee = await getGasFee(chain);
  const networkFeeUSD = blockchainFee.estimatedFeeUSD;
  const recipient = getFeeRecipient(chain);

  const percentage = adminFeePercentage ?? 0.005; // 0.5% Institutional Integrator Fee
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
    feeRecipient: recipient
  };
}
