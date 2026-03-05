
import { getGasFee } from "../wallets/services/fee-service";

/**
 * INSTITUTIONAL SWAP FEE & VALIDATION ENGINE
 * Version: 1.2.0
 * 
 * Handles fee calculation and enforces minimum swap amounts based on USD valuation.
 */

const MIN_SWAP_USD_HIGH = 2.00; // Minimum for BTC, ETH, SOL, etc.
const MIN_SWAP_USD_LOW = 0.10;  // Minimum for low-value/dust tokens

const HIGH_VALUE_TOKENS = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'MATIC', 'ARB', 'OP', 'DOT', 'LINK'];

/**
 * Validates if the swap amount meets the institutional minimum thresholds.
 */
export function validateSwapAmount(amount: number, tokenSymbol: string, tokenPriceUsd: number) {
  const amountUsd = amount * tokenPriceUsd;
  const isHighValue = HIGH_VALUE_TOKENS.includes(tokenSymbol.toUpperCase());
  const minRequired = isHighValue ? MIN_SWAP_USD_HIGH : MIN_SWAP_USD_LOW;

  if (amountUsd < minRequired) {
    throw new Error(`Amount below minimum swap limit ($${minRequired.toFixed(2)} USD equivalent required).`);
  }

  return true;
}

/**
 * Calculate admin and network fees for a swap and return final receive amount.
 *
 * @param rawAmountUsd - the USD value of the amount the user wants to swap
 * @param chain - blockchain key or symbol (e.g., "ETH", "BTC", "Solana")
 * @param adminFeePercentage - optional percentage for admin fee (0.05 = 5%)
 */
export async function calculateSwapFees(
  rawAmountUsd: number,
  chain: string,
  adminFeePercentage?: number
) {
  // 1️⃣ Fetch the blockchain network fee (in USD)
  const blockchainFee = await getGasFee(chain);
  const networkFeeUSD = blockchainFee.estimatedFeeUSD;

  // 2️⃣ Calculate admin fee as percentage (default 5% per institutional model)
  const percentage = adminFeePercentage ?? 0.05; 
  let adminFee = rawAmountUsd * percentage;

  // For very small amounts, set a minimum admin fee (e.g., $0.05)
  if (adminFee < 0.05) {
    adminFee = 0.05;
  }

  // 3️⃣ Combine network fee + admin fee
  const totalNetworkFee = adminFee + networkFeeUSD;

  // 4️⃣ Return structured result
  return {
    rawAmountUsd,
    adminFee,
    blockchainFee: networkFeeUSD,
    networkFee: totalNetworkFee,
  };
}
