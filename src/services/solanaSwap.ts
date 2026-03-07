
'use client';

import { Connection, VersionedTransaction, Keypair } from '@solana/web3.js';
import axios from 'axios';

/**
 * WARNING: Do NOT modify UI in this file.
 * INSTITUTIONAL SOLANA JUPITER SWAP SERVICE
 * Version: 2.0.0 (Robust Handshake & Caching)
 * 
 * Handles quote fetching, transaction building, and signing for Solana assets.
 * Implements retries, timeouts, and in-memory caching for zero-latency performance.
 */

const JUP_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUP_SWAP_API = 'https://quote-api.jup.ag/v6/swap';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;
const QUOTE_CACHE_TTL = 10000; // 10 seconds

// Simple in-memory cache node
const quoteCache: Record<string, { data: any; timestamp: number }> = {};

export interface JupiterResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Standard retry logic for institutional network resilience.
 */
async function fetchWithRetry(url: string, params: any, retries = MAX_RETRIES): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { 
        params, 
        timeout: 8000 // 8s institutional timeout
      });
      if (res.data) return res.data;
    } catch (err: any) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

/**
 * Fetches a swap quote from Jupiter with caching and retries.
 */
export async function getSolanaSwapQuote(
  inputMint: string, 
  outputMint: string, 
  amount: string, 
  slippageBps: number = 50
): Promise<JupiterResponse<any>> {
  const cacheKey = `${inputMint}-${outputMint}-${amount}-${slippageBps}`;
  const now = Date.now();

  if (quoteCache[cacheKey] && (now - quoteCache[cacheKey].timestamp < QUOTE_CACHE_TTL)) {
    return { success: true, data: quoteCache[cacheKey].data };
  }

  try {
    const params = {
      inputMint,
      outputMint,
      amount,
      slippageBps,
      onlyDirectRoutes: false,
    };

    const quote = await fetchWithRetry(JUP_QUOTE_API, params);
    
    if (quote.error) throw new Error(quote.error);

    // Update cache node
    quoteCache[cacheKey] = { data: quote, timestamp: now };

    return { success: true, data: quote };
  } catch (error: any) {
    console.error("[JUPITER_QUOTE_FAIL]", error.message);
    return { success: false, error: error.message || "Failed to fetch routing quote." };
  }
}

/**
 * Builds the base64 swap transaction via Jupiter API.
 */
export async function buildSolanaSwapTransaction(quoteResponse: any, userPublicKey: string): Promise<JupiterResponse<string>> {
  try {
    const res = await axios.post(JUP_SWAP_API, {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto'
    }, { timeout: 10000 });

    const { swapTransaction } = res.data;
    if (!swapTransaction) throw new Error("Registry failed to build transaction node.");

    return { success: true, data: swapTransaction };
  } catch (error: any) {
    console.error("[JUPITER_BUILD_FAIL]", error.message);
    return { success: false, error: error.message || "Failed to authorize swap transaction." };
  }
}

/**
 * Deserializes, signs, and broadcasts the transaction to the Solana network.
 */
export async function executeSolanaSwap(swapTransaction: string, privateKeyHex: string, rpcUrl: string): Promise<string> {
  const connection = new Connection(rpcUrl, 'confirmed');
  
  try {
    // 1. Restore Transaction Node
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    // 2. Authorize via Private Key Node
    const signer = Keypair.fromSecretKey(new Uint8Array(Buffer.from(privateKeyHex, 'hex')));
    
    // 3. Sign & Broadcast Handshake
    transaction.sign([signer]);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });
    
    // 4. Verification Cycle
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: signature
    });
    
    return signature;
  } catch (error: any) {
    console.error("[SOLANA_EXECUTION_FAIL]", error.message);
    throw new Error(error.message || "Blockchain broadcast failed.");
  }
}
