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
}

export interface WalletWithMetadata {
  address: string;
  ensName?: string;
  avatarUrl?: string;
  privateKey?: string;
}

export interface Chain {
  chainId: number;
  name: string;
  iconUrl?: string;
  currencySymbol: string;
}

export interface ChainConfig {
    chainId: number;
    name: string;
    symbol: string;
    rpcBase: string;
    explorer: string;
    iconUrl?: string | null;
    coingeckoId?: string;
    themeColor?: string;
}

export interface UserProfile {
    id: string;
    username: string;
    name?: string;
    photo_url?: string;
    wnc_earnings?: number;
    tokens?: number;
    vault_phrase?: string; // Encrypted
    iv?: string; // IV for encryption
}

export interface IWalletAdapter {
  fetchBalances(ownerAddress: string, assets: Omit<AssetRow, 'balance'>[]): Promise<AssetRow[]>;
}

export type AdapterFactory = (chain: ChainConfig, apiKey: string | null) => IWalletAdapter | null;
