
export interface AssetRow {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  balance: string;
  fiatValueUsd?: number;
  priceUsd?: number;
  pctChange24h?: number;
  iconUrl?: string | null;
  isNative?: boolean;
  coingeckoId?: string;
  updatedAt?: number;
  decimals?: number;
  priceSource?: 'coingecko' | 'dex' | 'manual';
  dexPair?: string;
  priceId?: string;
}

export interface WalletWithMetadata {
  address: string;
  ensName?: string;
  avatarUrl?: string;
  privateKey?: string;
  seed?: string; // For XRP
  type: 'evm' | 'xrp' | 'polkadot' | 'kusama' | 'near' | 'btc' | 'ltc' | 'doge' | 'solana' | 'cosmos' | 'osmosis' | 'secret' | 'injective' | 'celestia' | 'cardano' | 'tron' | 'algorand' | 'hedera' | 'tezos' | 'aptos' | 'sui';
  isMultiSigner?: boolean;
  multiSignerThreshold?: number;
  multiSignerKeys?: number;
}

export interface ChainConfig {
    chainId: number;
    name: string;
    symbol: string;
    rpcUrl: string;
    explorer?: string;
    iconUrl?: string | null;
    coingeckoId?: string;
    themeColor?: string;
    type?: 'evm' | 'xrp' | 'polkadot' | 'kusama' | 'near' | 'btc' | 'ltc' | 'doge' | 'solana' | 'cosmos' | 'osmosis' | 'secret' | 'celestia' | 'cardano' | 'tron' | 'algorand' | 'hedera' | 'tezos' | 'aptos' | 'sui';
}

export interface UserProfile {
    id: string; // UUID matching auth.users
    name: string; // Username Column
    photo_url?: string;
    wnc_earnings: number;
    wnc_referral_escrow: number; // New Institutional Escrow Field
    tokens: number;
    plan_type?: string;
    country_code?: string;
    business_category?: string;
    // Multi-chain extension fields
    account_number?: string; 
    vault_phrase?: string;
    iv?: string;
    vault_infura_key?: string;
    infura_iv?: string;
    // Multi-address registry support
    evm_address?: string;
    xrp_address?: string;
    polkadot_address?: string;
    kusama_address?: string;
    near_address?: string;
    btc_address?: string;
    ltc_address?: string;
    doge_address?: string;
    solana_address?: string;
    cosmos_address?: string;
    osmosis_address?: string;
    secret_address?: string;
    injective_address?: string;
    celestia_address?: string;
    cardano_address?: string;
    tron_address?: string;
    algorand_address?: string;
    hedera_address?: string;
    tezos_address?: string;
    aptos_address?: string;
    sui_address?: string;
    onboarding_completed?: boolean;
}

export interface WalletRegistryEntry {
    user_id: string;
    blockchain_id: string; // 'evm', 'xrp', 'near', etc.
    address: string;
    updated_at: string;
}

export interface PaymentRequest {
    id: string;
    requester_id: string;
    requester_account_number: string;
    chain_type: 'evm' | 'xrp' | 'polkadot' | 'kusama' | 'near' | 'btc' | 'ltc' | 'doge' | 'solana' | 'cosmos' | 'osmosis' | 'secret' | 'celestia' | 'cardano' | 'tron' | 'algorand' | 'hedera' | 'tezos' | 'aptos' | 'sui';
    token_symbol: string;
    token_address?: string;
    amount: number;
    note?: string;
    status: 'pending' | 'paid' | 'expired' | 'cancelled';
    created_at: string;
    expires_at: string;
}

export interface LocalSession {
    id: string; // Supabase UID
    profile: UserProfile;
    encryptedMnemonic: string | null;
    encryptedApiKey: string | null;
    lastActive: number;
}

export interface IWalletAdapter {
    fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]>;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link_to?: string;
  read: boolean;
  created_at: string;
}
