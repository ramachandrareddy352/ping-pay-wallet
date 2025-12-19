import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useIsFocused } from '@react-navigation/native';
import Video from 'react-native-video';
import Clipboard from '@react-native-clipboard/clipboard';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

import BuyIcon from '../../assets/icons/buy-icon.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import ReceiveIcon from '../../assets/icons/receive-icon.svg';
import SendIcon from '../../assets/icons/send-icon.svg';
import SwapIcon from '../../assets/icons/swap-icon.svg';
import DotsIcon from '../../assets/icons/three-dots.svg';
import Scanner from '../../assets/icons/ic-qr.svg';
import BookmarkIcon from '../../assets/icons/saved-fill.svg';

import BalanceFrame from '../../assets/images/balance-frame.png';
import SolImage from '../../assets/images/sol-img.png';
import SolanaImage from '../../assets/images/solana-icon.png';
import UsernameFrame from '../../assets/images/user-logo.png';

import { loadWallet, WalletData, WalletAccount } from '../../utils/storage';
import { getConnection } from '../../utils/wallet';
import {
  fetchSolBalance,
  fetchSolPrice,
  getRpcUrl,
  NATIVE_SOL_MINT,
  normalizeUri,
} from '../../utils/common';
import { fetchSPL, fetchTokenMetadata } from '../../utils/fetch_spl';
import { fetchNFT } from '../../utils/fetch_nft';

