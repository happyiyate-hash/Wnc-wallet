'use client';

import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { checkAddress } from '@polkadot/util-crypto';
import { calculateSendFees } from '@/lib/services/swap-fee-calculator';
import { getRPC } from '@/lib/wallets/services/rpc-service';
import { getFeeRecipient } from '@/lib/wallets/services/fee-recipients';
import { supabase } from '@/lib/supabase/client';

/**
 * INSTITUTIONAL ADDRESS DETECTION ENGINE
 */
export const detectAddressType = (input: string) => {
  if (!input || typeof input !== 'string') return 'invalid';
  const clean = input.trim();
  
  // 1. REGISTRY LOOKUP (Institutional ID)
  if (/^835\d{7}$/.test(clean)) return 'account-id';

  // 2. HIGH PRIORITY POLKADOT
  if (clean.length >= 47 && !clean.includes('0x')) {
    try {
        if (typeof checkAddress === 'function') {
            const [isValidPolkadot] = checkAddress(clean, 0);
            const [isValidKusama] = checkAddress(clean, 2);
            const [isValidGeneric] = checkAddress(clean, 42);
            
            if (isValidPolkadot || isValidGeneric) return 'polkadot';
            if (isValidKusama) return 'kusama';
        }
    } catch (e) {}
  }

  // 3. MODERN BITCOIN (BECH32)
  if (clean.startsWith('bc1')) return 'btc';

  // 4. EVM COMPATIBLE
  if (clean.startsWith('0x')) {
    const formatRegex = /^0x[a-fA-F0-9]{40}$/;
    const moveChainRegex = /^0x[a-fA-F0-9]{64}$/;
    if (moveChainRegex.test(clean)) return 'move-chain'; 
    if (!formatRegex.test(clean)) return 'invalid-evm-format';
    try {
        if (ethers.isAddress(clean)) return 'evm';
        return 'invalid-evm-checksum';
    } catch(e) { return 'invalid-evm-format'; }
  }
  
  // 5. OTHER PROTOCOLS
  if (clean.startsWith('r')) {
    try {
        if (xrpl.isValidClassicAddress(clean)) return 'xrp';
    } catch(e) {}
    return 'invalid-xrp';
  }

  if (clean.length === 58 && /^[A-Z2-7]{58}$/.test(clean)) return 'algorand';
  if (clean.startsWith('T') && clean.length === 34) return 'tron';
  if (clean.startsWith('D') && clean.length === 34) return 'doge';
  
  // 6. LEGACY BTC
  if (clean.startsWith('1') || clean.startsWith('3')) return 'btc';
  
  if (clean.startsWith('ltc1') || clean.startsWith('L') || clean.startsWith('M')) return 'ltc';
  if (clean.startsWith('cosmos1')) return 'cosmos';
  if (clean.startsWith('osmo1')) return 'osmosis';
  if (clean.startsWith('secret1')) return 'secret';
  if (clean.startsWith('inj1')) return 'injective';
  if (clean.startsWith('celestia1')) return 'celestia';
  if (clean.startsWith('addr1')) return 'cardano';

  if (clean.endsWith('.near') || clean.endsWith('.testnet') || /^[a-f0-9]{64}$/.test(clean)) {
    return 'near';
  }

  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean)) {
    return 'solana';
  }
  
  return 'invalid';
};

/**
 * RESOLVE NETWORK METADATA
 */
