import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { RootStackParamList } from '../../types/navigation';

import { loadWallet } from '../../utils/storage';

import BackIcon from '../../assets/icons/back-arrow.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import ShieldIcon from '../../assets/icons/shield-1.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivateKeyShow'>;

const PrivateKeyShowScreen = ({ route, navigation }: Props) => {
  const { accountId } = route.params;
  const [privateKey, setPrivateKey] = useState<string>('');

  useEffect(() => {
    const loadAccount = async () => {
      const wallet = await loadWallet();
      if (wallet) {
        const acc = wallet.accounts.find(a => a.id === accountId);
        setPrivateKey(acc?.secretKey || '');
      }
    };

    loadAccount();
  }, []);

  const handleCopyToClipboard = async () => {
    try {
      if (privateKey.trim()) {
        await Clipboard.setString(privateKey);
        Toast.show({
          type: 'success',
          text1: 'Private key copied to clipboard',
        });
      }
    } catch (err) {
      console.log('Failed to copy:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to copy to clipboard',
      });
    }
  };

  return (
    <View className="flex-1 bg-black px-4 ">
      {/* Back Arrow and Title */}
      <View className="pb-3 mb-4 pt-6">
        <TouchableOpacity
          onPress={() => navigation.navigate('EditAccount', { accountId })}
          className="flex flex-row items-center gap-4"
        >
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">Your Private Key</Text>
        </TouchableOpacity>
      </View>

      {/* Warning Section */}
      <View className="w-full bg-orange2 rounded-[20px] px-6 py-5 flex flex-col items-center justify-center mb-5">
        <ShieldIcon />
        <Text className="text-base mt-2 mb-2 Medium text-red-500 text-center">
          Do not share your private key
        </Text>
      </View>

      {/* Private Key Input */}
      <View className="w-full min-h-[152px] flex flex-col border border-slate-500 rounded-[16px] overflow-hidden">
        <Text className="text-white text-center text-base Medium min-h-[104px] w-full px-3 py-5">
          {privateKey}
        </Text>
        <TouchableOpacity
          onPress={handleCopyToClipboard}
          className="flex flex-row items-center justify-center py-4 gap-2 w-full active:bg-red-900"
        >
          <CopyIcon width={18} height={18} />
          <Text className="text-xs Medium text-slate-500">
            Copy to Clipboard
          </Text>
        </TouchableOpacity>
      </View>

      {/* Done Button */}
      <View className="w-full mb-2 mt-auto pt-4">
        <TouchableOpacity
          onPress={() =>
            navigation.replace('EditAccount', { accountId: accountId })
          }
          className="py-4 px-6 w-full text-white1 rounded-full flex items-center justify-center bg-[#9707B5]"
        >
          <Text className="text-large text-center  text-white font-bold">
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PrivateKeyShowScreen;
