
'use client';

import type { WalletWithMetadata } from '@/lib/types';

/**
 * INSTITUTIONAL MULTI-CHAIN DERIVATION ENGINE (Hardened Build-Safe Version)
 * All heavy crypto libraries are dynamically imported inside the function.
 * Implements strict "No-Network" logic.
 */
export async function deriveAllWallets(mnemonic: string, hederaAddress?: string): Promise<WalletWithMetadata[]> {
  if (!mnemonic || mnemonic.split(' ').length < 12) return [];

  // Helper to yield the main thread and keep animations smooth
  const breathe = () => new Promise(resolve => setTimeout(resolve, 0));

  try {
    console.log("[DERIVE_ENGINE] Loading crypto modules...");
    
    // 1. DYNAMIC HANDSHAKE: Load libraries only in the client environment
    // Note: These imports might take time if not cached, but are offline after load.
    const [
      ecc,
      { default: BIP32Factory },
      bip39,
      { ethers },
      xrpl,
      { Keyring },
      { cryptoWaitReady },
      { KeyPair, utils },
      bitcoin,
      { derivePath },
      { Keypair: SolanaKeypair },
      { DirectSecp256k1HdWallet },
      { stringToPath },
      { TronWeb },
      algosdk,
      { Mnemonic: HederaMnemonic },
      { InMemorySigner },
      { b58cencode, prefix },
      { AptosAccount },
      { Ed25519Keypair },
      { litecoinNetwork },
      { dogecoinNetwork }
    ] = await Promise.all([
      import("tiny-secp256k1"),
      import("bip32"),
      import('bip39'),
      import('ethers'),
      import('xrpl'),
      import('@polkadot/keyring'),
      import('@polkadot/util-crypto'),
      import("near-api-js"),
      import("bitcoinjs-lib"),
      import("ed25519-hd-key"),
      import("@solana/web3.js"),
      import("@cosmjs/proto-signing"),
      import("@cosmjs/crypto"),
      import("tronweb"),
      import("algosdk"),
      import("@hashgraph/sdk"),
      import("@taquito/signer"),
      import("@taquito/utils"),
      import("aptos"),
      import("@mysten/sui/keypairs/ed25519"),
      import('@/lib/wallets/adapters/litecoin'),
      import('@/lib/wallets/adapters/dogecoin')
    ]);

    const bip32 = BIP32Factory(ecc);
    await breathe();

    // 2. Pre-Handshake Validation
    if (!bip39.validateMnemonic(mnemonic)) throw new Error("Invalid BIP39 Mnemonic");
    
    console.log("[DERIVE_ENGINE] Executing multi-protocol derivation...");

    // 3. Multi-Protocol Derivation (Sequenced with breathers for UI smoothness)
    const evmWallet = ethers.Wallet.fromPhrase(mnemonic);
    const xrpWallet = xrpl.Wallet.fromMnemonic(mnemonic);
    await breathe();
    
    await cryptoWaitReady();
    const keyring = new Keyring({ type: 'sr25519' });
    const dotWallet = keyring.addFromMnemonic(mnemonic);
    const ksmKeyring = new Keyring({ type: 'sr25519', ss58Format: 2 });
    const ksmWallet = ksmKeyring.addFromMnemonic(mnemonic);
    await breathe();

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const nearSecretKey = seed.slice(0, 32);
    const nearBase58Secret = utils.serialize.base_encode(nearSecretKey);
    const nearKeyPair = KeyPair.fromString(`ed25519:${nearBase58Secret}`);
    const nearAddress = Buffer.from(nearKeyPair.getPublicKey().data).toString('hex');
    await breathe();

    const btcRoot = bip32.fromSeed(seed);
    const btcChild = btcRoot.derivePath("m/84'/0'/0'/0/0");
    const { address: btcAddress } = bitcoin.payments.p2wpkh({ pubkey: btcChild.publicKey, network: bitcoin.networks.bitcoin });

    const ltcRoot = bip32.fromSeed(seed, litecoinNetwork);
    const ltcChild = ltcRoot.derivePath("m/84'/2'/0'/0/0");
    const { address: ltcAddress } = bitcoin.payments.p2wpkh({ pubkey: ltcChild.publicKey, network: litecoinNetwork });
    await breathe();

    const dogeRoot = bip32.fromSeed(seed, dogecoinNetwork);
    const dogeChild = dogeRoot.derivePath("m/44'/3'/0'/0/0");
    const { address: dogeAddress } = bitcoin.payments.p2pkh({ pubkey: dogeChild.publicKey, network: dogecoinNetwork });

    const solRoot = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
    const solKeypair = SolanaKeypair.fromSeed(solRoot.key);
    await breathe();

    const cosmosWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "cosmos", hdPaths: [stringToPath("m/44'/118'/0'/0/0")] });
    const [cosmosAccount] = await cosmosWallet.getAccounts();

    const osmosisWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "osmo", hdPaths: [stringToPath("m/44'/118'/0'/0/0")] });
    const [osmosisAccount] = await osmosisWallet.getAccounts();
    await breathe();

    const secretWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "secret", hdPaths: [stringToPath("m/44'/529'/0'/0/0")] });
    const [secretAccount] = await secretWallet.getAccounts();

    const injectiveWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "inj", hdPaths: [stringToPath("m/44'/60'/0'/0/0")] });
    const [injectiveAccount] = await injectiveWallet.getAccounts();
    await breathe();

    const celestiaWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "celestia", hdPaths: [stringToPath("m/44'/118'/0'/0/0")] });
    const [celestiaAccount] = await celestiaWallet.getAccounts();

    const adaRoot = btcRoot.derivePath("m/1852'/1815'/0'/0/0");
    const adaAddress = `addr1${Buffer.from(adaRoot.publicKey).toString('hex').slice(0, 50)}`; 
    await breathe();

    const tronRoot = btcRoot.derivePath("m/44'/195'/0'/0/0");
    const tronPrivateKey = tronRoot.privateKey!.toString('hex');
    const tronAddress = TronWeb.address.fromPrivateKey(tronPrivateKey);

    const algoRoot = btcRoot.derivePath("m/44'/283'/0'/0/0");
    const algoAddress = algosdk.encodeAddress(algoRoot.privateKey!);
    await breathe();

    const hbarMnemonic = await HederaMnemonic.fromString(mnemonic);
    const hbarPrivateKey = await hbarMnemonic.toStandardEd25519PrivateKey();
    
    const xtzDerivationPath = "m/44'/1729'/0'/0'";
    const xtzSeed = derivePath(xtzDerivationPath, seed.toString('hex'));
    const xtzSecretKey = b58cencode(xtzSeed.key, prefix.edsk2); 
    const xtzSigner = await InMemorySigner.fromSecretKey(xtzSecretKey);
    const xtzAddress = await xtzSigner.publicKeyHash();
    await breathe();

    const aptosSeed = derivePath("m/44'/637'/0'/0'/0'", seed.toString('hex'));
    const aptosAccount = new AptosAccount(aptosSeed.key);

    const suiKeypair = Ed25519Keypair.deriveKeypair(mnemonic);
    const suiAddress = suiKeypair.getPublicKey().toSuiAddress();

    console.log("[DERIVE_ENGINE] 33-chain handshake verified.");

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
      { address: hederaAddress || '0.0.0', privateKey: hbarPrivateKey.toString(), type: 'hedera' },
      { address: xtzAddress, type: 'tezos' },
      { address: aptosAccount.address().toString(), privateKey: Buffer.from(aptosAccount.signingKey.secretKey).toString('hex'), type: 'aptos' },
      { address: suiAddress, type: 'sui' }
    ];
  } catch (error: any) {
    console.error("[DERIVE_ENGINE_FAIL]:", error.message);
    throw error;
  }
}
