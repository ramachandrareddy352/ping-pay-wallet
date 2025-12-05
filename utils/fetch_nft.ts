import Toast from 'react-native-toast-message';
import {getRpcUrl, normalizeUri} from './common';
import {
  Collectible,
  NFTCompleteMetadata,
  NFTMetadata,
  NFTMetadataResponse,
} from '../types/dataTypes';

export const fetchNFTMetadata = async (
  mint: string,
  rpcUrl: string,
): Promise<NFTMetadataResponse> => {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'getAsset',
        method: 'getAsset',
        params: {id: mint},
      }),
    });

    if (!res.ok) {
      const errMsg =
        res.status === 401
          ? 'Invalid Helius API key'
          : `HTTP error! status: ${res.status}`;
      return {success: false, error: errMsg};
    }

    const data = await res.json();

    if (data.error) {
      const errMsg = data.error.message || 'Unknown error from RPC';
      return {success: false, error: errMsg};
    }

    const item = data.result;
    if (!item) {
      const errMsg = 'No asset data found';
      return {success: false, error: errMsg};
    }

    const content = item.content || {};
    const links = content.links || {};
    const metadata = content.metadata || {};
    const files = content.files || [];

    const image = links.image || metadata.image || content.image || null;

    const nft: NFTMetadata = {
      mint: item.id || mint,
      name: metadata.name || item.name || 'Unknown',
      symbol: metadata.symbol || item.symbol || 'UKN',
      files: files.map((f: any) => ({
        uri: normalizeUri(f.uri) || '',
        mime: f.mime || f.type || '',
        cdn_uri: normalizeUri(f.cdn_uri) || undefined,
      })),
      image,
    };

    return {success: true, data: nft};
  } catch (err: any) {
    console.log('fetchNFTMetadata error:', err);
    const errMsg = err?.message || 'Failed to fetch NFT metadata';
    return {success: false, error: errMsg};
  }
};

export const fetchNFTCompleteMetadata = async (
  mint: string,
  network: 'devnet' | 'mainnet-beta',
): Promise<NFTCompleteMetadata | null> => {
  try {
    const rpcUrl = getRpcUrl(network);
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'getAsset',
        method: 'getAsset',
        params: {id: mint},
      }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        Toast.show({type: 'error', text1: 'Invalid Helius API key'});
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || 'Unknown error from RPC');
    }

    const item = data.result;
    // item.content may contain metadata, links, files
    const content = item.content || {};
    const links = content.links || {};
    const metadata = content.metadata || {};

    const files = content.files || [];
    // fallback image fields used in some metadata formats
    const image = links.image || metadata.image || content.image || null;
    const json_uri = content.json_uri || null;
    const attributes = metadata.attributes || metadata.attrs || [];

    const nft: NFTCompleteMetadata = {
      mint: item.id || mint,
      name: metadata.name || item.name || 'Unknown',
      symbol: metadata.symbol || item.symbol || null,
      description: metadata.description || null,
      external_url: links.external_url || metadata.external_url || null,
      json_uri,
      files: files.map((f: any) => ({
        uri: normalizeUri(f.uri) || '',
        mime: f.mime || f.type || '',
        cdn_uri: normalizeUri(f.cdn_uri) || undefined,
      })),
      image,
      attributes,
      grouping: item.grouping || [],
      creators: item.creators || content.creators || [],
      royalty: item.royalty || undefined,
      token_standard: metadata.token_standard || item.token_standard || null,
      mutable: item.mutable ?? false,
    };

    return nft;
  } catch (err) {
    console.log('fetchNFTMetadata error', err);
    Toast.show({type: 'error', text1: 'Failed to fetch NFT metadata'});
    return null;
  }
};

export const getExtensionFromMime = (mime: string, uri: string): string => {
  const mimeToExt: {[key: string]: string} = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/aac': '.aac',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'text/html': '.html',
  };

  if (mime && mime in mimeToExt) {
    return mimeToExt[mime];
  }

  // Fallback to URI extension
  const parts = uri.split('.');
  if (parts.length > 1) {
    return `.${parts.pop()?.toLowerCase() || 'bin'}`;
  }

  return '.bin';
};

export const fetchNFT = async (rpcUrl: string, ownerAddress: string) => {
  let allItems: any[] = [];
  let tempNFT: Collectible[] = [];

  while (true) {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress,
        },
      }),
    });

    if (!response.ok) {
      break;
    }

    const {result} = await response.json();
    if (!result?.items || result.items.length === 0) {
      break;
    }

    allItems = allItems.concat(result.items);
    if ((result.items || []).length < 100) {
      break;
    }
  }

  for (const item of allItems) {
    const token_standard = item.content?.metadata?.token_standard || 'NOTHING';
    if (token_standard === 'NOTHING') {
      continue;
    }

    const files = item.content?.files || [];
    let mediaUri = '';
    let mediaType = '';

    if (files.length > 0) {
      mediaUri = normalizeUri(files[0].uri);
      mediaType = files[0].mime;
    } else if (item.content?.links?.image) {
      mediaUri = normalizeUri(item.content.links.image);
      mediaType = 'image/png';
    }

    tempNFT.push({
      mint: item.id,
      name: item.content?.metadata?.name || 'Unknown',
      description: item.content?.metadata?.description || 'NOTHING',
      mediaUri,
      mediaType,
    });
  }

  return tempNFT;
};
