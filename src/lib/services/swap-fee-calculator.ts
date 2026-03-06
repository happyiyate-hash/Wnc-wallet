
import { getGasFee } from "../wallets/services/fee-service";
import { getFeeRecipient } from "../wallets/services/fee-recipients";

/**
 * INSTITUTIONAL FEE & VALIDATION ENGINE
 * Version: 3.0.0 (Liquidity Protection Update)
 * 
 * Implements real-time gas discovery with a $0.10 volatility buffer
 * and an increased 0.30% (30 BPS) institutional system fee.
 */

const MIN_SWAP_USD_HIGH = 2.00; 
const MIN_SWAP_USD_LOW = 0.10;  
const GAS_BUFFER_USD = 0.10; // Institutional Volatility Protection

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
 * Standardized at a FIXED $0.05 USD per dispatch for maximum predictability.
 */
export async function calculateSendFees(amountUsd: number, chain: string) {
    const blockchainFee = await getGasFee(chain);
    const networkFeeUSD = blockchainFee.estimatedFeeUSD;
    const recipient = getFeeRecipient(chain);

    // FIXED FEE HANDSHAKE: $0.05 USD
    const adminFee = 0.05;

    return {
      amountUsd,
      adminFee,
      networkFee: networkFeeUSD,
      totalProtocolFee: adminFee + networkFeeUSD,
      feeRecipient: recipient
    };
}

/**
 * Calculate system and network fees for a swap.
 * Version 3.0: Includes delivery gas and 0.10 buffer.
 * Standardized at 0.30% (30 BPS).
 */
export async function calculateSwapFees(
  rawAmountUsd: number,
  fromChain: string,
  toChain?: string,
  adminFeePercentage?: number
) {
  // 1. Fetch Real-time Gas for Execution Leg (User -> Admin)
  const sourceGas = await getGasFee(fromChain);
  let totalGasUsd = sourceGas.estimatedFeeUSD;

  // 2. Fetch Real-time Gas for Delivery Leg (Admin -> User)
  if (toChain && toChain.toLowerCase() !== fromChain.toLowerCase()) {
    const targetGas = await getGasFee(toChain);
    totalGasUsd += targetGas.estimatedFeeUSD;
  } else {
    // If same chain, estimate delivery as equal to source execution
    totalGasUsd *= 2;
  }

  // 3. Add Institutional Volatility Buffer (0.10)
  totalGasUsd += GAS_BUFFER_USD;

  // 4. Calculate System Fee (0.30%)
  const percentage = adminFeePercentage ?? 0.003; 
  let adminFee = rawAmountUsd * percentage;

  // Swap Floor: $0.05
  if (adminFee < 0.05) {
    adminFee = 0.05;
  }

  const totalNetworkFee = adminFee + totalGasUsd;

  return {
    rawAmountUsd,
    adminFee,
    blockchainFee: totalGasUsd,
    networkFee: totalNetworkFee,
    feeRecipient: getFeeRecipient(fromChain)
  };
}