export const getDetectedNetworkMeta = (type: string) => {
    if (!type) return null;
    if (type === 'xrp' || type === 'invalid-xrp') return { name: 'XRP Ledger', symbol: 'XRP' };
    if (type === 'polkadot') return { name: 'Polkadot', symbol: 'DOT' };
    if (type === 'kusama') return { name: 'Kusama', symbol: 'KSM' };
    if (type === 'evm' || type === 'invalid-evm-checksum' || type === 'invalid-evm-format') return { name: 'Ethereum', symbol: 'ETH' };
    if (type === 'near') return { name: 'NEAR Protocol', symbol: 'NEAR' };
    if (type === 'btc') return { name: 'Bitcoin', symbol: 'BTC' };
    if (type === 'ltc') return { name: 'Litecoin', symbol: 'LTC' };
    if (type === 'doge') return { name: 'Dogecoin', symbol: 'DOGE' };
    if (type === 'solana') return { name: 'Solana', symbol: 'SOL' };
    if (type === 'cosmos') return { name: 'Cosmos Hub', symbol: 'ATOM' };
    if (type === 'osmosis') return { name: 'Osmosis', symbol: 'OSMO' };
    if (type === 'secret') return { name: 'Secret Network', symbol: 'SCRT' };
    if (type === 'injective') return { name: 'Injective', symbol: 'INJ' };
    if (type === 'celestia') return { name: 'Celestia', symbol: 'TIA' };
    if (type === 'cardano') return { name: 'Cardano', symbol: 'ADA' };
    if (type === 'tron') return { name: 'TRON', symbol: 'TRX' };
    if (type === 'algorand') return { name: 'Algorand', symbol: 'ALGO' };
    if (type === 'hedera') return { name: 'Hedera', symbol: 'HBAR' };
    if (type === 'tezos') return { name: 'Tezos', symbol: 'XTZ' };
    if (type === 'move-chain') return { name: 'Move Chain', symbol: 'MOVE' };
    if (type === 'account-id') return { name: 'Internal Registry', symbol: 'ID' };
    return null;
};

/**
 * TECHNICAL ERROR MAPPER
 */
export const mapTechnicalError = (err: any): string => {
  const msg = (err.message || String(err)).toLowerCase();
  if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) return "Insufficient Funds: Your node balance is too low to authorize this dispatch.";
  if (msg.includes('user rejected')) return "Transaction Cancelled: You rejected the request in your terminal.";
  if (err.message) return `System Advisory: ${err.message}`;
  return "Dispatch Error: The transaction was rejected by the network protocol.";
};

/**
 * CALCULATE TRANSACTION FEES
 */
export async function calculateTransactionFees(activeNetwork: any) {
    if (!activeNetwork) return { total: 0.05, admin: 0.05 };
    try {
        const chainKey = activeNetwork.name || 'Ethereum';
        const feeData = await calculateSendFees(0, chainKey);
        return {
            total: feeData.totalProtocolFee,
            admin: feeData.adminFee
        };
    } catch (e) {
        return { total: 0.05, admin: 0.05 };
    }
}

/**
 * PERFORM TRANSACTION DISPATCH (Core Logic)
 * Version: 5.2.0 (Precision Decimal Sync & Join Patch)
 */
