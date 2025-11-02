export interface AssetRow {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  balance: string;
  fiatValueUsd?: number;
  priceUsd?: number;
  pctChange24h?: number;
  iconUrl?: string;
}

export interface WalletWithMetadata {
  address: string;
  ensName?: string;
  avatarUrl?: string;
}

export interface Chain {
  chainId: number;
  name: string;
  iconUrl?: string;
  currencySymbol: string;
}

export interface ChainConfig extends Chain {
    themeColor: string;
}

export interface UserProfile {
    username: string;
}
