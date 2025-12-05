import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import {RootStackParamList} from '../../types/navigation';

import {saveLanguage, loadLanguage} from '../../utils/storage';

import BackIcon from '../../assets/icons/back-arrow.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectLanguage'>;

// Define a list of supported languages with native names
const languages = [
  {code: 'en', name: 'English', nativeName: 'English'},
  {code: 'es', name: 'Spanish', nativeName: 'Español'},
  {code: 'fr', name: 'French', nativeName: 'Français'},
  {code: 'de', name: 'German', nativeName: 'Deutsch'},
  {code: 'zh', name: 'Chinese', nativeName: '中文'},
  {code: 'hi', name: 'Hindi', nativeName: 'हिन्दी'},
  {code: 'ar', name: 'Arabic', nativeName: 'العربية'},
  {code: 'ja', name: 'Japanese', nativeName: '日本語'},
  {code: 'ko', name: 'Korean', nativeName: '한국어'},
  {code: 'ru', name: 'Russian', nativeName: 'Русский'},
];

const SelectLanguageScreen = ({navigation}: Props) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSelectedLanguage = async () => {
      try {
        setLoading(true);
        const language = await loadLanguage();
        setSelectedLanguage(language || 'en'); // Default to English if not set
      } catch (error) {
        console.log('Error loading language:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to load language preference',
        });
        setSelectedLanguage('en'); // Fallback to English
      } finally {
        setLoading(false);
      }
    };

    loadSelectedLanguage();
  }, []);

  const handleSelectLanguage = async (
    languageCode: string,
    languageName: string,
  ) => {
    try {
      await saveLanguage(languageCode);
      setSelectedLanguage(languageCode);
      Toast.show({
        type: 'success',
        text1: `Language updated to ${languageName}`,
      });
    } catch (error) {
      console.log('Error saving language:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to update language',
      });
    }
  };

  const handleGoBack = () => {
    navigation.navigate('Settings');
  };

  if (loading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black px-4 py-6">
      {/* Header */}
      <View className="pb-3 mb-4">
        <TouchableOpacity
          onPress={handleGoBack}
          className="flex flex-row items-center gap-4">
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">Select Language</Text>
        </TouchableOpacity>
      </View>

      {/* Language List */}
      <ScrollView className="flex-1">
        {languages.map(lang => (
          <TouchableOpacity
            key={lang.code}
            onPress={() => handleSelectLanguage(lang.code, lang.name)}
            className={`py-4 px-4 rounded-lg mb-2 ${
              selectedLanguage === lang.code
                ? 'bg-[#9707B5] border-white border-l-4'
                : 'bg-zinc-900'
            }`}>
            <Text className="text-base text-white Medium">
              {lang.nativeName}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default SelectLanguageScreen;
