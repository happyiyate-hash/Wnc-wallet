
import { Connection, VersionedTransaction, Keypair } from '@solana/web3.js';

/**
 * SOLANA JUPITER SWAP SERVICE
 * Version: 1.0.0
 * Handles quote fetching, transaction building, and signing for Solana assets.
 */

export async function getSolanaSwapQuote(inputMint: string, outputMint: string, amount: string, slippageBps: number = 50) {
  const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
  const response = await fetch(url);
  const quote = await response.json();
  if (quote.error) {
    throw new Error(quote.error);
  }
  return quote;
}

export async function buildSolanaSwapTransaction(quoteResponse: any, userPublicKey: string) {
  const response = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
    }),
  });
  const { swapTransaction } = await response.json();
  if (!swapTransaction) {
    throw new Error("Failed to build Solana swap transaction");
  }
  return swapTransaction;
}

export async function executeSolanaSwap(swapTransaction: string, privateKeyHex: string, rpcUrl: string) {
  const connection = new Connection(rpcUrl, 'confirmed');
  
  // Deserialize the transaction
  const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  
  // Create signer from private key
  const signer = Keypair.fromSecretKey(new Uint8Array(Buffer.from(privateKeyHex, 'hex')));
  
  // Sign and broadcast
  transaction.sign([signer]);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 2,
  });
  
  // Wait for confirmation
  await connection.confirmTransaction(signature);
  
  return signature;
}
