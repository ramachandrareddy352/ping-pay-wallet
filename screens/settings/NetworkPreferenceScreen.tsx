import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { RootStackParamList } from '../../types/navigation';

import { loadWallet, saveWallet, WalletData } from '../../utils/storage';

import BackIcon from '../../assets/icons/back-arrow.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'NetworkPreference'>;

// Define a list of supported networks
const networks = [
  { code: 'mainnet-beta', name: 'Mainnet Beta' },
  { code: 'devnet', name: 'Devnet' },
];

const NetworkPreferenceScreen = ({ navigation }: Props) => {
  const [selectedNetwork, setSelectedNetwork] = useState<
    'devnet' | 'mainnet-beta' | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        setLoading(true);
        const wallet = await loadWallet();
        setSelectedNetwork(wallet?.network ?? 'mainnet-beta');
      } catch (error) {
        console.log('Error loading wallet:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to load network preference',
        });
        setSelectedNetwork('mainnet-beta'); // Fallback to mainnet-beta
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, []);

  const handleSelectNetwork = async (
    networkCode: 'devnet' | 'mainnet-beta',
    networkName: string,
  ) => {
    try {
      const wallet = await loadWallet();
      if (!wallet) {
        Toast.show({
          type: 'error',
          text1: 'No wallet data found',
        });
        return;
      }
      const updatedWallet: WalletData = {
        ...wallet,
        network: networkCode,
      };
      await saveWallet(updatedWallet);
      setSelectedNetwork(networkCode);
      Toast.show({
        type: 'success',
        text1: `Network changed to ${networkName}`,
      });
    } catch (error) {
      console.log('Error saving network:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to update network',
      });
    }
  };

  const handleGoBack = () => {
    navigation.navigate('Settings');
  };

  if (loading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#9707B5" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black px-4 py-6">
      {/* Back Arrow and Title */}
      <View className="pb-3 mb-6">
        <TouchableOpacity
          onPress={handleGoBack}
          className="flex flex-row items-center gap-4"
        >
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">
            Network Preference
          </Text>
        </TouchableOpacity>
      </View>

      {/* Network List */}
      <ScrollView className="flex-1">
        {networks.map(network => (
          <TouchableOpacity
            key={network.code}
            onPress={() => handleSelectNetwork(network.code, network.name)}
            className={`py-4 px-4 rounded-lg mb-2 ${
              selectedNetwork === network.code
                ? 'bg-[#9707B5] border-white border-l-4'
                : 'bg-zinc-900'
            }`}
          >
            <Text className="text-base text-white Medium">{network.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default NetworkPreferenceScreen;
