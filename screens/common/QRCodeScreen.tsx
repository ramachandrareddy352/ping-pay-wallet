import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Share from 'react-native-share';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import Clipboard from '@react-native-clipboard/clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { RootStackParamList } from '../../types/navigation';

import { loadWallet, WalletAccount } from '../../utils/storage';

import BackIcon from '../../assets/icons/back-arrow.svg';
import CopyIcon from '../../assets/icons/copy-white.svg';
import ShareIcon from '../../assets/icons/share-icon.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'QRCode'>;

const QRCodeScreen = ({ route, navigation }: Props) => {
  const { accountId } = route.params;

  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Correctly type the ref
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    const loadAccount = async () => {
      try {
        setLoading(true);
        const wallet = await loadWallet();
        if (wallet) {
          const acc = wallet.accounts.find(a => a.id === accountId);
          setAccount(acc || null);
        }
      } catch (error) {
        console.log('Error loading account:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to load account data',
        });
      } finally {
        setLoading(false);
      }
    };

    loadAccount();
  }, [accountId]);

  const handleCopy = () => {
    if (account?.publicKey) {
      Clipboard.setString(account.publicKey);
      Toast.show({
        type: 'success',
        text1: 'Address copied to clipboard',
      });
    }
  };

  const handleShare = async () => {
    if (!account?.publicKey || !viewShotRef.current) {
      Toast.show({
        type: 'error',
        text1: 'No address available to share',
      });
      return;
    }

    try {
      // ✅ Await capture
      const uri = await viewShotRef.current.capture?.();
      if (uri) {
        await Share.open({
          url: uri,
          title: `QR Code for ${account?.name || 'Account'}`,
          message: `Account Name: ${
            account?.name || 'account'
          }\nAccount address: ${account.publicKey}`,
        });
      }
    } catch (error) {
      console.log('Error sharing screenshot:', error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      <View className="flex-1 bg-black px-4">
        {/* Back Arrow and Title */}
        <View className="pb-3 mb-4 py-6">
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            className="flex flex-row items-center gap-4"
          >
            <BackIcon width={16} height={16} />
            <Text className="text-base  font-medium text-white">
              Your account address
            </Text>
          </TouchableOpacity>
        </View>

        {/* QR Code Section */}
        <View className="flex-1 items-center justify-center">
          <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 1.0 }}>
            <View className="bg-gray2 rounded-xl p-4 max-w-[300px] w-full ">
              <View className="bg-white rounded-xl p-5 items-center justify-center">
                {loading ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : account?.publicKey ? (
                  <QRCode
                    value={`solana:${account.publicKey}`}
                    size={240}
                    color="black"
                    backgroundColor="white"
                  />
                ) : (
                  <Image
                    style={{ width: '100%', height: 160, borderRadius: 6 }}
                    source={require('../../assets/images/qr-code.png')}
                    className="w-full h-full rounded"
                    resizeMode="contain"
                  />
                )}
              </View>
              <View className="w-full py-3 px-2 mt-4">
                <Text className="text-base text-white text-center Medium mb-1">
                  {account?.name || 'Solana Account'}
                </Text>
                <Text className="text-medium text-center text-gray-400 Medium">
                  {account?.publicKey ? account.publicKey : 'NOTHING'}
                </Text>
              </View>
            </View>
          </ViewShot>
        </View>

        {/* Instruction Text */}
        <View className="w-full mt-6 items-center justify-center">
          <View className="max-w-[300px] mx-auto items-center justify-center">
            <Text className="text-base text-gray Medium text-center mb-3">
              Your Solana Account Address
            </Text>
            <Text className="text-white text-xs Medium text-center mb-6">
              Use this address to receive tokens and collectibles on{' '}
              <Text className="text-white1 font-base">Solana Network.</Text>
            </Text>
          </View>

          {/* Buttons */}
          <View className="flex-row gap-4 mb-2">
            {/* Copy Button */}
            <TouchableOpacity
              onPress={handleCopy}
              className="flex-1 flex-row bg-gray-700 rounded-full justify-center items-center"
            >
              <CopyIcon width={20} height={20} />
              <View className="w-2" />
              <Text className=" text-base  text-white text-center">Copy</Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity
              onPress={handleShare}
              className="flex-1 flex-row bg-[#9707B5] rounded-full justify-center items-center  py-3"
            >
              <ShareIcon width={20} height={20} />
              <View className="w-2" />
              <Text className="text-base  text-white text-center">Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default QRCodeScreen;
