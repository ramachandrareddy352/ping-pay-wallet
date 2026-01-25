import axios from 'axios';
import Toast from 'react-native-toast-message';
import { getRpcUrl } from './common';
import { Metadata, TokenBalance } from '../types/dataTypes';

export const fetchTokenMetadata = async (
  mint: string,
  network: 'devnet' | 'mainnet-beta',
) => {
  const rpcUrl = getRpcUrl(network);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'getAsset',
        method: 'getAsset',
        params: {
          id: mint,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Helius API key. Please check your API key.',
        });
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const result = data.result;
    if (data.error) {
      throw new Error(data.error.message);
    }

    const price = result.token_info?.price_info?.price_per_token || 0;
    const supply = result.token_info.supply || 0;

    const metadata: Metadata = {
      mint_address: mint,
      json_uri: result.content?.json_uri || '',
      image_uri: result.content?.files[0]?.uri || '',
      image_mime: result.content?.files[0]?.mime || '',
      description: result.content.metadata.description || 'NOTHING',
      name: result.content.metadata.name || 'UNKNOWN',
      symbol: result.content.metadata.symbol || 'UKN',
      supply: supply,
      decimals: result.token_info.decimals || 0,
      market_cap: price * supply,
      price_per_token: price,
      is_mutable: result.mutable,
    };
    return metadata;
  } catch (error) {
    console.log('Error fetching metadata:', error);
    Toast.show({
      type: 'error',
      text1: 'Failed to fetch token Metadata.',
    });
    return null;
  }
};

export const fetchCoinGeckoData = async (coingeckoId: string, days: number) => {
  try {
    const response = await axios.get(
      `https://pro-api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`, {
      headers: {
        'x-cg-pro-api-key': 'CG-gGZzBokLfpa3g9ihhhKUNine',
      },
    }
    );
    return response.data;
  } catch (error) {
    console.log('Error fetching CoinGecko data:', error);
    Toast.show({
      type: 'error',
      text1: 'Failed to fetch CoinGecko data.',
    });
    return null;
  }
};

export const fetchSPL = async (rpcUrl: string, ownerAddress: string) => {
  let allItems: any[] = [];
  let tempSPL: TokenBalance[] = [];
  let total_usd = 0;
  let page = 1;

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
          page,
          limit: 100, // Helius max page size
          options: {
            // showUnverifiedCollections, showCollectionMetadata, showNativeBalance, showInscription, showZeroBalance
            showFungible: true,
            showZeroBalance: false,
            // showNativeBalance: true,
          },
        },
      }),
    });

    if (!response.ok) {
      break;
    }

    const { result } = await response.json();
    if (!result?.items || result.items.length === 0) {
      break;
    }

    allItems = allItems.concat(result.items);
    if ((result.items || []).length < 10) {
      break;
    }
    page++;
  }

  for (const item of allItems) {
    const decimals = item.token_info?.decimals || 'NOTHING';
    const user_balance = item.token_info?.balance
      ? item.token_info.balance / Math.pow(10, item.token_info.decimals || 0)
      : 0;
    if (decimals === 'NOTHING' || user_balance <= 0) {
      continue;
    }
    const price = item.token_info?.price_info?.price_per_token || 0;
    tempSPL.push({
      mint: item.id,
      amount: user_balance,
      decimals: decimals,
      symbol: item.content?.metadata.symbol || 'UKN',
      name:
        item.content?.metadata?.name ||
        `UNK [${item.id.slice(0, 4)}...${item.id.slice(-4)}]`,
      logoURI:
        item.content?.links?.image ||
        (item.content?.files?.length > 0 ? item.content.files[0].uri : '') ||
        '',
      price: price,
      usd: user_balance * price,
    });

    total_usd += user_balance * price;
  }

  return { items: tempSPL, total_usd };
};
