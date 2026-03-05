
'use client';

import { ethers } from 'ethers';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as xrpl from 'xrpl';
import { TronWeb } from 'tronweb';
import { supabase } from '@/lib/supabase/client';

/**
 * INSTITUTIONAL ADMIN EXECUTION ENGINE
 * Version: 1.0.0
 * 
 * Handles the signing and broadcasting of transactions from the admin liquidity vault.
 * All sensitive keys are strictly consumed from environment variables.
 */

export interface AdminTransferInput {
  toAddress: string;
  amount: number;
  tokenSymbol: string;
  tokenAddress?: string;
  chainId: number;
  chainType: string;
}

export const adminExecutor = {
  /**
   * Executes an EVM-based transfer from the admin pool.
   */
  async sendEVMTransaction(input: AdminTransferInput): Promise<string> {
    const rpcUrl = process.env[`NEXT_PUBLIC_RPC_${input.chainId}`] || 'https://mainnet.infura.io/v3/placeholder';
    const privateKey = process.env.ADMIN_PRIVATE_KEY_EVM;

    if (!privateKey) throw new Error("ADMIN_EVM_KEY_MISSING");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const decimals = 18; // Default for ETH/standard tokens

    if (!input.tokenAddress || input.tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      // Native Transfer
      const tx = await wallet.sendTransaction({
        to: input.toAddress,
        value: ethers.parseEther(input.amount.toString())
      });
      return tx.hash;
    } else {
      // ERC-20 Transfer
      const abi = ["function transfer(address to, uint256 amount) returns (bool)"];
      const contract = new ethers.Contract(input.tokenAddress, abi, wallet);
      const tx = await contract.transfer(input.toAddress, ethers.parseUnits(input.amount.toString(), decimals));
      return tx.hash;
    }
  },

  /**
   * Executes a Solana-based transfer from the admin pool.
   */
  async sendSolanaTransaction(input: AdminTransferInput): Promise<string> {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
    const secretKeyString = process.env.ADMIN_SECRET_KEY_SOLANA;

    if (!secretKeyString) throw new Error("ADMIN_SOLANA_KEY_MISSING");

    const connection = new Connection(rpcUrl, 'confirmed');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const fromKeypair = Keypair.fromSecretKey(secretKey);
    const toPublicKey = new PublicKey(input.toAddress);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: input.amount * 1_000_000_000, // SOL to lamports
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
    return signature;
  },

  /**
   * Executes an XRP Ledger transfer from the admin pool.
   */
  async sendXrpTransaction(input: AdminTransferInput): Promise<string> {
    const rpcUrl = process.env.NEXT_PUBLIC_XRP_RPC || 'wss://xrplcluster.com';
    const seed = process.env.ADMIN_SEED_XRP;

    if (!seed) throw new Error("ADMIN_XRP_KEY_MISSING");

    const client = new xrpl.Client(rpcUrl);
    await client.connect();

    const wallet = xrpl.Wallet.fromSeed(seed);
    const prepared = await client.autofill({
      TransactionType: "Payment",
      Account: wallet.address,
      Amount: xrpl.xrpToDrops(input.amount.toString()),
      Destination: input.toAddress,
    });

    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    await client.disconnect();

    if (result.result.meta && (result.result.meta as any).TransactionResult === "tesSUCCESS") {
      return result.result.hash;
    } else {
      throw new Error("XRP_BROADCAST_FAILED");
    }
  },

  /**
   * Universal Dispatcher for Admin Liquidity.
   */
  async executeAdminTransfer(input: AdminTransferInput): Promise<string> {
    console.log(`[ADMIN_EXECUTOR] Dispatching ${input.amount} ${input.tokenSymbol} to ${input.toAddress} on ${input.chainType}`);
    
    switch (input.chainType.toLowerCase()) {
      case 'evm':
        return await this.sendEVMTransaction(input);
      case 'solana':
        return await this.sendSolanaTransaction(input);
      case 'xrp':
        return await this.sendXrpTransaction(input);
      default:
        throw new Error(`Unsupported chain type for admin payout: ${input.chainType}`);
    }
  }
};