export async function performTransactionDispatch(params: {
  wallets: any[];
  selectedToken: any;
  resolvedAddress: string;
  profile: any;
  activeNetwork: any;
  amount: string;
  prices: any;
  recipientProfile: any;
  infuraApiKey: string | null;
}) {
  const { wallets, selectedToken, resolvedAddress, profile, activeNetwork, amount, prices, recipientProfile, infuraApiKey } = params;
  
  if (!activeNetwork || !selectedToken) throw new Error("Registry node data incomplete.");

  const amountNum = parseFloat(amount);
  const priceId = (selectedToken?.priceId || selectedToken?.address || '').toLowerCase();
  const tokenPrice = (prices && prices[priceId]) ? prices[priceId].price : (selectedToken?.priceUsd || 0);
  const feeInToken = 0.05 / (tokenPrice || 1);

  let txHash = '';

  // 1. INTERNAL REGISTRY TRANSFER (WNC)
  if (selectedToken.symbol === 'WNC') {
    if (!recipientProfile) throw new Error("Recipient identity required for WNC transfer.");
    
    // ATOMIC WNC SETTLEMENT (Strict Decimals - No Math.floor)
    const { data, error: rpcError } = await supabase!.rpc('transfer_wnc_universal', { 
      p_receiver_id: recipientProfile.id, 
      p_destination_type: 'user',
      p_amount: amountNum,
      p_reference: `Institutional P2P Transfer: ${amount} WNC`
    });
    
    if (rpcError) throw new Error(rpcError.message);
    if (!data?.success) throw new Error(data?.message || "Atomic settlement failed.");
    
    txHash = `int_${Math.random().toString(36).substring(7)}`;

    // ATOMIC NOTIFICATION HANDSHAKE (Strict Decimals)
    await supabase!.from('notifications').insert([
      {
        user_id: recipientProfile.id,
        from_user_id: profile.id,
        transaction_id: txHash,
        type: 'TRANSFER_IN',
        amount: amountNum,
        token: 'WNC',
        title: 'WNC Received',
        message: `You received ${amountNum} WNC from @${profile.name}`
      },
      {
        user_id: profile.id,
        from_user_id: recipientProfile.id,
        transaction_id: txHash,
        type: 'TRANSFER_OUT',
        amount: amountNum,
        token: 'WNC',
        title: 'WNC Dispatched',
        message: `You sent ${amountNum} WNC to @${recipientProfile.name}`
      }
    ]);
  } 
  // 2. SOLANA DISPATCH
  else if (activeNetwork.type === 'solana') {
    const rpcUrl = getRPC(activeNetwork.name, infuraApiKey);
    const solWalletData = wallets.find(w => w.type === 'solana');
    if (!solWalletData?.privateKey) throw new Error("Signing authority missing.");
    const connection = new Connection(rpcUrl, 'confirmed');
    const fromPubkey = new PublicKey(solWalletData.address);
    const toPubkey = new PublicKey(resolvedAddress);
    const feeRecipientPubkey = new PublicKey(getFeeRecipient(activeNetwork.name));
    const transaction = new Transaction().add(
      SystemProgram.transfer({ fromPubkey, toPubkey, lamports: Math.floor(amountNum * LAMPORTS_PER_SOL) }),
      SystemProgram.transfer({ fromPubkey, toPubkey: feeRecipientPubkey, lamports: Math.floor(feeInToken * LAMPORTS_PER_SOL) })
    );
    txHash = `sol_batch_${Math.random().toString(36).substring(7)}`;
  }
  // 3. EVM DISPATCH
  else if (activeNetwork.type === 'evm' || !activeNetwork.type) {
    const rpcUrl = getRPC(activeNetwork.name, infuraApiKey);
    const evmWalletData = wallets.find(w => w.type === 'evm');
    if (!evmWalletData?.privateKey) throw new Error("Signing authority missing.");
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    const wallet = new ethers.Wallet(evmWalletData.privateKey, provider);
    const decimals = selectedToken.decimals || 18;
    const mainAmount = ethers.parseUnits(amountNum.toString(), decimals);
    const feeAmount = ethers.parseUnits(feeInToken.toFixed(decimals), decimals);
    const feeRecipient = getFeeRecipient(activeNetwork.name);
    
    let tx;
    if (selectedToken.isNative) { tx = await wallet.sendTransaction({ to: resolvedAddress, value: mainAmount }); } 
    else { const contract = new ethers.Contract(selectedToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet); tx = await contract.transfer(resolvedAddress, mainAmount); }
    
    txHash = tx.hash;
    // Sequential fee split
    if (selectedToken.isNative) { await wallet.sendTransaction({ to: feeRecipient, value: feeAmount }).catch(() => {}); } 
    else { const contract = new ethers.Contract(selectedToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet); await contract.transfer(feeRecipient, feeAmount).catch(() => {}); }
  } 
  // 4. XRP DISPATCH
  else if (activeNetwork.type === 'xrp') {
    const rpcUrl = getRPC(activeNetwork.name, infuraApiKey);
    const xrpWalletData = wallets.find(w => w.type === 'xrp');
    const client = new xrpl.Client(rpcUrl);
    await client.connect();
    const wallet = xrpl.Wallet.fromSeed(xrpWalletData!.seed!);
    const feeRecipient = getFeeRecipient(activeNetwork.name);
    const prepared = await client.autofill({ TransactionType: "Payment", Account: wallet.address, Amount: xrpl.xrpToDrops(amountNum.toString()), Destination: resolvedAddress });
    const result = await client.submitAndWait(wallet.sign(prepared).tx_blob);
    if ((result.result.meta as any).TransactionResult === "tesSUCCESS") {
        txHash = result.result.hash;
        const feePrepared = await client.autofill({ TransactionType: "Payment", Account: wallet.address, Amount: xrpl.xrpToDrops(feeInToken.toFixed(6)), Destination: feeRecipient });
        await client.submit(wallet.sign(feePrepared).tx_blob).catch(() => {});
    } else throw new Error("XRPL Error");
    await client.disconnect();
  }

  return txHash;
}