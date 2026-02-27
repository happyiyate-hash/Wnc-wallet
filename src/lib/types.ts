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
  type: 'evm' | 'xrp' | 'polkadot';
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
    type?: 'evm' | 'xrp' | 'polkadot';
}

export interface UserProfile {
    id: string;
    username: string; // account_number
    name?: string; // display_name
    photo_url?: string;
    wnc_earnings?: number;
    tokens?: number;
    vault_phrase?: string;
    iv?: string;
    vault_infura_key?: string;
    infura_iv?: string;
}

export interface LocalSession {
    id: string; // Supabase UID
    profile: UserProfile;
    encryptedMnemonic: string | null;
    encryptedApiKey: string | null;
    lastActive: number;
}

export interface RecentRecipient {
    id: string;
    recipient_account_number: string;
    current_pfp: string;
    last_blockchain_used: string;
    last_address_used: string;
}
