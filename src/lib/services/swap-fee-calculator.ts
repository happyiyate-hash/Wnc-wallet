
import { getGasFee } from "../wallets/services/fee-service";

/**
 * INSTITUTIONAL SWAP FEE CALCULATOR
 * Version: 1.0.0
 * 
 * Calculate admin and network fees for a swap and return final receive amount.
 *
 * @param rawAmountUsd - the USD value of the amount the user wants to swap
 * @param chain - blockchain key or symbol (e.g., "ETH", "BTC", "Solana")
 * @param adminFeePercentage - optional percentage for admin fee (0.01 = 1%)
 */
export async function calculateSwapFees(
  rawAmountUsd: number,
  chain: string,
  adminFeePercentage?: number
) {
  // 1️⃣ Fetch the blockchain network fee (in USD)
  const blockchainFee = await getGasFee(chain);
  const networkFeeUSD = blockchainFee.estimatedFeeUSD;

  // 2️⃣ Calculate admin fee as percentage (default 5% per user instructions)
  const percentage = adminFeePercentage ?? 0.05; // 5%
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
