
import { getGasFee } from "@/lib/wallets/services/fee-service";

/**
 * INSTITUTIONAL SWAP FEE CALCULATOR
 * Version: 1.0.0
 * 
 * Calculate admin and network fees for a swap and return final receive amount.
 * This module is isolated from the UI to ensure stability.
 *
 * @param rawAmount - the amount the user wants to swap/send
 * @param chain - blockchain key (e.g., "ethereum", "bitcoin", "solana", "tron", "xrp")
 * @param apiKey - optional Infura/RPC API key for real-time gas fetching
 * @param adminFeePercentage - optional percentage for admin fee (0.01 = 1%)
 */
export async function calculateSwapFees(
  rawAmount: number,
  chain: string,
  apiKey: string | null = null,
  adminFeePercentage?: number
) {
  // 1️⃣ Fetch the blockchain network fee (in USD)
  // Connects to the established gas-fee-service.ts
  const blockchainFee = await getGasFee(chain, apiKey);
  const networkFeeUSD = blockchainFee.estimatedFeeUSD;

  // 2️⃣ Calculate admin fee as percentage (default 0.05% for small amounts)
  // This logic scales naturally with the transaction size
  const percentage = adminFeePercentage ?? 0.0005; // 0.05%
  let adminFee = rawAmount * percentage;

  // For very small amounts, set a minimum admin fee (e.g., $0.01)
  // This ensures micro-swaps remain viable while covering registry costs
  if (adminFee < 0.01) {
    adminFee = 0.01;
  }

  // 3️⃣ Combine network fee + admin fee into a unified node
  const totalNetworkFee = adminFee + networkFeeUSD;

  // 4️⃣ Calculate final amount user will receive
  // Formula: finalAmount = principal - (gas + platform_fee)
  const finalReceiveAmount = Math.max(0, rawAmount - totalNetworkFee);

  // 5️⃣ Return structured result node for consumption by the Swap/Send UI
  return {
    rawAmount,
    adminFee,
    blockchainFee: networkFeeUSD,
    networkFee: totalNetworkFee,
    finalReceiveAmount,
  };
}

/**
 * Example usage in Swap Page:
 * 
 * const { finalReceiveAmount, networkFee } = await calculateSwapFees(1.0, "ethereum");
 * setEstimatedOutput(finalReceiveAmount);
 */
