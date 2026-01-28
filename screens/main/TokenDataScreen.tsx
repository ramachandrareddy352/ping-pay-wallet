/* eslint-disable react/no-unstable-nested-components */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Linking,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineChart } from 'react-native-gifted-charts';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';

// Icons
import BackArrowIcon from '../../assets/icons/back-arrow.svg';
import WrongIcon from '../../assets/icons/Wrong.svg';
import BuyIcon from '../../assets/icons/buy-icon.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import ReceiveIcon from '../../assets/icons/receive-icon.svg';
import SendIcon from '../../assets/icons/send-icon.svg';
import SwapIcon from '../../assets/icons/swap-icon.svg';
import SaveIcon from '../../assets/icons/save-icon.svg';
import SavedIcon from '../../assets/icons/saved-fill.svg';
import IncreaseIcon from '../../assets/icons/increase-icon.svg';
import DecreaseIcon from '../../assets/icons/decrease-icon.svg';
import OpenLink from '../../assets/icons/open-link.svg';
import Offline from '../../assets/icons/offline.svg';
import SolImage from '../../assets/images/sol-img.png';
import SolanaImage from '../../assets/images/solana-icon.png';

import { loadWallet, WalletData, saveWallet } from '../../utils/storage';
import { fetchCoinGeckoData, fetchTokenMetadata } from '../../utils/fetch_spl';
import { NATIVE_SOL_MINT, SOL_MINT_ADDRESS } from '../../utils/common';
import { RootStackParamList } from '../../types/navigation';
import { Metadata } from '../../types/dataTypes';
import BottomNavBar from '../../components/BottomNavBar';
import { SvgUri } from 'react-native-svg';

const { width } = Dimensions.get('window');

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y';
type Props = NativeStackScreenProps<RootStackParamList, 'TokenData'>;

export interface Token {
  mint: string;
  logoURI?: string;
}

interface TokenLogoProps {
  token: Token;
}

function isIpfsUri(uri?: string): boolean {
  return typeof uri === 'string' && uri.includes('/ipfs/');
}

const TOKEN_SIZE = 40;
const GATEWAYS = [
  'ipfs.io',
  'cloudflare-ipfs.com',
  'dweb.link',
  'gateway.pinata.cloud', // Add more if needed; some may require auth
];

export function TokenLogo({ token }: TokenLogoProps) {
  const isNativeSol = token.mint === NATIVE_SOL_MINT;
  const rawUri = token.logoURI;

  const fallbackImage = isNativeSol ? SolanaImage : SolImage;

  const [currentUri, setCurrentUri] = useState(rawUri || '');
  const [isSvgType, setIsSvgType] = useState(false);
  const [gatewayIndex, setGatewayIndex] = useState(0);

  useEffect(() => {
    if (!rawUri) return;

    const determineTypeAndUri = async () => {
      let uriToCheck = rawUri;
      if (isIpfsUri(rawUri)) {
        // Extract hash from e.g., https://ipfs.io/ipfs/Qm...
        const hashMatch = rawUri.match(/\/ipfs\/(Qm[1-9A-HJ-NP-Za-km-z]{44})/);
        const hash = hashMatch ? hashMatch[1] : '';
        if (hash) {
          uriToCheck = `https://${GATEWAYS[0]}/ipfs/${hash}`;
        }
      }

      try {
        const response = await fetch(uriToCheck, { method: 'HEAD' });
        const contentType =
          response.headers.get('Content-Type')?.toLowerCase() || '';
        setIsSvgType(
          contentType.includes('svg') || rawUri.toLowerCase().endsWith('.svg'),
        );
        setCurrentUri(uriToCheck);
      } catch (error) {
        console.log('Failed to fetch content type:', error);
        // Fallback to assuming non-SVG
        setIsSvgType(rawUri.toLowerCase().endsWith('.svg'));
        setCurrentUri(uriToCheck);
      }
    };

    determineTypeAndUri();
  }, [rawUri]);

  const handleError = () => {
    if (isIpfsUri(rawUri) && gatewayIndex < GATEWAYS.length - 1 && rawUri) {
      const nextIndex = gatewayIndex + 1;
      const hashMatch = rawUri.match(/\/ipfs\/(Qm[1-9A-HJ-NP-Za-km-z]{44})/);
      const hash = hashMatch ? hashMatch[1] : '';
      if (hash) {
        const nextUri = `https://${GATEWAYS[nextIndex]}/ipfs/${hash}`;
        setCurrentUri(nextUri);
        setGatewayIndex(nextIndex);
      }
    }
  };

  if (!currentUri) {
    return (
      <Image
        source={fallbackImage}
        style={{
          width: TOKEN_SIZE,
          height: TOKEN_SIZE,
          borderRadius: TOKEN_SIZE / 2,
        }}
        className="ml-4 mt-2"
      />
    );
  }

  if (isSvgType) {
    return (
      <View
        style={{
          width: TOKEN_SIZE,
          height: TOKEN_SIZE,
          borderRadius: TOKEN_SIZE / 2,
          overflow: 'hidden',
        }}
        className="ml-4 mt-2"
      >
        <SvgUri
          uri={currentUri}
          width={TOKEN_SIZE}
          height={TOKEN_SIZE}
          onError={handleError}
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: currentUri }}
      style={{
        width: TOKEN_SIZE,
        height: TOKEN_SIZE,
        borderRadius: TOKEN_SIZE / 2,
      }}
      className="ml-4 mt-2"
      defaultSource={fallbackImage}
      onError={handleError}
    />
  );
}

