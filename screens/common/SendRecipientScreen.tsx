import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  ActivityIndicator,
  Image,
  ImageBackground,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import Clipboard from '@react-native-clipboard/clipboard';
import { loadAddressBook } from '../../utils/storage';
import { validateSolanaAddress } from '../../utils/helper';
import BackArrowIcon from '../../assets/icons/back-arrow.svg';
import CloseIcon from '../../assets/icons/close-icon.svg';
import QRIcon from '../../assets/icons/ic-qr.svg';
import WalletIcon from '../../assets/icons/wallet-icon.svg';
import { RootStackParamList } from '../../types/navigation';
import { AddressEntry } from '../../types/dataTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'SendRecipient'>;

const BASE_IMAGE_URL =
  'https://meapay-merchant.s3.ap-northeast-2.amazonaws.com';

const SendRecipientScreen = ({ navigation, route }: Props) => {
  const { mintAddress, isNFT } = route.params;
  const [value, setValue] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [addresses, setAddresses] = useState<AddressEntry[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [isMerchant, setIsMerchant] = useState(false);
  const [checkingMerchant, setCheckingMerchant] = useState(false);
  const [merchantDetails, setMerchantDetails] = useState<any>(null);

  // Load address book
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingAddresses(true);
        const savedAddresses = await loadAddressBook();
        setAddresses(savedAddresses || []);
      } catch (error) {
        console.log('Error loading address book:', error);
        Toast.show({ type: 'error', text1: 'Failed to load address book' });
      } finally {
        setLoadingAddresses(false);
      }
    };
    loadData();
  }, []);

  // Reusable merchant check
  const checkMerchant = async (address: string) => {
    try {
      setCheckingMerchant(true);
      setIsMerchant(false);
      setMerchantDetails(null);

      const url = `https://api-platform.pingpay.info/public/payment/merchant/${address}`;
      const response = await fetch(url);
      const text = await response.text();

      try {
        const json = JSON.parse(text);
        if (json.success === true && json.body) {
          setIsMerchant(true);
          setMerchantDetails(json.body);
        }
      } catch {
        // Not JSON → not a merchant
      }
    } catch (error) {
      console.log('Merchant check error:', error);
    } finally {
      setCheckingMerchant(false);
    }
  };

  const handleInputChange = async (text: string) => {
    setValue(text.trim());
    const valid = validateSolanaAddress(text);
    setIsValidAddress(valid);

    if (valid) {
      checkMerchant(text.trim());
    } else {
      setIsMerchant(false);
      setMerchantDetails(null);
    }
  };

  const handleQRScan = () => {
    navigation.navigate('ScanQr', { mintAddress, isNFT });
  };

  const goToNextScreen = () => {
    if (!isValidAddress || !value) {
      Toast.show({
        type: 'error',
        text1: 'Please enter a valid Solana address.',
      });
      return;
    }

    if (isMerchant && merchantDetails) {
      navigation.navigate('MerchantPayment', {
        merchantAddress: value,
        merchantDetails,
      });
    } else {
      if (isNFT) {
        navigation.navigate('ConfirmNFTSend', {
          toAddress: value,
          NFTMint: mintAddress,
        });
      } else {
        navigation.navigate('SendInputAmount', {
          recipient: value,
          mintAddress,
        });
      }
    }
  };

  const handleAddressSelect = (address: string) => {
    setValue(address);
    setIsValidAddress(true);
    checkMerchant(address);
  };

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) handleInputChange(text);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to paste from clipboard.' });
    }
  };

  const renderAddress = ({ item }: { item: AddressEntry }) => (
    <TouchableOpacity
      onPress={() => handleAddressSelect(item.address)}
      className="flex flex-row items-center gap-5 mb-4"
    >
      <View className="bg-gray7 w-12 h-12 items-center justify-center rounded-full">
        <WalletIcon width={20} height={18} />
      </View>
      <View>
        <Text className="text-white font-medium text-lg">{item.name}</Text>
        <Text className="text-gray-400 font-medium text-sm">
          {item.address.slice(0, 5)}...{item.address.slice(-5)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const shopIconUrl = merchantDetails?.businessImage
    ? `${BASE_IMAGE_URL}/${merchantDetails.businessImage}`
    : '';
  const backgroundUrl = merchantDetails?.banner
    ? `${BASE_IMAGE_URL}/${merchantDetails.banner}`
    : '';

  return (
    <View className="flex-1 bg-black px-4 py-6">
      {/* Header */}
      <View className="flex flex-row items-center justify-between pb-3">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => navigation.navigate('Home')}
            className="w-6 items-center justify-center mr-3"
          >
            <BackArrowIcon width={16} height={16} />
          </Pressable>
          <Text className="text-white font-medium text-base">
            Select Recipient
          </Text>
        </View>
        <Pressable onPress={handleQRScan}>
          <QRIcon width={24} height={24} />
        </Pressable>
      </View>

      {/* Input */}
      <View className="mt-6">
        <View className="flex flex-row items-center gap-5">
          <View className="relative flex-1">
            <TextInput
              value={value}
              onChangeText={handleInputChange}
              placeholder="Select or paste address"
              placeholderTextColor="#777E90"
              className="text-white bg-black rounded-xl border border-white px-3 h-12"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {value === '' && (
              <TouchableOpacity
                onPress={handlePaste}
                className="absolute right-3 top-3 bg-black3 h-[26px] w-[53px] rounded-full items-center justify-center"
              >
                <Text className="text-white text-xs font-semibold">Paste</Text>
              </TouchableOpacity>
            )}
            {value !== '' && (
              <TouchableOpacity
                onPress={() => {
                  setValue('');
                  setIsValidAddress(false);
                  setIsMerchant(false);
                  setMerchantDetails(null);
                }}
                className="absolute right-3 top-3"
              >
                <CloseIcon width={18} height={18} fill="#777E90" />
              </TouchableOpacity>
            )}
          </View>
          {value !== '' && (
            <TouchableOpacity
              onPress={() => {
                setValue('');
                setIsValidAddress(false);
                setIsMerchant(false);
                setMerchantDetails(null);
              }}
            >
              <Text className="text-white font-semibold">Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Warning */}
        <View className="mt-4 p-3 bg-gray-800 rounded-lg">
          <Text className="text-yellow-400 text-xs font-medium">
            Warning: Verify address carefully to avoid loss of funds.
          </Text>
        </View>

        {/* Search Result */}
        {isValidAddress && value && (
          <View className="mt-5">
            <Text className="text-white font-semibold text-xs uppercase">
              SEARCH RESULT
            </Text>
            {checkingMerchant ? (
              <ActivityIndicator color="#00FF00" className="mt-5" />
            ) : (
              <TouchableOpacity onPress={goToNextScreen} className="mt-5">
                {isMerchant && merchantDetails ? (
                  <View>
                    <ImageBackground
                      source={{ uri: backgroundUrl || undefined }}
                      className="h-32 rounded-xl overflow-hidden"
                      imageStyle={{ borderRadius: 12 }}
                    >
                      <View className="flex-1 justify-end p-3 bg-black/50">
                        <View className="flex-row items-center">
                          {shopIconUrl ? (
                            <Image
                              source={{ uri: shopIconUrl }}
                              className="w-10 h-10 rounded-xl mr-2"
                            />
                          ) : (
                            <View className="w-10 h-10 bg-gray-600 rounded-xl mr-2" />
                          )}
                          <Text className="text-white text-base font-bold flex-1">
                            {merchantDetails.businessName}
                          </Text>
                          <Text className="text-green-400 text-lg">
                            Verified
                          </Text>
                        </View>
                      </View>
                    </ImageBackground>
                    <View className="py-3 items-center">
                      <Text className="text-gray-400 text-sm">
                        {value.slice(0, 6)}...{value.slice(-4)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-5">
                    <View className="bg-gray7 w-12 h-12 rounded-full items-center justify-center">
                      <WalletIcon width={20} height={18} />
                    </View>
                    <Text className="text-white text-lg font-medium">
                      {value.slice(0, 6)}...{value.slice(-4)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Address Book */}
        {value === '' && (
          <View className="mt-5">
            <Text className="text-white font-semibold text-xs uppercase">
              ADDRESS BOOK
            </Text>
            {loadingAddresses ? (
              <ActivityIndicator color="#FFFFFF" className="mt-5" />
            ) : (
              <FlatList
                data={addresses}
                renderItem={renderAddress}
                keyExtractor={item => item.address}
                className="mt-5"
                ListEmptyComponent={
                  <Text className="text-gray-400 text-center mt-5">
                    No saved addresses
                  </Text>
                }
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export default SendRecipientScreen;
