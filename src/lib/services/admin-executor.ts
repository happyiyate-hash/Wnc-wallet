
'use client';

import { ethers } from 'ethers';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as xrpl from 'xrpl';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

/**
 * INSTITUTIONAL ADMIN EXECUTION ENGINE
 * Version: 2.0.0 (Master Phrase Protocol)
 * 
 * Orchestrates multi-chain signing using the provided master mnemonic.
 * Strictly derives keys for EVM, Solana, and XRP settlements.
 */

// MASTER FALLBACK: Institutional phrase provided for admin liquidity
const DEFAULT_PHRASE = "ship purity expose enact sugar present merit weather case wet match welcome";

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
   * Resolves the master mnemonic from the registry or fallback.
   */
  getMnemonic(): string {
    return process.env.ADMIN_SECRET_PHRASE || DEFAULT_PHRASE;
  },

  /**
   * Executes an EVM-based transfer from the derived admin pool.
   */
  async sendEVMTransaction(input: AdminTransferInput): Promise<string> {
    const rpcUrl = process.env[`NEXT_PUBLIC_RPC_${input.chainId}`] || 'https://mainnet.infura.io/v3/placeholder';
    const mnemonic = this.getMnemonic();

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = ethers.Wallet.fromPhrase(mnemonic).connect(provider);
    
    const decimals = 18; 

    if (!input.tokenAddress || input.tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || input.tokenAddress === input.tokenSymbol) {
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
   * Executes a Solana-based transfer using Ed25519 derivation.
   */
  async sendSolanaTransaction(input: AdminTransferInput): Promise<string> {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
    const mnemonic = this.getMnemonic();

    const connection = new Connection(rpcUrl, 'confirmed');
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
    const fromKeypair = Keypair.fromSeed(derivedSeed);
    
    const toPublicKey = new PublicKey(input.toAddress);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: Math.floor(input.amount * 1_000_000_000), // SOL to lamports
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
    return signature;
  },

  /**
   * Executes an XRP Ledger transfer using the derived family seed.
   */
  async sendXrpTransaction(input: AdminTransferInput): Promise<string> {
    const rpcUrl = process.env.NEXT_PUBLIC_XRP_RPC || 'wss://xrplcluster.com';
    const mnemonic = this.getMnemonic();

    const client = new xrpl.Client(rpcUrl);
    await client.connect();

    const wallet = xrpl.Wallet.fromMnemonic(mnemonic);
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
      throw new Error(`XRP_BROADCAST_FAILED: ${(result.result.meta as any).TransactionResult}`);
    }
  },

  /**
   * Universal Dispatcher for Admin Liquidity.
   */
  async executeAdminTransfer(input: AdminTransferInput): Promise<string> {
    console.log(`[ADMIN_EXECUTOR] Dispatching via Master Node: ${input.amount} ${input.tokenSymbol} to ${input.toAddress} on ${input.chainType}`);
    
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
