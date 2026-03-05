/**
 * INSTITUTIONAL SWAP FEE CALCULATOR
 * Version: 1.0.0
 * 
 * This module is responsible for the pure mathematical handshake of a swap quote.
 * it calculates platform revenue (Admin Fee) and combines it with real-time 
 * blockchain gas costs to determine the final settlement amount.
 */

export interface SwapFeeResult {
  rawAmount: number;
  networkFee: number;   // Combined blockchain + admin fee
  adminFee: number;
  blockchainFee: number;
  finalReceiveAmount: number;
}

/**
 * Calculates institutional fees and final receive amounts for multi-chain swaps.
 * 
 * @param rawOutputAmountUSD - The estimated output from the liquidity provider (e.g. Uniswap/1inch) in USD.
 * @param blockchainFeeUSD - The real-time network cost in USD fetched from the Gas Fee Service.
 * @param chainType - The target blockchain protocol (BTC, EVM, Solana, XRP, etc).
 * @returns SwapFeeResult
 */
export function calculateSwapFees(
  rawOutputAmountUSD: number,
  blockchainFeeUSD: number,
  chainType: string = 'evm'
): SwapFeeResult {
  // 1. Institutional Admin Fee Logic
  // We use a dynamic percentage model:
  // - Small swaps (< $100): 1% fee with a $0.05 minimum floor.
  // - Large swaps (>= $100): 0.5% fee to scale with institutional volume.
  // - Cross-chain (BTC/XRP): Flat 1% to cover bridging liquidity.
  
  let feePercentage = 0.01; // Default 1%
  let minFee = 0.05;        // Default $0.05 floor

  if (chainType === 'evm' || chainType === 'solana') {
    if (rawOutputAmountUSD >= 100) {
      feePercentage = 0.005; // Scale down to 0.5% for high-volume EVM trades
    }
  } else if (chainType === 'btc' || chainType === 'ltc') {
    feePercentage = 0.015;   // 1.5% for UTXO-based swaps due to higher complexity
    minFee = 0.50;           // $0.50 floor for BTC
  }

  // Calculate Admin Fee with floor protection
  const adminFee = Math.max(minFee, rawOutputAmountUSD * feePercentage);

  // 2. Aggregate Fees
  // "Network Fee" in this terminal represents the total overhead (Gas + Platform)
  const totalCombinedFee = adminFee + blockchainFeeUSD;

  // 3. Final Settlement Calculation
  // We subtract the total overhead from the raw output to find the final receive amount.
  // Safety check: ensure we never return a negative amount for micro-swaps.
  const finalAmount = Math.max(0, rawOutputAmountUSD - totalCombinedFee);

  return {
    rawAmount: rawOutputAmountUSD,
    networkFee: totalCombinedFee,
    adminFee: adminFee,
    blockchainFee: blockchainFeeUSD,
    finalReceiveAmount: finalAmount
  };
}
