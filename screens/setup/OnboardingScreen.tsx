import React, {useEffect} from 'react';
import {View, Text, Image, TouchableOpacity} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../types/navigation';

import {generateMnemonic, saveMnemonic, loadMnemonic} from '../../utils/wallet';
import {loadPassword} from '../../utils/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({navigation}: Props) {
  useEffect(() => {
    const checkSetup = async () => {
      const mnemonic = await loadMnemonic();
      const password = await loadPassword();
      if (mnemonic && password) {
        navigation.replace('Unlock');
      }
    };

    checkSetup();
  }, [navigation]);

  const handleCreate = async () => {
    const mnemonic = await generateMnemonic();
    await saveMnemonic(mnemonic);
    navigation.navigate('RecoveryPhrase', {mnemonic});
  };

  return (
    <View className="flex-1 w-full bg-black px-6">
      {/* Top Section */}
      <View className="flex flex-col flex-1 items-center justify-center">
        <Image
          source={require('../../assets/images/ping-pay-logo.png')}
          style={{width: 150, height: 100}}
          resizeMode="contain"
        />
        <Text className="text-sm text-white text-center">
          Keep you Assets Safe & Secure
        </Text>
      </View>

      {/* Bottom Section */}
      <View className="flex flex-col gap-4 mb-6">
        {/* Primary Button */}
        <TouchableOpacity
          onPress={handleCreate}
          className="bg-[#9707B5] py-4 rounded-2xl items-center">
          <Text className="text-white font-semibold text-base">
            Create Wallet
          </Text>
        </TouchableOpacity>

        {/* Secondary Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('ImportPhrase')}
          className="border border-gray-600 py-4 rounded-2xl items-center">
          <Text className="text-gray-300 font-medium text-base">
            I already have a wallet
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