import { RootStackParamList } from '../../types/navigation';
import BottomNavBar from '../../components/BottomNavBar';
import { Collectible, TokenBalance } from '../../types/dataTypes';
import { useWallet } from '../../src/provider/Wallet';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(
    null,
  );
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [totalUsd, setTotalUsd] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [isAirdrop, setIsAirdrop] = useState(false);
  const [activeTab, setActiveTab] = useState<'tokens' | 'collectibles'>(
    'tokens',
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [hideBalance, setHideBalance] = useState(false);
  const isFocused = useIsFocused();

  // Ref to store interval ID
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor internet connection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (!state.isConnected) {
        setListLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Check your Internet connection!',
        });
      }
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  const web3Wallet = useWallet();

  const handleCurrentAccount = async () => {
    const w = await loadWallet();
    if (!w) {
      setWallet(null);
      setCurrentAccount(null);
      return;
    }
    setWallet(w);
    if (!w?.currentAccountId) {
      setCurrentAccount(null);
      return;
    }

    const acc = w.accounts.find(
      a => a.id === w.currentAccountId,
    ) as WalletAccount;
    if (acc) {
      setCurrentAccount(acc);
    }
  };

  // Internal function to fetch balances without UI reset/loading
  const fetchBalances = async () => {
    if (!currentAccount || !wallet || !isConnected) {
      return { solBal: 0, enrichedTokens: [], splUsd: 0, solUsd: 0 };
    }

    const rpcUrl = getRpcUrl(wallet.network);
    const solBal = await fetchSolBalance(currentAccount.publicKey, rpcUrl);

    const enrichedTokens: TokenBalance[] = [];

    // SOL
    const solPrice = await fetchSolPrice(wallet.network);
    const solUsd = solBal * solPrice;

    enrichedTokens.push({
      mint: NATIVE_SOL_MINT,
      amount: solBal,
      decimals: 9,
      name: 'Solana',
      symbol: 'SOL',
      logoURI: '',
      price: solPrice,
      usd: solUsd,
    });

    // Fungible tokens
    const { items: SPLTokensList, total_usd: splUsd } = await fetchSPL(
      rpcUrl,
      currentAccount.publicKey,
    );
    for (const item of SPLTokensList) {
      enrichedTokens.push(item);
    }

    return { solBal, enrichedTokens, splUsd, solUsd };
  };

  // Function to update balances periodically (no loading, no reset)
  const updateBalances = async () => {
    if (!currentAccount || !wallet || !isConnected) return;

    try {
      const { enrichedTokens, solUsd, splUsd } = await fetchBalances();

      // Mecca mint setup
      const meccaMint =
        wallet.network === 'devnet'
          ? 'DUbbqANBKJqAUCJveSEFgVPGHDwkdc6d9UiQyxBLcyN3'
          : 'mecySk7eSawDNfAXvW3CquhLyxyKaXExFXgUUbEZE1T';
      const cluster = wallet.network === 'devnet' ? 'devnet' : 'mainnet-beta';
      let meccaToken = enrichedTokens.find(t => t.mint === meccaMint);
      if (!meccaToken) {
        const metadata = await fetchTokenMetadata(meccaMint, cluster);
        if (metadata) {
          meccaToken = {
            mint: meccaMint,
            amount: 0,
            decimals: metadata.decimals,
            name: metadata.name,
            symbol: metadata.symbol,
            logoURI: metadata.image_uri,
            price: metadata.price_per_token,
            usd: 0,
          };
        } else {
          meccaToken = {
            mint: meccaMint,
            amount: 0,
            decimals: 6,
            name: 'Mecca',
            symbol: 'MEA',
            logoURI:
              'https://raw.githubusercontent.com/mcret2024/tokendata/master/assets/images/mecca.png',
            price: 0,
            usd: 0,
          };
        }
      }

      // Merge with existing tokenBalances
      const updatedTokens = [...tokenBalances];
      let newTotalUsd = 0;

      // Update SOL
      const solIndex = updatedTokens.findIndex(t => t.mint === NATIVE_SOL_MINT);
      if (solIndex !== -1) {
        updatedTokens[solIndex] = {
          ...updatedTokens[solIndex],
          amount:
            enrichedTokens.find(t => t.mint === NATIVE_SOL_MINT)?.amount || 0,
          price:
            enrichedTokens.find(t => t.mint === NATIVE_SOL_MINT)?.price || 0,
          usd: enrichedTokens.find(t => t.mint === NATIVE_SOL_MINT)?.usd || 0,
        };
      } else {
        // Add SOL if missing
        const solToken = enrichedTokens.find(
          t => t.mint === NATIVE_SOL_MINT,
        ) || {
          mint: NATIVE_SOL_MINT,
          amount: 0,
          decimals: 9,
          name: 'Solana',
          symbol: 'SOL',
          logoURI: '',
          price: 0,
          usd: 0,
        };
        updatedTokens.unshift(solToken);
      }

      // Update Mecca
      const meccaIndex = updatedTokens.findIndex(t => t.mint === meccaMint);
      if (meccaIndex !== -1) {
        updatedTokens[meccaIndex] = {
          ...updatedTokens[meccaIndex],
          ...meccaToken,
          amount: enrichedTokens.find(t => t.mint === meccaMint)?.amount || 0,
          usd:
            (enrichedTokens.find(t => t.mint === meccaMint)?.amount || 0) *
            (meccaToken.price || 0),
        };
      } else {
        // Insert Mecca after SOL
        updatedTokens.splice(1, 0, meccaToken);
      }

      // Update other tokens from enriched
      for (const newToken of enrichedTokens) {
        if (newToken.mint === NATIVE_SOL_MINT || newToken.mint === meccaMint)
          continue;

        const existingIndex = updatedTokens.findIndex(
          t => t.mint === newToken.mint,
        );
        if (existingIndex !== -1) {
          // Update existing
          updatedTokens[existingIndex] = {
            ...updatedTokens[existingIndex],
            ...newToken,
          };
        } else {
          // Add new
          updatedTokens.push(newToken);
        }
      }

      // Remove tokens with 0 balance if not bookmarked (optional: adjust as needed)
      const bookmarks = wallet?.bookmarks || [];
      updatedTokens.forEach((token, index) => {
        if (
          token.amount === 0 &&
          !bookmarks.includes(token.mint) &&
          token.mint !== NATIVE_SOL_MINT &&
          token.mint !== meccaMint
        ) {
          updatedTokens.splice(index, 1);
        }
      });

      // Re-sort: SOL first, Mecca second, bookmarked, others
      const sortedTokens: TokenBalance[] = [];
      const solToken = updatedTokens.find(t => t.mint === NATIVE_SOL_MINT);
      if (solToken) sortedTokens.push(solToken);

      const meccaInSorted = updatedTokens.find(t => t.mint === meccaMint);
      if (meccaInSorted) sortedTokens.push(meccaInSorted);

      const bookmarkedTokens = updatedTokens
        .filter(
          t =>
            t.mint !== NATIVE_SOL_MINT &&
            t.mint !== meccaMint &&
            bookmarks.includes(t.mint),
        )
        .sort(
          (a, b) =>
            bookmarks.indexOf(a.mint as string) -
            bookmarks.indexOf(b.mint as string),
        );
      const otherTokens = updatedTokens.filter(
        t =>
          t.mint !== NATIVE_SOL_MINT &&
          t.mint !== meccaMint &&
          !bookmarks.includes(t.mint),
      );
      sortedTokens.push(...bookmarkedTokens, ...otherTokens);

      // Calculate totalUsd
      newTotalUsd = sortedTokens.reduce((sum, t) => sum + (t.usd || 0), 0);

      setTokenBalances(sortedTokens);
      setTotalUsd(newTotalUsd);
    } catch (error) {
      console.log('updateBalances =>', error);
    }
  };

  // Fetch account data (full refresh with loading and NFT fetch)
  const fetchAccountData = async () => {
    if (!isConnected) {
      return;
    }

    setListLoading(true);
    setTokenBalances([]);
    setCollectibles([]);
    setTotalUsd(0);

    try {
      if (!currentAccount || !wallet) {
        setListLoading(false);
        return;
      }

      // Fetch balances
      const { enrichedTokens, solUsd, splUsd } = await fetchBalances();

      // Mecca setup (same as in updateBalances)
      const meccaMint =
        wallet.network === 'devnet'
          ? 'DUbbqANBKJqAUCJveSEFgVPGHDwkdc6d9UiQyxBLcyN3'
          : 'mecySk7eSawDNfAXvW3CquhLyxyKaXExFXgUUbEZE1T';
      const cluster = wallet.network === 'devnet' ? 'devnet' : 'mainnet-beta';
      let meccaToken = enrichedTokens.find(t => t.mint === meccaMint);
      if (!meccaToken) {
        const metadata = await fetchTokenMetadata(meccaMint, cluster);
        if (metadata) {
          meccaToken = {
            mint: meccaMint,
            amount: 0,
            decimals: metadata.decimals,
            name: metadata.name,
            symbol: metadata.symbol,
            logoURI: metadata.image_uri,
            price: metadata.price_per_token,
            usd: 0,
          };
        } else {
          meccaToken = {
            mint: meccaMint,
            amount: 0,
            decimals: 6,
            name: 'Mecca',
            symbol: 'MEA',
            logoURI:
              'https://raw.githubusercontent.com/mcret2024/tokendata/master/assets/images/mecca.png',
            price: 0,
            usd: 0,
          };
        }
      }

      // Sort tokens (same logic as in updateBalances)
      const sortedTokens: TokenBalance[] = [];
      const bookmarks = wallet?.bookmarks || [];

      const solToken = enrichedTokens.find(t => t.mint === NATIVE_SOL_MINT) || {
        mint: NATIVE_SOL_MINT,
        amount: 0,
        decimals: 9,
        name: 'Solana',
        symbol: 'SOL',
        logoURI: '',
        price: 0,
        usd: 0,
      };
      sortedTokens.push(solToken);

      if (meccaToken) sortedTokens.push(meccaToken);

      const bookmarkedTokens = enrichedTokens
        .filter(
          t =>
            t.mint !== NATIVE_SOL_MINT &&
            t.mint !== meccaMint &&
            bookmarks.includes(t.mint),
        )
        .sort(
          (a, b) =>
            bookmarks.indexOf(a.mint as string) -
            bookmarks.indexOf(b.mint as string),
        );
      const otherTokens = enrichedTokens.filter(
        t =>
          t.mint !== NATIVE_SOL_MINT &&
          t.mint !== meccaMint &&
          !bookmarks.includes(t.mint),
      );
      sortedTokens.push(...bookmarkedTokens, ...otherTokens);

      setTokenBalances(sortedTokens);
      setTotalUsd(splUsd + solUsd);

      // Process collectibles (full refresh)
      const NFTList: Collectible[] = [];
      const NFTTokenList = await fetchNFT(
        getRpcUrl(wallet.network),
        currentAccount.publicKey,
      );
      for (const item of NFTTokenList) {
        NFTList.push(item);
      }
      setCollectibles(NFTTokenList);
    } catch (error) {
      console.log('fetchAccountData =>', error);
    } finally {
      setListLoading(false);
    }
  };

  // Load initial data on mount
  useEffect(() => {
    handleCurrentAccount();
  }, []);

  // Fetch data when currentAccount changes (full refresh)
  useEffect(() => {
    if (currentAccount && wallet && isConnected) {
      fetchAccountData();
    }
  }, [currentAccount?.id, wallet?.network, isConnected]);

  // Update on focus (full refresh)
  useEffect(() => {
    if (isFocused) {
      handleCurrentAccount();
      if (currentAccount && wallet && isConnected) {
        fetchAccountData();
      }
    }
  }, [isFocused]);

  // Periodic balance updates every 5 seconds when focused and connected
  useEffect(() => {
    if (isFocused && isConnected && currentAccount && wallet) {
      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Initial update
      updateBalances();

      // Set new interval
      intervalRef.current = setInterval(() => {
        updateBalances();
      }, 5000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      // Clear interval if not focused/connected
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isFocused, isConnected, currentAccount?.id, wallet?.network]);

  // Airdrop on devnet
  const handleAirdrop = async () => {
    if (!isConnected) {
      return;
    }

    setIsAirdrop(true);
    if (!currentAccount || !wallet?.network || wallet.network !== 'devnet') {
      Toast.show({
        type: 'error',
        text1: 'Airdrop only available on DEVNET',
      });
      setIsAirdrop(false);
      return;
    }

    try {
      const connection = getConnection(wallet.network);
      const publicKey = new PublicKey(currentAccount.publicKey);
      const signature = await connection.requestAirdrop(
        publicKey,
        2 * LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(signature, 'confirmed');
      Toast.show({
        type: 'success',
        text1: '2 SOL aidropped successfully',
      });
      await fetchAccountData(); // Full refresh after airdrop
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Too many requests, try after some time',
      });
    }
    setIsAirdrop(false);
  };

  const onRefresh = () => {
    if (isConnected) {
      fetchAccountData();
    } else {
      Toast.show({
        type: 'error',
        text1: 'Check your Internet connection!',
      });
    }
  };

  const handleCopyAddress = () => {
    if (currentAccount?.publicKey) {
      Clipboard.setString(currentAccount.publicKey);
      Toast.show({
        type: 'success',
        text1: 'Address copied to clipboard',
      });
    }
  };

  const handleDotsPress = () => setShowDropdown(!showDropdown);

  const handleOptionPress = (option: string) => {
    setShowDropdown(false);
    switch (option) {
      case 'Hide Balance':
        setHideBalance(!hideBalance);
        break;
      case 'Manage list':
        Alert.alert('Manage', 'Ping Pay Wallet v1.0.2');
        break;
      case 'Help':
        Alert.alert('Help', 'Contact support@meccapay.com');
        break;
    }
  };

  const renderCollectibleCard = (
    coll: Collectible,
    index: number,
    bookmarks: string[],
  ) => {
    const isBookmarked = bookmarks.includes(coll.mint);
    return (
      <TouchableOpacity
        key={index}
        onPress={() =>
          navigation.navigate('NFTDataScreen', {
            mintAddress: coll.mint,
          })
        }
        className="flex-1 bg-gray-900 rounded-lg p-2 relative"
      >
        {isBookmarked && (
          <View className="absolute top-2 right-2 z-10">
            <BookmarkIcon width={20} height={20} fill="#D1D5DB" />
          </View>
        )}
        {coll.mediaUri?.startsWith('https://ipfs.io') ? (
          <WebView
            source={{ uri: normalizeUri(coll.mediaUri) }}
            className="w-full h-40 rounded"
          />
        ) : coll.mediaType?.startsWith('image/') ||
          coll.mediaType?.includes('gif') ? (
          <Image
            source={{ uri: normalizeUri(coll.mediaUri) }}
            className="w-full h-40 rounded"
            resizeMode="cover"
          />
        ) : coll.mediaType?.startsWith('video/') ? (
          <Video
            source={{ uri: normalizeUri(coll.mediaUri) }}
            className="w-full h-40 rounded"
            useNativeControls
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-40 bg-gray-800 rounded items-center justify-center">
            <Text className=" text-white text-center ">Unsupported Media</Text>
          </View>
        )}

        <Text className=" text-white font-semibold text-sm mt-2 ">
          {coll.name}
        </Text>
        <Text className=" text-gray-400 text-xs ">
          {coll.description.length > 50
            ? coll.description.slice(0, 50) + '...'
            : coll.description}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="w-full flex-row items-center justify-between px-4 pt-4 pb-2 relative">
        <TouchableOpacity
          onPress={() => navigation.navigate('Accounts')}
          className="flex-row items-center gap-2"
        >
          <View className="w-10 h-10 rounded-full relative items-center justify-center overflow-hidden">
            {currentAccount?.imageUri ? (
              <Image
                source={{ uri: currentAccount.imageUri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Image
                source={UsernameFrame}
                className="w-full h-full absolute"
                resizeMode="contain"
              />
            )}
          </View>
          <View>
            <Text className=" text-base font-medium text-white">
              {currentAccount?.name}
            </Text>
            <TouchableOpacity
              onPress={handleCopyAddress}
              className="flex-row items-center gap-1"
            >
              <Text className=" text-medium text-gray-400">
                {currentAccount?.publicKey
                  ? `${currentAccount.publicKey.slice(
                      0,
                      6,
                    )} **** ${currentAccount.publicKey.slice(-6)}`
                  : 'No Account'}
              </Text>
              <CopyIcon width={14} height={14} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        <View className="w-24 h-12 items-center flex-row justify-end">
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ScanQr', { mintAddress: '', isNFT: false })
            }
          >
            <Scanner width={24} height={24} fill="#D1D5DB" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDotsPress} className="ml-2 relative">
            <DotsIcon width={36} height={36} fill="#D1D5DB" />
          </TouchableOpacity>
        </View>
      </View>
      {showDropdown && (
        <View
          className="bg-gray-800 rounded-lg p-2 absolute right-4 top-16 mt-2 z-[1000] shadow-lg"
          style={{ minWidth: 120 }}
        >
          <TouchableOpacity
            className="py-2 px-2 rounded"
            onPress={() => handleOptionPress('Hide Balance')}
          >
            <Text className="text-white text-sm">
              {hideBalance ? 'Show Balance' : 'Hide Balance'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="py-2 px-2 rounded"
            onPress={() => {
              setShowDropdown(false);
              navigation.navigate('Settings');
            }}
          >
            <Text className="text-white text-sm">Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="py-2 px-2 rounded"
            onPress={() => handleOptionPress('Help')}
          >
            <Text className="text-white text-sm">Help</Text>
          </TouchableOpacity>
        </View>
      )}

      {wallet?.network === 'devnet' && (
        <View>
          <Text className="text-center text-xs text-yellow-500 pb-1">
            Currently you are in "Devnet" mode
          </Text>
        </View>
      )}
      {/* FULL BALANCE CARD (Background + Actions) */}
      <View className="w-full px-4">
        <View
          className="w-full rounded-3xl overflow-hidden relative shadow-xl shadow-black/60"
          style={{ height: 170 }}
        >
          {/* Background Image Full Fill */}
          <Image
            source={BalanceFrame}
            className="w-full h-full absolute inset-0"
            resizeMode="cover"
          />

          {/* Balance Text */}
          <View className="absolute top-5 left-6">
            <Text className="text-gray-300 text-xs mx-2 font-semibold tracking-wider">
              BALANCE
            </Text>

            <Text className="text-3xl font-bold text-white mt-1">
              {hideBalance ? '****' : `$${totalUsd.toFixed(2)}`}
            </Text>
          </View>

          {/* ACTION BUTTONS ON THE IMAGE */}
          <View className="absolute bottom-1 w-full flex-row justify-evenly">
            {/* Send */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('SendRecipient', {
                  mintAddress: '',
                  isNFT: false,
                })
              }
              className="items-center active:scale-95"
            >
              <View
                className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md 
                        border border-white/10 items-center justify-center shadow-md"
              >
                <SendIcon width={20} height={20} fill="#E5E7EB" />
              </View>
              <Text className="text-white text-base font-bold">Send</Text>
            </TouchableOpacity>

            {/* Receive */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('QRCode', {
                  accountId: currentAccount?.id ?? '',
                })
              }
              className="items-center active:scale-95"
            >
              <View
                className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md 
                        border border-white/10 items-center justify-center shadow-md"
              >
                <ReceiveIcon width={20} height={20} fill="#E5E7EB" />
              </View>
              <Text className="text-white text-base font-bold">Receive</Text>
            </TouchableOpacity>

            {/* Swap */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Swap')}
              className="items-center active:scale-95"
            >
              <View
                className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md 
                        border border-white/10 items-center justify-center shadow-md"
              >
                <SwapIcon width={20} height={20} fill="#E5E7EB" />
              </View>
              <Text className="text-white text-base font-bold">Swap</Text>
            </TouchableOpacity>

            {/* Buy */}
            <TouchableOpacity
              onPress={() =>
                Linking.openURL('https://www.binance.com/en-IN/crypto/buy/')
              }
              className="items-center active:scale-95"
            >
              <View
                className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md 
                        border border-white/10 items-center justify-center shadow-md"
              >
                <BuyIcon width={20} height={20} fill="#E5E7EB" />
              </View>
              <Text className="text-white text-base font-bold">Buy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Mecca Store Info */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          Linking.openURL('https://pingpay.info/');
        }}
        className="px-4 mt-2"
      >
        {/* Mecca Store Info */}
        <View className="flex-row items-center rounded-tl-3xl rounded-br-3xl bg-gray-900 p-2">
          <View className=" rounded-xl p-1.5 mr-3">
            <Image
              source={require('../../assets/images/ping-pay-icon.png')}
              className="w-10 h-10"
              resizeMode="contain"
            />
          </View>

          <View className="flex-1">
            <Text className="text-sm font-bold text-white">
              Shop Smart. Earn Big with Ping Pay!
            </Text>
            <Text className="text-xs text-gray-400">
              Pay at your favorite stores using Ping Pay and get exclusive Mea
              Rewards
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Tabs */}
      <View className="flex-row mt-2 px-4">
        <TouchableOpacity
          className={`flex-1 p-3 border-b-2 ${
            activeTab === 'tokens' ? 'border-primary' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('tokens')}
        >
          <Text className="text-xs font-medium text-white text-center">
            Tokens
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 p-3 border-b-2 ${
            activeTab === 'collectibles'
              ? 'border-primary'
              : 'border-transparent'
          }`}
          onPress={() => setActiveTab('collectibles')}
        >
          <Text className=" text-xs font-medium text-white text-center">
            Collectibles
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tokens/Collectibles List */}
      <ScrollView
        className="flex-1 px-4 mt-4"
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'tokens' && (
          <View className="flex-1">
            {listLoading ? (
              <View className="flex-1 items-center justify-center py-8">
                <ActivityIndicator size="large" color="#9707B5" />
                <Text className=" text-gray-400 text-center font-medium mt-2">
                  Loading...
                </Text>
              </View>
            ) : (
              <>
                {tokenBalances.length === 0 && (
                  <View className="flex-1 items-center justify-center py-8">
                    <Image
                      source={SolImage}
                      style={{ width: 60, height: 60 }}
                    />
                    <Text className=" text-gray-400 text-center font-medium mt-2">
                      No tokens found
                    </Text>
                    {wallet?.network === 'devnet' ? (
                      <TouchableOpacity
                        disabled={isAirdrop}
                        className="bg-gradient-to-br from-purple-600 to-[#9707B5] rounded-lg px-6 py-3 mt-4"
                        onPress={handleAirdrop}
                      >
                        <Text
                          className="text-white font-medium bg-[#9707B5] p-2 text-base"
                          style={{ borderRadius: 15 }}
                        >
                          {isAirdrop ? 'Loading...' : 'Airdrop SOL'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity className="bg-gradient-to-br from-purple-600 to-[#9707B5] rounded-lg px-6 py-3 mt-4">
                        <Text
                          className="text-white font-medium bg-[#9707B5] p-2 text-base"
                          style={{ borderRadius: 15 }}
                        >
                          Buy SOL
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {tokenBalances.map((token, idx) => {
                  const bookmarks = wallet?.bookmarks || [];
                  const isBookmarked = bookmarks.includes(token.mint);
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() =>
                        navigation.navigate('TokenData', {
                          mintAddress: token.mint,
                        })
                      }
                      className="py-3 rounded-lg mb-2 bg-gray-800/50"
                    >
                      <View className="flex-row justify-between items-center px-2">
                        <View className="flex-row items-center gap-3">
                          {/* Token Image */}
                          <Image
                            source={
                              token.logoURI
                                ? token.mint === NATIVE_SOL_MINT
                                  ? SolanaImage
                                  : { uri: token.logoURI }
                                : token.mint === NATIVE_SOL_MINT
                                ? SolanaImage
                                : SolImage
                            }
                            style={{ width: 40, height: 40, borderRadius: 100 }}
                            defaultSource={SolImage}
                          />

                          {/* Token Info */}
                          <View className="flex-col justify-center">
                            {/* Name + Bookmark */}
                            <View className="flex-row items-center gap-2">
                              <Text className=" text-white font-medium text-sm">
                                {token.name}
                              </Text>
                              {isBookmarked && (
                                <BookmarkIcon
                                  width={12}
                                  height={12}
                                  fill="#D1D5DB"
                                />
                              )}
                            </View>

                            {/* Balance + Symbol */}
                            <Text className=" text-gray-400 text-xs mt-1">
                              {hideBalance
                                ? '****'
                                : `${token.amount.toFixed(4)}`}{' '}
                              {token.symbol}
                            </Text>
                          </View>
                        </View>

                        <View className="items-end">
                          {token.usd !== undefined &&
                            token.price !== undefined && (
                              <>
                                <Text className=" text-white font-normal">
                                  {hideBalance
                                    ? '****'
                                    : `$${
                                        token.usd === 0
                                          ? 0
                                          : (token.usd || 0).toFixed(4)
                                      }`}
                                </Text>
                                <Text className=" text-gray-400 text-xs">
                                  $
                                  {token.price === 0
                                    ? 0
                                    : (token.price || 0).toFixed(4)}
                                </Text>
                              </>
                            )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        )}
        {activeTab === 'collectibles' && (
          <View className="flex-1">
            {listLoading ? (
              <View className="flex-1 items-center justify-center py-8">
                <ActivityIndicator size="large" color="#9707B5" />
                <Text className=" text-gray-400 text-center font-medium mt-2">
                  Loading...
                </Text>
              </View>
            ) : (
              <>
                {collectibles.length === 0 ? (
                  <View className="flex-1 items-center justify-center py-8">
                    <Text className=" text-gray-400 text-center">
                      No collectibles found
                    </Text>
                  </View>
                ) : (
                  <>
                    {(() => {
                      const bookmarks = wallet?.bookmarks || [];
                      return Array.from({
                        length: Math.ceil(collectibles.length / 2),
                      }).map((_, rowIndex) => {
                        const startIndex = rowIndex * 2;
                        const firstItem = collectibles[startIndex];
                        const secondItem = collectibles[startIndex + 1];
                        return (
                          <View key={rowIndex} className="flex-row gap-4 mb-4">
                            {firstItem &&
                              renderCollectibleCard(
                                firstItem,
                                startIndex,
                                bookmarks,
                              )}
                            {secondItem &&
                              renderCollectibleCard(
                                secondItem,
                                startIndex + 1,
                                bookmarks,
                              )}
                          </View>
                        );
                      });
                    })()}
                  </>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <BottomNavBar active="Home" />
    </View>
  );
}
