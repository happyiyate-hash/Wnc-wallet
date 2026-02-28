
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
    // Direct address columns for P2P Handshake
    evm_address?: string;
    xrp_address?: string;
    polkadot_address?: string;
}

export interface PaymentRequest {
    id: string;
    requester_id: string;
    requester_account_number: string;
    chain_type: 'evm' | 'xrp' | 'polkadot';
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

export interface UserIdentity {
    user_id: string;
    account_number: string;
    blockchain_name: string;
    wallet_address: string;
}

export interface RecentRecipient {
    id: string;
    sender_id: string;
    recipient_account_number: string;
    current_pfp: string;
    last_blockchain_used: string;
    last_address_used: string;
}

export interface IWalletAdapter {
    fetchBalances(
        ownerAddress: string,
        assets: Omit<AssetRow, 'balance'>[]
    ): Promise<AssetRow[]>;
}
