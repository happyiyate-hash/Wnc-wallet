
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import type { AssetRow, ChainConfig, WalletWithMetadata, IWalletAdapter, UserProfile, WalletRegistryEntry } from '@/lib/types';
import { useNetworkLogos } from '@/hooks/useNetworkLogos';
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
import { AptosAccount } from "aptos";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getInitialAssets } from '@/lib/wallets/balances';
import { useUser } from './user-provider';
import { useCurrency } from './currency-provider';
import { useToast } from '@/hooks/use-toast';
import { fetchPriceMap, fetchPricesByContract, COINGECKO_PLATFORM_MAP } from '@/lib/coingecko';
import { supabase } from '@/lib/supabase/client';
import { xrpAdapterFactory } from '@/lib/wallets/adapters/xrp';
import { polkadotAdapterFactory } from '@/lib/wallets/adapters/polkadot';
import { kusamaAdapterFactory } from '@/lib/wallets/adapters/kusama';
import { nearAdapterFactory } from '@/lib/wallets/adapters/near';
import { evmAdapterFactory } from '@/lib/wallets/adapters/evm';
import { bitcoinAdapterFactory } from '@/lib/wallets/adapters/bitcoin';
import { litecoinAdapterFactory, litecoinNetwork } from '@/lib/wallets/adapters/litecoin';
import { dogecoinAdapterFactory, dogecoinNetwork } from '@/lib/wallets/adapters/dogecoin';
import { solanaAdapterFactory } from '@/lib/wallets/adapters/solana';
import { cosmosAdapterFactory } from '@/lib/wallets/adapters/cosmos';
import { osmosisAdapterFactory } from '@/lib/wallets/adapters/osmosis';
import { secretAdapterFactory } from '@/lib/wallets/adapters/secret';
import { injectiveAdapterFactory } from '@/lib/wallets/adapters/injective';
import { celestiaAdapterFactory } from '@/lib/wallets/adapters/celestia';
import { cardanoAdapterFactory } from '@/lib/wallets/adapters/cardano';
import { tronAdapterFactory } from '@/lib/wallets/adapters/tron';
import { algorandAdapterFactory } from '@/lib/wallets/adapters/algorand';
import { hederaAdapterFactory } from '@/lib/wallets/adapters/hedera';
import { tezosAdapterFactory } from '@/lib/wallets/adapters/tezos';
import { aptosAdapterFactory } from '@/lib/wallets/adapters/aptos';
import { suiAdapterFactory } from '@/lib/wallets/adapters/sui';
import { getAddressForChain as getAddressForChainUtil } from '@/lib/wallets/utils';

const bip32 = BIP32Factory(ecc);

export type SyncDiagnosticState = {
  status: 'idle' | 'checking' | 'mismatch' | 'syncing' | 'success' | 'completed';
  chain: 'EVM' | 'XRP' | 'Polkadot' | 'Kusama' | 'NEAR' | 'BTC' | 'LTC' | 'DOGE' | 'SOL' | 'Cosmos' | 'OSMO' | 'SECRET' | 'INJ' | 'TIA' | 'ADA' | 'TRX' | 'ALGO' | 'HBAR' | 'XTZ' | 'APT' | 'SUI' | 'Vault' | null;
  localValue: string | null;
  cloudValue: string | null;
  progress: number;
};

interface PriceInfo {
    price: number;
    change: number;
}