export default function TokenDataScreen({ route, navigation }: Props) {
  const { mintAddress } = route.params;

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [price, setPrice] = useState(0);
  const [network, setNetwork] = useState<'devnet' | 'mainnet-beta'>('devnet');
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [chartLoading, setChartLoading] = useState(false);
  const [toggleSave, setToggleSave] = useState(false);
  const [chartVisible, setChartVisible] = useState(true);
  const [coingeckoId, setCoingeckoId] = useState<string | null>(null);
  const [customMin, setCustomMin] = useState<number>(0);
  const [yRange, setYRange] = useState<number>(1);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  // Monitor internet connection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  // Load wallet on mount
  useEffect(() => {
    const init = async () => {
      await loadWalletData();
    };
    init();
  }, []);

  // Fetch chart when CoinGecko ID or time range changes
  useEffect(() => {
    if (coingeckoId && isConnected) {
      fetchChartData();
    }
  }, [timeRange, coingeckoId, isConnected]);

  const onRefresh = useCallback(() => {
    if (wallet && mintAddress) {
      fetchTokenData();
    }
  }, [wallet, mintAddress]);

  const loadWalletData = async () => {
    try {
      const w = await loadWallet();
      if (w) {
        setWallet(w);
        setNetwork(w.network);
        setToggleSave(w.bookmarks?.includes(mintAddress) ?? false);
      } else {
        Toast.show({ type: 'error', text1: 'No wallet found, please check!' });
        return;
      }
      if (!isConnected) {
        Toast.show({ type: 'error', text1: 'Check your Internet connection!' });
        return;
      }
      // ✅ Fetch data immediately after loading wallet
      await fetchTokenData(w);
    } catch (error) {
      console.log('Error loading wallet:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to fetch wallet data.',
      });
    }
  };

  // 🧩 Fetch CoinGecko ID
  const fetchCoinGeckoId = async (mint: string): Promise<string | null> => {
    if (!isConnected) {
      return null;
    }

    try {
      const url = `https://pro-api.coingecko.com/api/v3/coins/solana/contract/${mint}`;
      const response = await fetch(url, {
        headers: {
          'x-cg-pro-api-key': 'CG-gGZzBokLfpa3g9ihhhKUNine',
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data?.id && data.market_data?.current_price?.usd) {
        setPrice(data.market_data.current_price.usd);
        return data.id;
      }
      return null;
    } catch (error) {
      console.log('Error fetching CoinGecko ID:', error);
      return null;
    }
  };

  const fetchTokenData = async (walletParam?: WalletData) => {
    if (!isConnected) {
      return;
    }

    try {
      setLoading(true);
      const w = walletParam || wallet;
      if (!w) {
        console.log('Wallet not loaded yet, skipping fetchTokenData');
        setLoading(false);
        return;
      }

      let mint_id = mintAddress;
      if (mintAddress === NATIVE_SOL_MINT) mint_id = SOL_MINT_ADDRESS;

      const asset = await fetchTokenMetadata(mint_id, w.network);
      setMetadata(asset);

      if (w.network === 'devnet') {
        if (
          mintAddress === NATIVE_SOL_MINT ||
          mintAddress === SOL_MINT_ADDRESS
        ) {
          setCoingeckoId('solana');
          setChartVisible(true);
        } else {
          setCoingeckoId(null);
          setChartVisible(false);
        }
      } else {
        const cgId = await fetchCoinGeckoId(mint_id);
        if (cgId) {
          setCoingeckoId(cgId);
          setChartVisible(true);
        } else {
          setCoingeckoId(null);
          setChartVisible(false);
        }
      }
    } catch (error) {
      console.log('Error fetching token data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    if (!isConnected) {
      return;
    }

    if (!coingeckoId) return;
    setChartLoading(true);
    try {
      const days = {
        '1D': 1,
        '1W': 7,
        '1M': 30,
        '3M': 100,
        '1Y': 365,
      }[timeRange];
      const data = await fetchCoinGeckoData(coingeckoId, days);
      // console.log(data);
      if (data && data.prices?.length > 0) {
        const priceValues = data.prices.map((p: [number, number]) => p[1]);
        const minPrice = Math.min(...priceValues);
        const maxPrice = Math.max(...priceValues);
        const newCustomMin = minPrice * 0.9;
        const range = maxPrice * 1.1 - newCustomMin;

        setCustomMin(newCustomMin);
        setYRange(range);

        const firstPrice = priceValues[0];
        const lastPrice = priceValues.at(-1) ?? firstPrice;
        const change = ((lastPrice - firstPrice) / firstPrice) * 100;
        setPriceChange(change);

        const prices = data.prices.map((p: [number, number]) => {
          const dateObj = new Date(p[0]);
          return {
            value: p[1] - newCustomMin,
            date:
              dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }) +
              '\n' +
              dateObj.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            originalValue: p[1],
          };
        });

        setChartData(prices);
      } else {
        setChartData([]);
        setChartVisible(false);
      }
    } catch (error) {
      console.log('Error fetching chart data:', error);
    } finally {
      setChartLoading(false);
    }
  };

  const toggleBookmark = async () => {
    const walletData = await loadWallet();
    if (!walletData) return;
    const currentBookmarks = walletData.bookmarks || [];
    const updatedBookmarks = currentBookmarks.includes(mintAddress)
      ? currentBookmarks.filter(addr => addr !== mintAddress)
      : [...currentBookmarks, mintAddress];

    const updatedWallet: WalletData = {
      ...walletData,
      bookmarks: updatedBookmarks,
    };
    await saveWallet(updatedWallet);
    setToggleSave(!toggleSave);
    Toast.show({
      type: 'success',
      text1: toggleSave ? 'Removed from bookmarks' : 'Added to bookmarks',
    });
  };

  const truncatedMint = mintAddress.slice(0, 4) + '...' + mintAddress.slice(-4);
  const handleCopyAddress = () => {
    Clipboard.setString(mintAddress);
    Toast.show({ type: 'success', text1: 'Address copied to clipboard' });
  };

  if (!isConnected) {
    return (
      <View className="flex-1 bg-black">
        <View className="flex-1 justify-center items-center">
          <Offline width={80} height={80} />
          <Text className="text-white text-lg mt-6 font-semibold">
            Please connect to the internet
          </Text>
        </View>
        <BottomNavBar active="null" />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#9707B5" />
        <Text className="text-gray-400 mt-2">Loading token data...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            className="p-2"
          >
            <BackArrowIcon width={16} height={16} fill="#9707B5" />
          </TouchableOpacity>
          <Text className="text-white text-base font-medium mx-4">
            Token Metadata
          </Text>
        </View>

        {/* Token Info */}
        <View className="px-4 flex-row justify-between items-center">
          <View className="flex-row items-center flex-1">
            <TokenLogo
              token={{
                mint: mintAddress,
                logoURI: metadata?.image_uri,
              }}
            />
            <View className="ml-4">
              <Text className="text-white text-base font-semibold">
                $
                {metadata?.price_per_token
                  ? metadata.price_per_token.toFixed(4)
                  : price.toFixed(4)}
              </Text>
              <View className="flex-row items-center mt-1">
                {priceChange >= 0 ? (
                  <IncreaseIcon width={16} height={16} fill="#1BF6A0" />
                ) : (
                  <DecreaseIcon width={16} height={16} fill="#FF3B30" />
                )}
                <Text
                  className={`${
                    priceChange >= 0 ? 'text-green-500' : 'text-red-500'
                  } text-xs mx-1 font-medium`}
                >
                  {priceChange.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={toggleBookmark} className="ml-2">
            {toggleSave ? (
              <SavedIcon width={22} height={22} fill="#9707B5" />
            ) : (
              <SaveIcon width={22} height={22} fill="#9707B5" />
            )}
          </TouchableOpacity>
        </View>

        {/* --- PRICE CHART --- */}
        <View
          style={{
            height: 280,
            width: width,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 10,
          }}
        >
          {chartLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#A80EF0" />
              <Text className="text-gray-400 mt-2">Loading chart...</Text>
            </View>
          ) : chartVisible && chartData.length > 0 ? (
            <LineChart
              data={chartData}
              areaChart
              curved
              curvature={0.35}
              isAnimated
              animationDuration={800}
              animateTogether
              hideDataPoints
              hideRules
              hideYAxisText
              initialSpacing={0}
              thickness={3}
              // ⭐ Professional Colors
              color="#B839FF"
              startFillColor="#B839FF"
              endFillColor="#000000"
              startOpacity={0.9}
              endOpacity={0.1}
              // ⭐ Perfect width & spacing
              width={width - 20}
              height={260}
              spacing={(width - 20) / chartData.length}
              // ⭐ Smoother interpolation
              // tension={0.4}

              // ⭐ Auto Y-range
              maxValue={yRange}
              stepValue={yRange / 6}
              // ⭐ Beautiful Pointer Tooltip
              pointerConfig={{
                pointerStripColor: '#B839FF',
                pointerStripWidth: 2,
                pointerColor: '#FFFFFF',
                radius: 5,
                pointerLabelWidth: 110,
                pointerLabelHeight: 85,
                pointerStripHeight: 200,
                autoAdjustPointerLabelPosition: false,
                pointerLabelComponent: (items: any[]) => (
                  <View
                    style={{
                      backgroundColor: 'rgba(20,20,20,0.88)',
                      padding: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      width: 110,
                    }}
                  >
                    <Text
                      style={{
                        color: '#CFCFCF',
                        fontSize: 10,
                        marginBottom: 4,
                        textAlign: 'center',
                      }}
                    >
                      {items[0].date}
                    </Text>
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 16,
                        fontWeight: 'bold',
                      }}
                    >
                      ${items[0].originalValue.toFixed(4)}
                    </Text>
                  </View>
                ),
              }}
              backgroundColor="transparent"
            />
          ) : (
            <View className="items-center">
              <WrongIcon />
              <Text className="mt-2 text-gray-500">
                Price Chart Not Available
              </Text>
            </View>
          )}
        </View>

        {/* --- TIME RANGE BUTTONS (Upgrade UI) --- */}
        {chartVisible && (
          <View className="flex-row justify-around mx-8 mb-6 mt-2">
            {(['1D', '1W', '1M', '3M', '1Y'] as const).map(range => (
              <TouchableOpacity
                key={range}
                onPress={() => setTimeRange(range)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  backgroundColor: timeRange === range ? '#B839FF' : '#111',
                }}
              >
                <Text
                  style={{
                    color: timeRange === range ? 'white' : '#A5A5A5',
                    fontSize: 12,
                    fontWeight: '500',
                  }}
                >
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Buttons */}
        <View className="flex-row gap-3 px-4">
          <TouchableOpacity
            className="flex-1 bg-gray-900 py-3 rounded-2xl items-center justify-center gap-1"
            onPress={() =>
              navigation.navigate('SendRecipient', {
                mintAddress: mintAddress,
                isNFT: false,
              })
            }
          >
            <SendIcon width={16} height={16} />
            <Text className="text-xs font-normal text-white">Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-900 py-3 rounded-2xl items-center justify-center gap-1"
            onPress={() =>
              navigation.navigate('QRCode', {
                accountId: wallet
                  ? wallet.currentAccountId
                    ? wallet.currentAccountId
                    : ''
                  : '',
              })
            }
          >
            <ReceiveIcon width={16} height={16} />
            <Text className="text-xs font-normal text-white">Receive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-900 py-3 rounded-2xl items-center justify-center gap-1"
            onPress={() => navigation.navigate('Swap')}
          >
            <SwapIcon width={16} height={16} />
            <Text className="text-xs font-normal text-white">Swap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-900 py-3 rounded-2xl items-center justify-center gap-1"
            onPress={() =>
              Linking.openURL('https://www.binance.com/en-IN/crypto/buy/')
            }
          >
            <BuyIcon width={16} height={16} />
            <Text className="text-xs font-normal text-white">Buy</Text>
          </TouchableOpacity>
        </View>

        {/* Metadata Section */}
        <View className="px-4 mt-6">
          <Text className="text-gray-400 text-xl font-bold mb-2">
            Token Metadata
          </Text>
          <View className="bg-gray-900 rounded-lg p-4">
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">Name</Text>
              <Text className="text-white text-sm font-medium">
                {mintAddress === NATIVE_SOL_MINT
                  ? 'Solana'
                  : metadata?.name || 'Unknown'}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">Symbol</Text>
              <Text className="text-white text-sm font-medium">
                {metadata?.symbol || 'UKN'}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">Decimals</Text>
              <Text className="text-white text-sm font-medium">
                {metadata?.decimals ?? '-'}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">Mint Address</Text>
              <View className="flex-row items-center">
                <Text className="text-white text-sm font-medium mr-2">
                  {truncatedMint}
                </Text>
                <TouchableOpacity onPress={handleCopyAddress}>
                  <CopyIcon width={16} height={16} />
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">Market Cap</Text>
              <Text className="text-white text-sm font-medium">
                ${metadata?.market_cap?.toLocaleString() ?? '0'}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">Total Supply</Text>
              <Text className="text-white text-sm font-medium">
                {metadata?.supply?.toLocaleString() ?? '0'}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">Json File</Text>
              <TouchableOpacity
                onPress={() =>
                  metadata?.json_uri
                    ? Linking.openURL(metadata.json_uri)
                    : Toast.show({
                        type: 'error',
                        text1: 'Link is Empty, unable to open',
                      })
                }
              >
                <OpenLink width={16} height={16} />
              </TouchableOpacity>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">Is Mutable</Text>
              <Text className="text-white text-sm font-medium">
                {metadata?.is_mutable ? 'TRUE' : 'FALSE'}
              </Text>
            </View>

            <View className="mb-3">
              <Text className="text-gray-400 text-sm">Description:</Text>
              <Text className="text-white text-sm font-medium">
                {metadata?.description || 'NOTHING'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
