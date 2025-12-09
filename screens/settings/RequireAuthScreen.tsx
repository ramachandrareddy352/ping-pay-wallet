import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { RootStackParamList } from '../../types/navigation';
import { AuthOption } from '../../types/dataTypes';
import { saveAuthRequirement, loadAuthRequirement } from '../../utils/storage';
import BackIcon from '../../assets/icons/back-arrow.svg';
type Props = NativeStackScreenProps<RootStackParamList, 'RequireAuth'>;
const authOptions: AuthOption[] = [
  { label: 'Every time after app open', value: 'every_time' },
  { label: '1 minute', value: '1m' },
  { label: '5 minutes', value: '5m' },
  { label: '15 minutes', value: '15m' },
  { label: '30 minutes', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '3 hours', value: '3h' },
  { label: '8 hours', value: '8h' },
  { label: '24 hours', value: '24h' },
  { label: 'Never ask', value: 'never' },
];
const RequireAuthScreen = ({ navigation }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const loadSetting = async () => {
      try {
        setLoading(true);
        const saved = await loadAuthRequirement();
        setSelected(saved || 'every_time');
      } catch (error) {
        console.log('Error loading auth preference:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to load auth preference',
        });
        setSelected('every_time'); // Fallback to every_time
      } finally {
        setLoading(false);
      }
    };
    loadSetting();
  }, []);
  const handleSelect = async (value: string, label: string) => {
    try {
      await saveAuthRequirement(value);
      setSelected(value);
      Toast.show({
        type: 'success',
        text1: `Authentication set to ${label}`,
      });
    } catch (error) {
      console.log('Error saving auth preference:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to save preference',
      });
    }
  };
  const handleGoBack = () => {
    navigation.navigate('Settings');
  };
  const renderAuthOption = ({ item }: { item: AuthOption }) => (
    <TouchableOpacity
      onPress={() => handleSelect(item.value, item.label)}
      className={`py-4 px-4 rounded-lg mb-2 ${
        selected === item.value
          ? 'bg-[#9707B5] border-white border-l-4'
          : 'bg-zinc-900'
      }`}
    >
      <Text className="text-base text-white Medium">{item.label}</Text>
    </TouchableOpacity>
  );
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
      <View className="pb-3 mb-4">
        <TouchableOpacity
          onPress={handleGoBack}
          className="flex flex-row items-center gap-4"
        >
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">
            Require Authentication
          </Text>
        </TouchableOpacity>
      </View>
      {/* Auth Options List */}
      <FlatList
        data={authOptions}
        renderItem={renderAuthOption}
        keyExtractor={item => item.value}
        className="flex-1"
        ListHeaderComponent={
          <Text className="text-center text-orange-500 text-xs Medium">
            Ask for authentication after being reopened from recent apps
          </Text>
        }
      />
    </View>
  );
};
export default RequireAuthScreen;
