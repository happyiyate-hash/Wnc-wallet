'use client';

import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import * as bip39 from 'bip39';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { KeyPair, utils } from "near-api-js";
import * as bitcoin from "bitcoinjs-lib";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import { derivePath } from "ed25519-hd-key";
import { Keypair as SolanaKeypair } from "@solana/web3.js";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { stringToPath } from "@cosmjs/crypto";
import { TronWeb } from "tronweb";
import * as algosdk from "algosdk";
import { Mnemonic as HederaMnemonic } from "@hashgraph/sdk";
import { InMemorySigner } from "@taquito/signer";
import { b58cencode, prefix } from "@taquito/utils";
import { AptosAccount } from "aptos";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { WalletWithMetadata, UserProfile } from '@/lib/types';
import { litecoinNetwork } from '@/lib/wallets/adapters/litecoin';
import { dogecoinNetwork } from '@/lib/wallets/adapters/dogecoin';

/**
 * INSTITUTIONAL MULTI-CHAIN DERIVATION ENGINE
 * Decoupled from UI to ensure stability, performance, and security.
 * Initializations are moved inside the function to prevent SSR/Build-time crashes.
 */
export async function deriveAllWallets(mnemonic: string, profile?: UserProfile | null): Promise<WalletWithMetadata[]> {
  if (!mnemonic || mnemonic.split(' ').length < 12) return [];
  
  // Safe initialization for BIP32 which requires secp256k1
  const bip32 = BIP32Factory(ecc);

  try {
    // 1. Pre-Handshake Validation
    if (!bip39.validateMnemonic(mnemonic)) throw new Error("Invalid BIP39 Mnemonic");
    
    // 2. Multi-Protocol Derivation
    const evmWallet = ethers.Wallet.fromPhrase(mnemonic);
    const xrpWallet = xrpl.Wallet.fromMnemonic(mnemonic);
    
    await cryptoWaitReady();
    const keyring = new Keyring({ type: 'sr25519' });
    const dotWallet = keyring.addFromMnemonic(mnemonic);
    const ksmKeyring = new Keyring({ type: 'sr25519', ss58Format: 2 });
    const ksmWallet = ksmKeyring.addFromMnemonic(mnemonic);

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const nearSecretKey = seed.slice(0, 32);
    const nearBase58Secret = utils.serialize.base_encode(nearSecretKey);
    const nearKeyPair = KeyPair.fromString(`ed25519:${nearBase58Secret}`);
    const nearAddress = Buffer.from(nearKeyPair.getPublicKey().data).toString('hex');

    const btcRoot = bip32.fromSeed(seed);
    const btcChild = btcRoot.derivePath("m/84'/0'/0'/0/0");
    const { address: btcAddress } = bitcoin.payments.p2wpkh({ pubkey: btcChild.publicKey, network: bitcoin.networks.bitcoin });

    const ltcRoot = bip32.fromSeed(seed, litecoinNetwork);
    const ltcChild = ltcRoot.derivePath("m/84'/2'/0'/0/0");
    const { address: ltcAddress } = bitcoin.payments.p2wpkh({ pubkey: ltcChild.publicKey, network: litecoinNetwork });

    const dogeRoot = bip32.fromSeed(seed, dogecoinNetwork);
    const dogeChild = dogeRoot.derivePath("m/44'/3'/0'/0/0");
    const { address: dogeAddress } = bitcoin.payments.p2pkh({ pubkey: dogeChild.publicKey, network: dogecoinNetwork });

    const solRoot = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
    const solKeypair = SolanaKeypair.fromSeed(solRoot.key);

    const cosmosWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "cosmos", hdPaths: [stringToPath("m/44'/118'/0'/0/0")] });
    const [cosmosAccount] = await cosmosWallet.getAccounts();

    const osmosisWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "osmo", hdPaths: [stringToPath("m/44'/118'/0'/0/0")] });
    const [osmosisAccount] = await osmosisWallet.getAccounts();

    const secretWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "secret", hdPaths: [stringToPath("m/44'/529'/0'/0/0")] });
    const [secretAccount] = await secretWallet.getAccounts();

    const injectiveWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "inj", hdPaths: [stringToPath("m/44'/60'/0'/0/0")] });
    const [injectiveAccount] = await injectiveWallet.getAccounts();

    const celestiaWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "celestia", hdPaths: [stringToPath("m/44'/118'/0'/0/0")] });
    const [celestiaAccount] = await celestiaWallet.getAccounts();

    const adaRoot = btcRoot.derivePath("m/1852'/1815'/0'/0/0");
    const adaAddress = `addr1${Buffer.from(adaRoot.publicKey).toString('hex').slice(0, 50)}`; 

    const tronRoot = btcRoot.derivePath("m/44'/195'/0'/0/0");
    const tronPrivateKey = tronRoot.privateKey!.toString('hex');
    const tronAddress = TronWeb.address.fromPrivateKey(tronPrivateKey);

    const algoRoot = btcRoot.derivePath("m/44'/283'/0'/0/0");
    const algoAddress = algosdk.encodeAddress(algoRoot.privateKey!);

    const hbarMnemonic = await HederaMnemonic.fromString(mnemonic);
    const hbarPrivateKey = await hbarMnemonic.toStandardEd25519PrivateKey();
    
    const xtzDerivationPath = "m/44'/1729'/0'/0'";
    const xtzSeed = derivePath(xtzDerivationPath, seed.toString('hex'));
    const xtzSecretKey = b58cencode(xtzSeed.key, prefix.edsk2); 
    const xtzSigner = await InMemorySigner.fromSecretKey(xtzSecretKey);
    const xtzAddress = await xtzSigner.publicKeyHash();

    const aptosSeed = derivePath("m/44'/637'/0'/0'/0'", seed.toString('hex'));
    const aptosAccount = new AptosAccount(aptosSeed.key);

    const suiKeypair = Ed25519Keypair.deriveKeypair(mnemonic);
    const suiAddress = suiKeypair.getPublicKey().toSuiAddress();

    return [
      { address: evmWallet.address, privateKey: evmWallet.privateKey, type: 'evm' },
      { address: xrpWallet.address, seed: xrpWallet.seed, type: 'xrp' },
      { address: dotWallet.address, type: 'polkadot' },
      { address: ksmWallet.address, type: 'kusama' },
      { address: nearAddress, type: 'near' },
      { address: btcAddress!, type: 'btc' },
      { address: ltcAddress!, privateKey: ltcChild.toWIF(), type: 'ltc' },
      { address: dogeAddress!, privateKey: dogeChild.toWIF(), type: 'doge' },
      { address: solKeypair.publicKey.toBase58(), privateKey: Buffer.from(solKeypair.secretKey).toString('hex'), type: 'solana' },
      { address: cosmosAccount.address, type: 'cosmos' },
      { address: osmosisAccount.address, type: 'osmosis' },
      { address: secretAccount.address, type: 'secret' },
      { address: injectiveAccount.address, type: 'injective' },
      { address: celestiaAccount.address, type: 'celestia' },
      { address: adaAddress, type: 'cardano' },
      { address: tronAddress, privateKey: tronPrivateKey, type: 'tron' },
      { address: algoAddress, privateKey: algoRoot.privateKey!.toString('hex'), type: 'algorand' },
      { address: profile?.hedera_address || '0.0.0', privateKey: hbarPrivateKey.toString(), type: 'hedera' },
      { address: xtzAddress, type: 'tezos' },
      { address: aptosAccount.address().toString(), privateKey: Buffer.from(aptosAccount.signingKey.secretKey).toString('hex'), type: 'aptos' },
      { address: suiAddress, type: 'sui' }
    ];
  } catch (error: any) {
    console.error("[DERIVATION_ENGINE_FAIL]:", error.message);
    return [];
  }
}
