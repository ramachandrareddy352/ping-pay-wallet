import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { savePassword } from '../../utils/auth';
import { addDerivedAccount, loadMnemonic } from '../../utils/wallet';
import { saveWallet, WalletAccount } from '../../utils/storage';

import EyeShowIcon from '../../assets/icons/Eye-Show-icon.svg';
import HideCodeIcon from '../../assets/icons/Hidecode-icon.svg';
import BackspaceIcon from '../../assets/icons/backspace-icon.svg';

import { RootStackParamList } from '../../types/navigation';
import { useWallet } from '../../src/provider/Wallet';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmPasscode'>;

export default function ConfirmPasscodeScreen({ route, navigation }: Props) {
  const { password } = route.params;
  const [code, setCode] = useState<string[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [ready, setReady] = useState(false);
  const wallet = useWallet();

  const handlePress = async (num: string) => {
    if (code.length < 6) {
      const newCode = [...code, num];
      setCode(newCode);

      if (newCode.length === 6) {
        if (newCode.join('') === password) {
          setReady(true);
          await savePassword(newCode.join(''));

          const mnemonic = await loadMnemonic();
          if (!mnemonic) return;

          const first = await addDerivedAccount(mnemonic, 0);

          const firstWallet: WalletAccount = {
            id: first.publicKey,
            name: 'Account 1',
            publicKey: first.publicKey,
            secretKey: first.secretKey,
            type: 'derived',
            index: 0,
          };

          const data = {
            accounts: [firstWallet],
            currentAccountId: firstWallet.id,
            network: 'mainnet-beta' as 'mainnet-beta',
            nextDerivedIndex: 1,
          };

          await saveWallet(data);
          await wallet.reload();
          setReady(false);
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Passcodes do not match!',
          });
          setCode([]);
        }
      }
    }
  };

  const handleBackspace = () => setCode(prev => prev.slice(0, -1));
  const toggleShowCode = () => setShowCode(prev => !prev);

  if (ready)
    return (
      <SafeAreaView className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#9707B5" />
        <Text className="text-white mt-4 ">Loading, Please wait...</Text>
      </SafeAreaView>
    );

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <SafeAreaView className="flex-1 bg-black items-center justify-between py-6 px-6">
      {/* Title */}
      <Text className="text-white text-xl Bold mb-8">Confirm New Passcode</Text>

      {/* Passcode indicators */}
      <View className="flex-row items-center justify-center mb-10">
        {Array.from({ length: 6 }).map((_, i) => {
          const digit = code[i];
          return (
            <View key={i} className="mx-2 w-5 h-5 items-center justify-center">
              {digit ? (
                showCode ? (
                  <Text className="text-white text-3xl font-semibold -mt-2">
                    {digit}
                  </Text>
                ) : (
                  <View className="w-5 h-5 rounded-full bg-white" />
                )
              ) : (
                <View className="w-5 h-5 rounded-full border border-gray-400" />
              )}
            </View>
          );
        })}
      </View>

      {/* Keypad */}
      <View className="w-full px-4 pb-4">
        {/* Row 1 */}
        <View className="flex flex-row justify-between mb-4">
          {digits.slice(0, 3).map(d => (
            <Pressable
              key={d}
              onPress={() => handlePress(d)}
              disabled={code.length >= 6}
              className="w-20 h-20 bg-[#12151E] rounded-full flex items-center justify-center disabled:opacity-50 active:bg-gray-600"
            >
              <Text className="text-white text-xl SemiBold">{d}</Text>
            </Pressable>
          ))}
        </View>

        {/* Row 2 */}
        <View className="flex flex-row justify-between mb-4">
          {digits.slice(3, 6).map(d => (
            <Pressable
              key={d}
              onPress={() => handlePress(d)}
              disabled={code.length >= 6}
              className="w-20 h-20 bg-[#12151E] rounded-full flex items-center justify-center disabled:opacity-50 active:bg-gray-600"
            >
              <Text className="text-white text-xl SemiBold">{d}</Text>
            </Pressable>
          ))}
        </View>

        {/* Row 3 */}
        <View className="flex flex-row justify-between mb-4">
          {digits.slice(6, 9).map(d => (
            <Pressable
              key={d}
              onPress={() => handlePress(d)}
              disabled={code.length >= 6}
              className="w-20 h-20 bg-[#12151E] rounded-full flex items-center justify-center disabled:opacity-50 active:bg-gray-600"
            >
              <Text className="text-white text-xl SemiBold">{d}</Text>
            </Pressable>
          ))}
        </View>

        {/* Bottom row: show/hide, 0, backspace */}
        <View className="flex flex-row justify-between">
          <Pressable
            onPress={toggleShowCode}
            className="w-20 h-20 bg-[#12151E] rounded-full flex items-center justify-center active:bg-gray-700"
          >
            {showCode ? (
              <HideCodeIcon width={28} height={28} />
            ) : (
              <EyeShowIcon width={28} height={28} />
            )}
          </Pressable>

          <Pressable
            onPress={() => handlePress('0')}
            disabled={code.length >= 6}
            className="w-20 h-20 bg-[#12151E] rounded-full flex items-center justify-center disabled:opacity-50 active:bg-gray-600"
          >
            <Text className="text-white text-xl SemiBold">0</Text>
          </Pressable>

          <Pressable
            onPress={handleBackspace}
            disabled={code.length === 0}
            className="w-20 h-20 bg-[#12151E] rounded-full flex items-center justify-center disabled:opacity-50 active:bg-gray-700"
          >
            <BackspaceIcon width={30} height={20} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