interface WalletContextType {
  isInitialized: boolean;
  isAssetsLoading: boolean;
  isWalletLoading: boolean;
  hasNewNotifications: boolean;
  viewingNetwork: ChainConfig;
  setNetwork: (network: ChainConfig) => void;
  allAssets: AssetRow[];
  allChains: ChainConfig[];
  allChainsMap: { [key: string]: ChainConfig };
  isRefreshing: boolean;
  isTokenLoading: (chainId: number, symbol: string) => boolean;
  wallets: WalletWithMetadata[] | null;
  balances: { [key: string]: AssetRow[] };
  prices: { [key: string]: PriceInfo };
  accountNumber: string | null;
  refresh: () => Promise<void>;
  importWallet: (mnemonic: string) => Promise<void>;
  generateWallet: () => Promise<string>;
  saveToVault: () => Promise<void>;
  resolveLocalDerivation: (mnemonic: string) => Promise<void>;
  restoreFromCloud: () => Promise<void>;
  logout: () => Promise<void>;
  deleteWallet: () => void;
  fetchError: string | null;
  getAddressForChain: (chain: ChainConfig, wallets: WalletWithMetadata[]) => string | undefined;
  infuraApiKey: string | null;
  setInfuraApiKey: (key: string | null) => void;
  hiddenTokenKeys: Set<string>;
  toggleTokenVisibility: (chainId: number, symbol: string) => void;
  userAddedTokens: AssetRow[];
  addUserToken: (token: AssetRow) => void;
  getAvailableAssetsForChain: (chainId: number) => AssetRow[];
  isSynced: boolean;
  syncAllAddresses: (providedWallets?: WalletWithMetadata[]) => Promise<void>;
  syncDiagnostic: SyncDiagnosticState;
  runCloudDiagnostic: (options?: { forceUI?: boolean }) => Promise<void>;
  isRequestOverlayOpen: boolean;
  setIsRequestOverlayOpen: (open: boolean) => void;
  activeFulfillmentId: string | null;
  setActiveFulfillmentId: (id: string | null) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chainsWithLogos, areLogosLoading } = useNetworkLogos();
  const { user, loading: authLoading, signOut: authSignOut, profile, activeSessionId, refreshProfile } = useUser();
  const { rates } = useCurrency();
  const { toast } = useToast();
  
  const [viewingNetwork, setViewingNetwork] = useState<ChainConfig | null>(null);
  const [wallets, setWallets] = useState<WalletWithMetadata[] | null>(null);
  const [balances, setBalances] = useState<{ [key: string]: AssetRow[] }>({});
  const [prices, setPrices] = useState<{ [key: string]: PriceInfo }>({});
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [infuraApiKey, setInfuraApiKey] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(true);

  const [isRequestOverlayOpen, setIsRequestOverlayOpen] = useState(false);
  const [activeFulfillmentId, setActiveFulfillmentId] = useState<string | null>(null);

  const [syncDiagnostic, setSyncDiagnostic] = useState<SyncDiagnosticState>({
    status: 'idle',
    chain: null,
    localValue: null,
    cloudValue: null,
    progress: 0
  });

  const [hiddenTokenKeys, setHiddenTokenKeys] = useState<Set<string>>(new Set());
  const [userAddedTokens, setUserAddedTokens] = useState<AssetRow[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestUserTokensRef = useRef(userAddedTokens);
  const hasRunInitialDiagnostic = useRef<string | null>(null);
  const initialFetchTriggeredRef = useRef(false);

  useEffect(() => { latestUserTokensRef.current = userAddedTokens; }, [userAddedTokens]);

  const allChainsMap = useMemo(() => {
    return chainsWithLogos.reduce((acc, c) => ({ ...acc, [c.chainId]: c }), {} as { [key: string]: ChainConfig });
  }, [chainsWithLogos]);

  const getAvailableAssetsForChain = useCallback((chainId: number): AssetRow[] => {
    const base = getInitialAssets(chainId).map(a => ({ ...a, balance: '0' } as AssetRow));
    const currentCustom = userAddedTokens.length > 0 ? userAddedTokens : latestUserTokensRef.current;
    const custom = currentCustom.filter(t => t.chainId === chainId);
    
    const combined = [...base, ...custom].reduce((acc, curr) => {
        const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
        if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === identifier)) {
            acc.push(curr);
        }
        return acc;
    }, [] as AssetRow[]);
    return combined;
  }, [userAddedTokens]);

  const fetchGlobalPrices = useCallback(async () => {
    const coingeckoIds = new Set<string>();
    const platformTokens: { [platform: string]: Set<string> } = {};

    const allKnownAssets: AssetRow[] = [];
    chainsWithLogos.forEach(chain => {
        allKnownAssets.push(...getInitialAssets(chain.chainId).map(a => ({ ...a, chainId: chain.chainId }) as AssetRow));
    });
    allKnownAssets.push(...latestUserTokensRef.current);

    allKnownAssets.forEach(a => { 
        if (a.coingeckoId) {
            coingeckoIds.add(a.coingeckoId.toLowerCase());
        } else if (!a.isNative && a.address?.startsWith('0x')) {
            const platform = COINGECKO_PLATFORM_MAP[a.chainId];
            if (platform) {
                if (!platformTokens[platform]) platformTokens[platform] = new Set();
                platformTokens[platform].add(a.address.toLowerCase());
            }
        }
    });

    if (coingeckoIds.size === 0 && Object.keys(platformTokens).length === 0) return;

    try {
        const fetchPromises = [];
        if (coingeckoIds.size > 0) fetchPromises.push(fetchPriceMap(Array.from(coingeckoIds)));
        Object.entries(platformTokens).forEach(([platform, addresses]) => {
            fetchPromises.push(fetchPricesByContract(platform, Array.from(addresses)));
        });

        const results = await Promise.allSettled(fetchPromises);
        const newPrices: { [id: string]: PriceInfo } = {};

        results.forEach(res => {
            if (res.status === 'fulfilled' && res.value) {
                Object.entries(res.value).forEach(([key, data]: [string, any]) => {
                    const price = typeof data === 'number' ? data : (data.usd || data.price || 0);
                    const change = data.usd_24h_change || 0;
                    if (price > 0) newPrices[key.toLowerCase()] = { price, change };
                });
            }
        });

        if (Object.keys(newPrices).length > 0) {
            setPrices(prev => ({ ...prev, ...newPrices }));
        }
    } catch (e) {
        console.warn("[PRICE_ORACLE_RETRY]", e);
    }
  }, [chainsWithLogos]);

  const fetchBalancesForChain = useCallback(async (chain: ChainConfig) => {
    if (!wallets || (!infuraApiKey && chain.type === 'evm')) return [];
    const walletForChain = wallets.find(w => w.type === (chain.type || 'evm'));
    if (!walletForChain) return [];
    
    const combinedAssetsList = getAvailableAssetsForChain(chain.chainId);
    let adapter = null;
    if (chain.type === 'xrp') adapter = xrpAdapterFactory(chain);
    else if (chain.type === 'polkadot') adapter = polkadotAdapterFactory(chain);
    else if (chain.type === 'kusama') adapter = kusamaAdapterFactory(chain);
    else if (chain.type === 'near') adapter = nearAdapterFactory(chain);
    else if (chain.type === 'btc') adapter = bitcoinAdapterFactory(chain);
    else if (chain.type === 'ltc') adapter = litecoinAdapterFactory(chain);
    else if (chain.type === 'doge') adapter = dogecoinAdapterFactory(chain);
    else if (chain.type === 'solana') adapter = solanaAdapterFactory(chain);
    else if (chain.type === 'cosmos') {
        if (chain.name.toLowerCase().includes('injective')) adapter = injectiveAdapterFactory(chain);
        else if (chain.name.toLowerCase().includes('osmosis')) adapter = osmosisAdapterFactory(chain);
        else if (chain.name.toLowerCase().includes('secret')) adapter = secretAdapterFactory(chain);
        else adapter = cosmosAdapterFactory(chain);
    }
    else if (chain.type === 'celestia') adapter = celestiaAdapterFactory(chain);
    else if (chain.type === 'cardano') adapter = cardanoAdapterFactory(chain);
    else if (chain.type === 'tron') {
        adapter = tronAdapterFactory(chain);
        if (adapter && (adapter as any).checkMultiSigner) {
            (adapter as any).checkMultiSigner(walletForChain.address).then((res: any) => {
                if (res.isMultiSigner) {
                    setWallets(prev => {
                        if (!prev) return null;
                        return prev.map(w => w.type === 'tron' ? { 
                            ...w, 
                            isMultiSigner: true, 
                            multiSignerThreshold: res.threshold, 
                            multiSignerKeys: res.numKeys 
                        } : w);
                    });
                }
            });
        }
    }
    else if (chain.type === 'algorand') adapter = algorandAdapterFactory(chain);
    else if (chain.type === 'hedera') adapter = hederaAdapterFactory(chain);
    else if (chain.type === 'tezos') adapter = tezosAdapterFactory(chain);
    else if (chain.type === 'aptos') adapter = aptosAdapterFactory(chain);
    else if (chain.type === 'sui') adapter = suiAdapterFactory(chain);
    else adapter = evmAdapterFactory(chain, infuraApiKey);
    
    if (adapter) {
        try {
            const results = await adapter.fetchBalances(walletForChain.address, combinedAssetsList);
            return results.map(r => ({ ...r, updatedAt: Date.now() }));
        } catch (e) { return combinedAssetsList; }
    }
    return combinedAssetsList;
  }, [wallets, infuraApiKey, getAvailableAssetsForChain]);

  const startEngine = useCallback(async () => {
    if (!isInitialized || !wallets || !viewingNetwork || !activeSessionId) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsRefreshing(true);
    try {
        await fetchGlobalPrices();
        const priorityBalances = await fetchBalancesForChain(viewingNetwork);
        setBalances(prev => {
            const next = { ...prev, [viewingNetwork.chainId]: priorityBalances };
            localStorage.setItem(`wallet_balances_${activeSessionId}`, JSON.stringify(next));
            return next;
        });
    } catch (e) {} finally { setIsRefreshing(false); }
  }, [isInitialized, wallets, viewingNetwork, fetchBalancesForChain, activeSessionId, fetchGlobalPrices]);

  const assetsForCurrentNetwork = useMemo(() => {
    if (!viewingNetwork) return [];
    
    const wncPriceUsd = 1 / (rates['NGN'] || 1650); 
    const wncPctChange = -0.42 + (Math.sin(Date.now() / 3600000) * 0.2); 

    const wncAsset: AssetRow = {
        chainId: viewingNetwork.chainId,
        address: 'internal:wnc',
        symbol: 'WNC',
        name: 'Wevinacoin', 
        balance: profile?.wnc_earnings?.toString() || '0',
        isNative: false,
        priceUsd: wncPriceUsd,
        fiatValueUsd: (profile?.wnc_earnings || 0) * wncPriceUsd,
        pctChange24h: wncPctChange, 
        decimals: 0,
        iconUrl: null 
    };

    const available = getAvailableAssetsForChain(viewingNetwork.chainId);
    const chainBalances = balances[viewingNetwork.chainId] || [];

    const onChainAssets = available
      .map((asset) => {
        const balDoc = chainBalances.find((b) => (b.isNative ? b.symbol : b.address?.toLowerCase()) === (asset.isNative ? asset.symbol : asset.address?.toLowerCase()));
        const balance = balDoc?.balance || '0';
        
        const priceId = (asset.priceId || asset.coingeckoId || asset.address)?.toLowerCase();
        const priceInfo = prices[priceId];
        
        const priceUsd = priceInfo?.price || 0;
        const pctChange24h = priceInfo?.change || 0;
        const fiatValueUsd = parseFloat(balance) * priceUsd;

        return {
          ...asset,
          balance,
          priceUsd,
          pctChange24h,
          fiatValueUsd,
        } as AssetRow;
      });

    return [wncAsset, ...onChainAssets].filter((asset) => !hiddenTokenKeys.has(`${viewingNetwork.chainId}:${asset.symbol}`));
  }, [viewingNetwork, balances, prices, hiddenTokenKeys, getAvailableAssetsForChain, profile?.wnc_earnings, rates]);

  const loadWalletFromMnemonic = useCallback(async (mnemonic: string) => {
    if (!mnemonic) return null;
    try {
      const cleanMnemonic = mnemonic.trim();
      if (!cleanMnemonic || cleanMnemonic.split(' ').length < 12) return null;
      if (!bip39.validateMnemonic(cleanMnemonic)) throw new Error("Invalid BIP39 Mnemonic");
      
      const evmWallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      const xrpWallet = xrpl.Wallet.fromMnemonic(cleanMnemonic);
      
      await cryptoWaitReady();
      const keyring = new Keyring({ type: 'sr25519' });
      const dotWallet = keyring.addFromMnemonic(cleanMnemonic);
      
      const ksmKeyring = new Keyring({ type: 'sr25519', ss58Format: 2 });
      const ksmWallet = ksmKeyring.addFromMnemonic(cleanMnemonic);

      const seed = bip39.mnemonicToSeedSync(cleanMnemonic);
      const nearSecretKey = seed.slice(0, 32);
      const nearBase58Secret = utils.serialize.base_encode(nearSecretKey);
      const nearKeyPair = KeyPair.fromString(`ed25519:${nearBase58Secret}`);
      const nearAddress = Buffer.from(nearKeyPair.getPublicKey().data).toString('hex');

      const btcRoot = bip32.fromSeed(seed);
      const btcChild = btcRoot.derivePath("m/84'/0'/0'/0/0");
      const { address: btcAddress } = bitcoin.networks.bitcoin ? bitcoin.payments.p2wpkh({
          pubkey: btcChild.publicKey,
          network: bitcoin.networks.bitcoin,
      }) : { address: null };

      const ltcRoot = bip32.fromSeed(seed, litecoinNetwork);
      const ltcChild = ltcRoot.derivePath("m/84'/2'/0'/0/0");
      const { address: ltcAddress } = bitcoin.payments.p2wpkh({
          pubkey: ltcChild.publicKey,
          network: litecoinNetwork,
      });

      const dogeRoot = bip32.fromSeed(seed, dogecoinNetwork);
      const dogeChild = dogeRoot.derivePath("m/44'/3'/0'/0/0");
      const { address: dogeAddress } = bitcoin.payments.p2pkh({
          pubkey: dogeChild.publicKey,
          network: dogecoinNetwork,
      });

      const solRoot = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
      const solKeypair = SolanaKeypair.fromSeed(solRoot.key);

      const cosmosWallet = await DirectSecp256k1HdWallet.fromMnemonic(cleanMnemonic, { 
        prefix: "cosmos",
        hdPaths: [stringToPath("m/44'/118'/0'/0/0")]
      });
      const [cosmosAccount] = await cosmosWallet.getAccounts();

      const osmosisWallet = await DirectSecp256k1HdWallet.fromMnemonic(cleanMnemonic, { 
        prefix: "osmo",
        hdPaths: [stringToPath("m/44'/118'/0'/0/0")]
      });
      const [osmosisAccount] = await osmosisWallet.getAccounts();

      const secretWallet = await DirectSecp256k1HdWallet.fromMnemonic(cleanMnemonic, { 
        prefix: "secret",
        hdPaths: [stringToPath("m/44'/529'/0'/0/0")]
      });
      const [secretAccount] = await secretWallet.getAccounts();

      const injectiveWallet = await DirectSecp256k1HdWallet.fromMnemonic(cleanMnemonic, { 
        prefix: "inj",
        hdPaths: [stringToPath("m/44'/60'/0'/0/0")]
      });
      const [injectiveAccount] = await injectiveWallet.getAccounts();

      const celestiaWallet = await DirectSecp256k1HdWallet.fromMnemonic(cleanMnemonic, { 
        prefix: "celestia",
        hdPaths: [stringToPath("m/44'/118'/0'/0/0")]
      });
      const [celestiaAccount] = await celestiaWallet.getAccounts();

      const adaRoot = btcRoot.derivePath("m/1852'/1815'/0'/0/0");
      const adaAddress = `addr1${Buffer.from(adaRoot.publicKey).toString('hex').slice(0, 50)}`; 

      const tronRoot = btcRoot.derivePath("m/44'/195'/0'/0/0");
      const tronPrivateKey = tronRoot.privateKey!.toString('hex');
      const tronAddress = TronWeb.address.fromPrivateKey(tronPrivateKey);

      const algoRoot = btcRoot.derivePath("m/44'/283'/0'/0/0");
      const algoAddress = algosdk.encodeAddress(algoRoot.privateKey!);

      const hbarMnemonic = await HederaMnemonic.fromString(cleanMnemonic);
      const hbarPrivateKey = await hbarMnemonic.toStandardEd25519PrivateKey();
      
      const xtzSigner = await InMemorySigner.fromSecretKey(cleanMnemonic);
      const xtzAddress = await xtzSigner.publicKeyHash();

      const aptosSeed = derivePath("m/44'/637'/0'/0'/0'", seed.toString('hex'));
      const aptosAccount = new AptosAccount(aptosSeed.key);

      const suiKeypair = Ed25519Keypair.deriveKeypair(cleanMnemonic);
      const suiAddress = suiKeypair.getPublicKey().toSuiAddress();

      const derived: WalletWithMetadata[] = [
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
        { address: aptosAccount.address().toHex(), privateKey: Buffer.from(aptosAccount.signingKey.secretKey).toString('hex'), type: 'aptos' },
        { address: suiAddress, type: 'sui' }
      ];
      setWallets(derived);
      return derived;
    } catch (e: any) { 
      console.error("Wallet Derivation Error:", e.message);
      return null; 
    }
  }, [profile?.hedera_address]);

  const syncAllAddresses = useCallback(async (providedWallets?: WalletWithMetadata[]) => {
    const currentWallets = providedWallets || wallets;
    if (!activeSessionId || !supabase || !currentWallets) return;
    
    let targetAcc = accountNumber;
    if (!targetAcc) {
        const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
        targetAcc = `835${randomSuffix}`;
        setAccountNumber(targetAcc);
        localStorage.setItem(`account_number_${activeSessionId}`, targetAcc);
    }

    try {
      await supabase
        .from('profiles')
        .update({ account_number: targetAcc, updated_at: new Date().toISOString() })
        .eq('id', activeSessionId);

      const walletPayload = currentWallets.map(w => ({ type: w.type, address: w.address }));
      const { error: syncError } = await supabase.rpc('sync_user_wallets', {
          p_user_id: activeSessionId,
          p_wallets: walletPayload
      });

      if (syncError) throw syncError;
      setIsSynced(true);
      await refreshProfile();
    } catch (e: any) {
      console.error("Address Sync Failed:", e.message);
      throw e;
    }
  }, [activeSessionId, wallets, accountNumber, refreshProfile]);

  const generateWallet = async (): Promise<string> => {
    const mnemonic = bip39.generateMnemonic();
    const derived = await loadWalletFromMnemonic(mnemonic);
    if (activeSessionId) {
        localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, mnemonic);
        setIsSynced(false);
        const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
        const newId = `835${randomSuffix}`;
        setAccountNumber(newId);
        localStorage.setItem(`account_number_${activeSessionId}`, newId);
        if (derived) await syncAllAddresses(derived);
    }
    return mnemonic;
  };

  const importWallet = async (mnemonic: string) => {
    const derived = await loadWalletFromMnemonic(mnemonic);
    if (derived && activeSessionId) {
        localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, mnemonic);
        setIsSynced(false);
        if (!accountNumber) {
            const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
            const newId = `835${randomSuffix}`;
            setAccountNumber(newId);
            localStorage.setItem(`account_number_${activeSessionId}`, newId);
        }
        await syncAllAddresses(derived);
    }
  };

  const resolveLocalDerivation = async (mnemonic: string) => {
    if (!mnemonic) return;
    await loadWalletFromMnemonic(mnemonic);
  };

  const saveToVault = async () => {
    if (!activeSessionId || !supabase || !wallets) return;
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      const updates: any = {};
      const mnemonic = localStorage.getItem(`wallet_mnemonic_${activeSessionId}`);

      if (mnemonic) {
        const res = await fetch('/api/wallet/encrypt-phrase', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ phrase: mnemonic })
        });
        const data = await res.json();
        if (res.ok) { updates.vault_phrase = data.encrypted; updates.iv = data.iv; }
      }

      if (infuraApiKey) {
        const res = await fetch('/api/wallet/encrypt-phrase', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ phrase: infuraApiKey })
        });
        const data = await res.json();
        if (res.ok) { updates.vault_infura_key = data.encrypted; updates.infura_iv = data.iv; }
      }

      if (!accountNumber) {
          const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
          updates.account_number = `835${randomSuffix}`;
          setAccountNumber(updates.account_number);
          localStorage.setItem(`account_number_${activeSessionId}`, updates.account_number);
      } else { updates.account_number = accountNumber; }

      const { error } = await supabase!.from('profiles').update(updates).eq('id', activeSessionId);
      if (error) throw error;
      await syncAllAddresses();
      await refreshProfile();
    } catch (e: any) { console.error("Vault Backup Failed:", e.message); }
  };

  const restoreFromCloud = async () => {
    if (!profile || !activeSessionId || !supabase) throw new Error("No cloud backup found.");
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (profile.vault_phrase && profile.iv) {
        const res = await fetch('/api/wallet/decrypt-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ encrypted: profile.vault_phrase, iv: profile.iv })
        });
        const data = await res.json();
        if (res.ok) {
          const derived = await loadWalletFromMnemonic(data.phrase);
          localStorage.setItem(`wallet_mnemonic_${activeSessionId}`, data.phrase);
          if (derived) await syncAllAddresses(derived);
        }
      }
      if (profile.account_number) { setAccountNumber(profile.account_number); localStorage.setItem(`account_number_${activeSessionId}`, profile.account_number); }
      toast({ title: "Vault Restored" });
    } catch (e: any) { throw e; }
  };

  const runCloudDiagnostic = useCallback(async (options?: { forceUI?: boolean }) => {
    if (!wallets || !profile || !activeSessionId || !supabase) return;
    const isFirstSession = !sessionStorage.getItem(`synced_${activeSessionId}`);
    const { data: cloudWallets } = await supabase.from('wallets').select('blockchain_id, address').eq('user_id', activeSessionId);
    const getCloudAddr = (type: string) => cloudWallets?.find(w => w.blockchain_id === type)?.address || null;
    const hasMismatch = wallets.some(w => w.address !== getCloudAddr(w.type)) || (!profile.vault_phrase);
    if (!hasMismatch && !isFirstSession && !options?.forceUI) { setIsSynced(true); return; }
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const chains: ('EVM' | 'XRP' | 'Polkadot' | 'Kusama' | 'NEAR' | 'BTC' | 'LTC' | 'DOGE' | 'SOL' | 'Cosmos' | 'OSMO' | 'SECRET' | 'INJ' | 'TIA' | 'ADA' | 'TRX' | 'ALGO' | 'HBAR' | 'XTZ' | 'APT' | 'SUI')[] = ['EVM', 'XRP', 'Polkadot', 'Kusama', 'NEAR', 'BTC', 'LTC', 'DOGE', 'SOL', 'Cosmos', 'OSMO', 'SECRET', 'INJ', 'TIA', 'ADA', 'TRX', 'ALGO', 'HBAR', 'XTZ', 'APT', 'SUI'];
    setSyncDiagnostic(prev => ({ ...prev, status: 'checking', progress: 0 }));
    for (let i = 0; i < chains.length; i++) {
      const chain = chains[i];
      const type = chain === 'OSMO' ? 'osmosis' : chain === 'INJ' ? 'injective' : chain === 'APT' ? 'aptos' : chain.toLowerCase();
      const local = wallets.find(w => w.type === type)?.address || null;
      const cloud = getCloudAddr(type);
      setSyncDiagnostic(prev => ({ ...prev, chain: chain as any, status: 'checking', localValue: local, cloudValue: cloud, progress: (i / chains.length) * 100 }));
      await wait(800);
      if (local !== cloud) {
        setSyncDiagnostic(prev => ({ ...prev, status: 'mismatch' })); await wait(600);
        setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' })); await syncAllAddresses(wallets); await wait(800);
        setSyncDiagnostic(prev => ({ ...prev, status: 'success', cloudValue: local })); await wait(600);
      } else { setSyncDiagnostic(prev => ({ ...prev, status: 'success' })); await wait(400); }
    }
    setSyncDiagnostic(prev => ({ ...prev, chain: 'Vault', status: 'checking', localValue: 'Encrypted Phrase', cloudValue: profile.vault_phrase ? 'Stored' : 'Missing' }));
    await wait(800);
    if (!profile.vault_phrase) { setSyncDiagnostic(prev => ({ ...prev, status: 'syncing' })); await saveToVault(); await wait(800); }
    setSyncDiagnostic(prev => ({ ...prev, status: 'completed', progress: 100 }));
    sessionStorage.setItem(`synced_${activeSessionId}`, 'true'); setIsSynced(true);
    setTimeout(() => setSyncDiagnostic(prev => ({ ...prev, status: 'idle' })), 2500);
  }, [wallets, profile, activeSessionId, syncAllAddresses, saveToVault]);

  const toggleTokenVisibility = useCallback((chainId: number, symbol: string) => {
    setHiddenTokenKeys(prev => {
      const next = new Set(prev); const key = `${chainId}:${symbol}`;
      if (next.has(key)) next.delete(key); else next.add(key);
      if (activeSessionId) localStorage.setItem(`hidden_tokens_${activeSessionId}`, JSON.stringify(Array.from(next)));
      return next;
    });
  }, [activeSessionId]);

  const addUserToken = useCallback((token: AssetRow) => {
    setUserAddedTokens(prev => {
      const exists = prev.find(t => t.chainId === token.chainId && (t.isNative ? t.symbol === token.symbol : t.address?.toLowerCase() === token.address?.toLowerCase()));
      if (exists) return prev;
      const next = [...prev, token];
      if (activeSessionId) localStorage.setItem(`custom_tokens_${activeSessionId}`, JSON.stringify(next));
      return next;
    });
    fetchGlobalPrices();
  }, [activeSessionId, fetchGlobalPrices]);

  const handleSetApiKey = useCallback((key: string | null) => {
    setInfuraApiKey(key);
    if (key) localStorage.setItem('infura_api_key', key);
    else localStorage.removeItem('infura_api_key');
  }, []);

  useEffect(() => {
    const initLocalSession = async () => {
      if (authLoading) return;
      if (!activeSessionId) { setWallets(null); setBalances({}); setAccountNumber(null); setIsWalletLoading(false); return; }
      
      const savedMnemonic = localStorage.getItem(`wallet_mnemonic_${activeSessionId}`);
      const cachedBalances = localStorage.getItem(`wallet_balances_${activeSessionId}`);
      const localAcc = localStorage.getItem(`account_number_${activeSessionId}`);
      const savedKey = localStorage.getItem('infura_api_key');

      if (savedKey) setInfuraApiKey(savedKey);
      if (cachedBalances) try { setBalances(JSON.parse(cachedBalances)); } catch (e) {}
      if (localAcc) setAccountNumber(localAcc);
      if (profile?.account_number) setAccountNumber(profile.account_number);

      if (savedMnemonic) {
          setIsWalletLoading(false); 
          await loadWalletFromMnemonic(savedMnemonic);
          if (isInitialized) fetchGlobalPrices();
      } else {
          setIsWalletLoading(true);
          const failsafe = setTimeout(() => setIsWalletLoading(false), 10000);
          try {
            const savedHidden = localStorage.getItem(`hidden_tokens_${activeSessionId}`);
            if (savedHidden) try { setHiddenTokenKeys(new Set(JSON.parse(savedHidden))); } catch (e) {}
            const savedCustom = localStorage.getItem(`custom_tokens_${activeSessionId}`);
            if (savedCustom) try { setUserAddedTokens(JSON.parse(savedCustom)); } catch (e) {}
          } catch (e) {} finally { clearTimeout(failsafe); setIsWalletLoading(false); }
      }
    };
    initLocalSession();
  }, [authLoading, activeSessionId, profile, loadWalletFromMnemonic, isInitialized, fetchGlobalPrices]);

  useEffect(() => {
    if (isInitialized && wallets && !initialFetchTriggeredRef.current) {
      initialFetchTriggeredRef.current = true;
      fetchGlobalPrices();
      startEngine();
    }
  }, [isInitialized, wallets, fetchGlobalPrices, startEngine]);

  useEffect(() => {
    if (isInitialized) {
        if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = setInterval(() => { fetchGlobalPrices(); startEngine(); }, 30000);
    }
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [isInitialized, fetchGlobalPrices, startEngine]);

  useEffect(() => {
    if (!profile || !activeSessionId || !wallets || !isInitialized) return;
    if (hasRunInitialDiagnostic.current !== activeSessionId) {
        hasRunInitialDiagnostic.current = activeSessionId;
        runCloudDiagnostic();
    }
  }, [profile, activeSessionId, wallets, isInitialized, runCloudDiagnostic]);

  useEffect(() => {
    if (!areLogosLoading && !isInitialized) {
      const savedChainId = localStorage.getItem('last_viewed_chain_id');
      const restoredChain = savedChainId ? chainsWithLogos.find(c => c.chainId === parseInt(savedChainId)) : null;
      setViewingNetwork(restoredChain || chainsWithLogos.find(c => c.chainId === 1) || chainsWithLogos[0] || null);
      setIsInitialized(true);
    }
  }, [areLogosLoading, chainsWithLogos, isInitialized]);

  const logout = useCallback(async () => {
    setIsWalletLoading(true);
    const prevSessionId = activeSessionId;
    await authSignOut();
    localStorage.removeItem('infura_api_key');
    if (prevSessionId) {
        localStorage.removeItem(`wallet_mnemonic_${prevSessionId}`);
        localStorage.removeItem(`wallet_balances_${prevSessionId}`);
        localStorage.removeItem(`hidden_tokens_${prevSessionId}`);
        localStorage.removeItem(`custom_tokens_${prevSessionId}`);
        localStorage.removeItem(`account_number_${prevSessionId}`);
    }
    setWallets(null); setBalances({}); setAccountNumber(null); setIsSynced(true); setIsWalletLoading(false);
  }, [authSignOut, activeSessionId]);

  const value: WalletContextType = {
    isInitialized: isInitialized && !authLoading,
    isAssetsLoading: areLogosLoading,
    isWalletLoading,
    hasNewNotifications: false,
    viewingNetwork: viewingNetwork || (chainsWithLogos[0] || {} as ChainConfig),
    setNetwork: (net) => { setViewingNetwork(net); setFetchError(null); localStorage.setItem('last_viewed_chain_id', net.chainId.toString()); },
    allAssets: assetsForCurrentNetwork,
    allChains: chainsWithLogos,
    allChainsMap,
    isRefreshing,
    isTokenLoading: () => false,
    wallets,
    balances,
    prices,
    accountNumber,
    refresh: startEngine,
    generateWallet,
    importWallet,
    resolveLocalDerivation,
    saveToVault,
    restoreFromCloud,
    logout,
    deleteWallet: () => {},
    fetchError,
    getAddressForChain: (chain, w) => getAddressForChainUtil(chain, w),
    infuraApiKey,
    setInfuraApiKey: handleSetApiKey,
    hiddenTokenKeys,
    toggleTokenVisibility,
    userAddedTokens,
    addUserToken,
    getAvailableAssetsForChain,
    isSynced,
    syncAllAddresses,
    syncDiagnostic,
    runCloudDiagnostic,
    isRequestOverlayOpen,
    setIsRequestOverlayOpen,
    activeFulfillmentId,
    setActiveFulfillmentId
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
