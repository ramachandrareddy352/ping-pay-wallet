import {ImageSourcePropType} from 'react-native';

export interface AuthOption {
  label: string;
  value: string;
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}
export interface WordItem {
  number: number;
  word: string;
}

export type NFTMetadata = {
  mint: string;
  name: string;
  symbol: string;
  files: {uri: string; mime?: string; cdn_uri?: string}[];
  image: string | null;
};

export type NFTMetadataResponse = {
  success: boolean;
  data?: NFTMetadata;
  error?: string;
};

export type NFTCompleteMetadata = {
  mint: string;
  name: string;
  symbol: string | null;
  description: string | null;
  external_url: string | null;
  json_uri: string | null;
  files: {uri: string; mime?: string; cdn_uri?: string}[];
  image: string | null;
  attributes: {trait_type?: string; value?: any}[];
  grouping: any[];
  creators: {address: string; share?: number; verified?: boolean}[];
  royalty?: {
    royalty_model?: string;
    percent?: number;
    basis_points?: number;
    primary_sale_happened?: boolean;
    locked?: any;
  };
  token_standard?: string | null;
  mutable?: boolean;
};

export interface Metadata {
  mint_address: string;
  json_uri: string;
  image_uri: string;
  image_mime: string;
  description: string;
  name: string;
  symbol: string;
  supply: number;
  decimals: number;
  market_cap: number;
  price_per_token: number;
  is_mutable: boolean;
}

export interface Token {
  name: string;
  balance: number;
  image: string | ImageSourcePropType;
  mint: string;
  symbol: string;
  decimals: number;
  price: number;
}

export interface AddressEntry {
  name: string;
  address: string;
}

export interface TransactionItem {
  signature: string;
  blockTime: number;
  meta: any;
  transaction: any;
  classification: ClassificationResult;
}

export type ClassificationResult = {
  type: 'send' | 'receive' | 'dapp';
  // raw numeric amount in base units (bigint), when applicable
  amountRaw?: bigint | null;
  // human readable formatted string (e.g. "0.12345678")
  amountStr?: string | null;
  // mint for SPL (or null for native SOL)
  mint?: string | null;
  // counterparty owner address (wallet) or token account as fallback
  counterparty?: string | null;
  // whether tx failed
  isFailed: boolean;
  // decimals for token (null for sol, but we'll set 9 for sol when needed)
  tokenDecimals?: number | null;
  // If classified as dapp, optional program address
  dappAddress?: string | null;
};

export interface TokenMint {
  mint: string;
  amount: number;
  decimals: number;
}

export interface TokenBalance extends TokenMint {
  symbol?: string;
  name?: string;
  logoURI?: string;
  price?: number;
  usd?: number;
}

export interface Collectible {
  mint: string;
  name: string;
  description: string;
  mediaUri: string;
  mediaType: string;
}
