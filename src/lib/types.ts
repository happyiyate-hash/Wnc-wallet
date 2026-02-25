
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
  updatedAt?: number; // Last successful sync timestamp
  decimals?: number;
  priceSource?: 'coingecko' | 'dex' | 'manual';
  dexPair?: string;
}

export interface WalletWithMetadata {
  address: string;
  ensName?: string;
  avatarUrl?: string;
  privateKey?: string;
  seed?: string; // For XRP
  type: 'evm' | 'xrp' | 'polkadot';
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
    rpcUrl: string;
    explorer?: string;
    iconUrl?: string | null;
    coingeckoId?: string;
    themeColor?: string;
    type?: 'evm' | 'xrp' | 'polkadot';
}

export interface UserProfile {
    id: string;
    username: string;
    name?: string;
    photo_url?: string;
    wnc_earnings?: number;
    tokens?: number;
    vault_phrase?: string; // Encrypted mnemonic
    iv?: string; // IV for mnemonic
    vault_infura_key?: string; // Encrypted Infura Key
    infura_iv?: string; // IV for infura key
}

export interface IWalletAdapter {
  fetchBalances(ownerAddress: string, assets: Omit<AssetRow, 'balance'>[]): Promise<AssetRow[]>;
}

export type AdapterFactory = (chain: ChainConfig, apiKey: string | null) => IWalletAdapter | null;
