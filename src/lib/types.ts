
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
  type: 'evm' | 'xrp' | 'polkadot' | 'near';
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
    type?: 'evm' | 'xrp' | 'polkadot' | 'near';
}

export interface UserProfile {
    id: string; // UUID matching auth.users
    name: string; // Username Column
    photo_url?: string;
    wnc_earnings: number;
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
    // Legacy support for primary EVM node
    evm_address?: string;
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
    chain_type: 'evm' | 'xrp' | 'polkadot' | 'near';
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
