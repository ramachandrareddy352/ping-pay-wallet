import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  Image,
  ScrollView,
  ImageSourcePropType,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import { loadWallet, WalletAccount } from '../../utils/storage';
import { fetchSolPrice, getRpcUrl } from '../../utils/common';
import { formatBalance, isValidAmount } from '../../utils/helper';

import BackArrowIcon from '../../assets/icons/back-arrow.svg';
import CloseIcon from '../../assets/icons/close-icon.svg';
import SearchIcon from '../../assets/icons/search.svg';
import WalletIcon from '../../assets/icons/wallet-icon.svg';

import { RootStackParamList } from '../../types/navigation';
import { Token } from '../../types/dataTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'SendInputAmount'>;

const solImageSource: ImageSourcePropType = require('../../assets/images/sol-img.png');
const solPngSource: ImageSourcePropType = require('../../assets/images/solana-icon.png');

const SendInputAmountScreen = ({ navigation, route }: Props) => {
  const { recipient, mintAddress, label, reference, message, memo } =
    route.params;

  const [walletData, setWalletData] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(
    null,
  );
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [togglePopup, setTogglePopup] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [usdPrice, setUsdPrice] = useState('-');
  const [network, setNetwork] = useState<'devnet' | 'mainnet-beta'>('devnet');
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);
  const [ownedTokens, setOwnedTokens] = useState<Token[]>([]);

  const loadWalletData = async () => {
    try {
      const wallet = await loadWallet();
      setWalletData(wallet);
      if (wallet?.currentAccountId) {
        const acc = wallet.accounts.find(a => a.id === wallet.currentAccountId);
        setCurrentAccount(acc || null);
        setNetwork(wallet.network);
      }
    } catch (error) {
      console.log('Error loading wallet:', error);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  useEffect(() => {
    const loadTokens = async () => {
      if (currentAccount) {
        setOwnedTokens([]);
        setFilteredTokens([]);
        try {
          const tokens = await fetchSPL(
            getRpcUrl(walletData.network),
            currentAccount.publicKey,
          );
          setOwnedTokens(tokens);
          setFilteredTokens(tokens);
        } catch (error) {
          console.log('Error fetching SPL tokens:', error);
          Toast.show({
            type: 'error',
            text1: 'Failed to load tokens. Please check your connection.',
          });
        }
      }
    };

    loadTokens();
  }, [currentAccount, network]);

  useEffect(() => {
    if (mintAddress === '') {
      const solToken = ownedTokens.find(t => t.mint === '');
      setSelectedToken(solToken || null);
    } else {
      const token = ownedTokens.find(t => t.mint === mintAddress);
      setSelectedToken(token || null);
    }
  }, [mintAddress, ownedTokens]);

  useEffect(() => {
    const fetchPrice = async () => {
      if (!selectedToken) {
        setUsdPrice('-');
        return;
      }
      const price =
        selectedToken.price > 0
          ? selectedToken.price
          : selectedToken.mint === ''
          ? await fetchSolPrice(network)
          : 0;
      setUsdPrice(price > 0 ? `$${price.toFixed(2)}` : '-');
    };

    fetchPrice();
  }, [selectedToken, network]);

  // Filter tokens based on search query (token name or mint address)
  useEffect(() => {
    if (!query.trim()) {
      setFilteredTokens(ownedTokens);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = ownedTokens.filter(
      t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.mint.toLowerCase().includes(lowerQuery),
    );

    setFilteredTokens(results);
  }, [query, ownedTokens]);

  const fetchSPL = async (rpcUrl: string, ownerAddress: string) => {
    let allItems: any[] = [];
    let tempSPL: Token[] = [];
    let page = 1;
    let nativeBalance: number = 0;

    while (true) {
      try {
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
              sortBy: {
                sortBy: 'created',
                sortDirection: 'desc',
              },
              options: {
                showFungible: true,
                showZeroBalance: false,
                showNativeBalance: true,
              },
            },
          }),
        });

        if (!response.ok) {
          console.log(`RPC Error: ${response.status} ${response.statusText}`);
          break;
        }

        const { result } = await response.json();
        if (page === 1) {
          nativeBalance = result.nativeBalance?.lamports || 0;
        }
        if (!result?.items || result.items.length === 0) {
          break;
        }

        allItems = allItems.concat(result.items);
        if (result.items.length < 100) {
          break;
        }
        page++;
      } catch (error) {
        console.log('Fetch error in getAssetsByOwner:', error);
        break;
      }
    }

    for (const item of allItems) {
      const decimals = item.token_info?.decimals ?? 0;
      const user_balance = item.token_info?.balance
        ? item.token_info.balance / Math.pow(10, decimals)
        : 0;
      if (decimals === 0 || user_balance <= 0) {
        continue;
      }
      const price = item.token_info?.price_info?.price_per_token || 0;
      tempSPL.push({
        mint: item.id,
        balance: user_balance,
        decimals: decimals,
        symbol: item.content?.metadata.symbol || 'UKN',
        name:
          item.content?.metadata?.name ||
          `Unknown [${item.id.slice(0, 4)}...${item.id.slice(-4)}]`,
        image:
          item.content?.links?.image ||
          (item.content?.files?.length > 0 ? item.content.files[0].uri : '') ||
          solImageSource,
        price: price,
      });
    }

    // Add native SOL token if balance > 0
    const solBalance = nativeBalance / LAMPORTS_PER_SOL;
    if (solBalance > 0) {
      const solPrice = await fetchSolPrice(network);
      tempSPL.unshift({
        name: 'Solana',
        balance: solBalance,
        image: solPngSource,
        mint: '',
        symbol: 'SOL',
        decimals: 9,
        price: solPrice,
      });
    }

    return tempSPL;
  };

  const handleTokenSelect = (token: Token) => () => {
    setSelectedToken(token);
    setSearch('');
    setQuery('');
    setTogglePopup(false);
  };

  const handleMax = () => {
    if (selectedToken) {
      setAmount(selectedToken.balance.toString());
    }
  };

  const handleContinue = () => {
    if (!isValidAmount(amount)) {
      Toast.show({
        type: 'error',
        text1: 'Please enter a valid number greater than 0.',
      });
      return;
    }
    if (!currentAccount || !walletData) {
      Toast.show({
        type: 'error',
        text1: 'Wallet not loaded.',
      });
      return;
    }

    navigation.navigate('ConfirmSend', {
      fromAddress: currentAccount.publicKey,
      toAddress: recipient,
      amount: parseFloat(amount),
      tokenSymbol: selectedToken?.symbol || 'SOL',
      tokenMint: selectedToken?.mint || '',
      network: walletData.network,
      label,
      reference,
      message,
      memo,
    });
  };

  return (
    <View className="flex-1 bg-black px-4">
      {/* Back Arrow and Title */}
      <View className="pb-3 py-6">
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('SendRecipient', { mintAddress, isNFT: false })
          }
          className="flex flex-row items-center gap-4"
        >
          <BackArrowIcon width={16} height={16} />
          <Text className="text-white text-base  font-medium">Send Amount</Text>
        </TouchableOpacity>
      </View>

      {/* Recipient Display */}
      <View className="flex-1">
        <View className="w-full flex-1">
          <View className="flex flex-row items-center gap-5 mb-6">
            <View className="bg-gray-700 w-9 h-9 items-center justify-center rounded-full">
              <WalletIcon width={16} height={16} />
            </View>
            <Text className="text-white font-medium text-base">
              {recipient.slice(0, 4)} **** {recipient.slice(-4)}
            </Text>
          </View>

          {/* Token Selector */}
          <View className="relative items-center border border-white rounded-[20px] justify-center mb-4">
            <TouchableOpacity
              onPress={() => setTogglePopup(true)}
              className="flex-row items-center justify-between w-full px-4"
            >
              <TextInput
                value={selectedToken ? selectedToken.name : search}
                onFocus={() => setTogglePopup(true)}
                placeholder="Search & Select token"
                placeholderTextColor="#6B7280"
                className="flex-1 text-white font-normal text-base pr-2"
                editable={false}
              />
              <SearchIcon width={18} height={18} />
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <View className="pt-8 items-center">
            <View className="w-full max-w-[90%]">
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                className="text-white font-semibold text-[48px] text-center py-2"
                style={{
                  color: '#FFFFFF',
                  minHeight: 60,
                  width: '100%',
                }}
                maxLength={20}
                autoFocus
              />
            </View>
            {usdPrice !== '-' && isValidAmount(amount) && (
              <Text className="text-gray-400 mt-2 font-semibold text-xs">
                $
                {(
                  parseFloat(amount) * parseFloat(usdPrice.replace('$', ''))
                ).toFixed(2)}
              </Text>
            )}
            <Text className="text-xs font-medium text-center text-white mt-4">
              You need {'>='} 0.00008 SOL for network fees
            </Text>
          </View>
        </View>

        {/* Available Balance */}
        <View className="py-3 flex-row items-center justify-between">
          <Text className="text-white text-medium Medium">
            Available Balance:
          </Text>
          <View className="flex items-center justify-center flex-row gap-2">
            <Pressable
              onPress={() => setTogglePopup(true)}
              className="flex-row items-center justify-center gap-2 border border-gray-800 rounded-full  pb-2 pr-2 max-w-[180]"
            >
              <Image
                source={
                  typeof selectedToken?.image === 'string'
                    ? { uri: selectedToken.image }
                    : selectedToken?.image || solImageSource
                }
                className="w-5 h-5 rounded-full"
              />
              <Text
                className="text-xs SemiBold text-white"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {selectedToken?.balance
                  ? formatBalance(selectedToken.balance)
                  : '0'}{' '}
                {selectedToken?.symbol}
              </Text>
            </Pressable>

            <TouchableOpacity
              className="py-3 px-4 rounded-full bg-gray-800"
              onPress={handleMax}
            >
              <Text className="text-white SemiBold text-xs text-center">
                Max
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        onPress={handleContinue}
        disabled={
          !isValidAmount(amount) ||
          (selectedToken && parseFloat(amount) > selectedToken.balance) ||
          (!selectedToken &&
            parseFloat(amount) * LAMPORTS_PER_SOL >
              (ownedTokens.find(t => !t.mint)?.balance || 0) * LAMPORTS_PER_SOL)
        }
        className={`py-3 px-6 mb-2 w-full rounded-full flex items-center justify-center ${
          !isValidAmount(amount) ||
          (selectedToken && parseFloat(amount) > selectedToken.balance) ||
          (!selectedToken &&
            parseFloat(amount) * LAMPORTS_PER_SOL >
              (ownedTokens.find(t => !t.mint)?.balance || 0) * LAMPORTS_PER_SOL)
            ? 'bg-gray-600'
            : 'bg-[#9707B5]'
        }`}
      >
        <Text
          className={`text-xl text-center font-semibold  ${
            !isValidAmount(amount) ||
            (selectedToken && parseFloat(amount) > selectedToken.balance) ||
            (!selectedToken &&
              parseFloat(amount) * LAMPORTS_PER_SOL >
                (ownedTokens.find(t => !t.mint)?.balance || 0) *
                  LAMPORTS_PER_SOL)
              ? 'text-gray-400'
              : 'text-white'
          }`}
        >
          Continue
        </Text>
      </TouchableOpacity>

      {/* Token Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={togglePopup}
        onRequestClose={() => setTogglePopup(false)}
      >
        <View className="flex-1 justify-end">
          <View className="bg-gray-900 h-[80%] rounded-t-2xl mx-3 px-3 pt-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View />
              <Text className="text-base text-center text-white SemiBold">
                Select token
              </Text>
              <TouchableOpacity
                onPress={() => setTogglePopup(false)}
                className="mr-3"
              >
                <CloseIcon width={16} height={16} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View className="relative items-center justify-center mb-4">
              <TextInput
                placeholder="Search token or mint address"
                placeholderTextColor="#6B7280"
                className="border border-gray-800 pr-12 rounded-[40px] h-10 w-full pl-4 text-white font-normal text-xs"
                style={{ color: '#FFFFFF' }}
                value={query}
                onChangeText={setQuery}
                keyboardType="default"
              />
              <TouchableOpacity
                className="absolute right-4 w-6 h-6 items-center justify-center"
                onPress={() => setSearch(query)}
              >
                <SearchIcon width={12} height={12} />
              </TouchableOpacity>
            </View>

            {/* Token List */}
            <ScrollView className="flex-1 w-full">
              <View className="w-full gap-2 mb-4">
                {filteredTokens.length > 0 ? (
                  filteredTokens.map((token, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.8}
                      className={`flex-row items-center gap-3 px-3 pb-3 bg-slate-800 rounded-lg ${
                        selectedToken?.name === token.name
                          ? 'border border-white'
                          : ''
                      }`}
                      onPress={handleTokenSelect(token)}
                    >
                      <Image
                        source={
                          typeof token.image === 'string'
                            ? { uri: token.image }
                            : token.image || solImageSource
                        }
                        className="w-10 h-10 rounded-full"
                      />
                      <View className="flex-1">
                        <Text className="text-white text-sm Medium">
                          {token.name}
                        </Text>
                        <Text className="text-gray-300 text-xs Regular">
                          {formatBalance(token.balance)} {token.symbol}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text className="text-gray-400 text-center mt-4">
                    No tokens found
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SendInputAmountScreen;
