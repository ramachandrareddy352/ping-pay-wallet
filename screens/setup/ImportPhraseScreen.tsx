import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as bip39 from 'bip39';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { RootStackParamList } from '../../types/navigation';

import { saveMnemonic } from '../../utils/wallet';

import BackIcon from '../../assets/icons/back-arrow.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportPhrase'>;

export default function ImportPhraseScreen({ navigation }: Props) {
  const [inputs, setInputs] = useState(Array(12).fill(''));
  const [loading, setLoading] = useState(false);

  const handleChange = (text: string, index: number) => {
    const newInputs = [...inputs];
    newInputs[index] = text.trim().toLowerCase();
    setInputs(newInputs);
  };

  const allFilled = inputs.every(w => w.length > 0);

  const handleImport = async () => {
    const phrase = inputs
      .map(w => w.trim().toLowerCase())
      .join(' ')
      .trim();

    if (!bip39.validateMnemonic(phrase)) {
      Toast.show({
        type: 'error',
        text2: 'Please enter a valid 12 word mnemonic key',
      });
      return;
    }

    setLoading(true);
    try {
      await saveMnemonic(phrase);
      navigation.replace('Passcode'); // Initialize passcode
    } catch (err) {
      console.log('Import error:', err);
      Toast.show({
        type: 'error',
        text2: 'Failed to import mnemonic. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black p-6">
      {/* Back */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Onboarding')}
        className="flex-row items-center gap-3 mb-6"
      >
        <BackIcon width={16} height={16} />
        <Text className="text-white text-base">Back</Text>
      </TouchableOpacity>

      {/* Title */}
      <Text className="text-xl text-white font-semibold text-center mb-2">
        Import Recovery Phrase
      </Text>
      <Text className="text-sm text-gray-400 text-center mb-6">
        Enter your 12-word seed phrase below.
      </Text>

      {/* Input Grid (2x6) */}
      <View style={styles.grid}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={styles.inputWrapper}>
            <Text style={styles.index}>{i + 1}</Text>
            <TextInput
              style={styles.input}
              value={inputs[i]}
              onChangeText={t => handleChange(t, i)}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder=""
              placeholderTextColor="#555"
            />
          </View>
        ))}
      </View>

      {/* Import button */}
      <TouchableOpacity
        disabled={!allFilled || loading}
        onPress={handleImport}
        className={`mt-8 py-4 rounded-2xl ${
          allFilled && !loading ? 'bg-[#9707B5]' : 'bg-gray-800'
        }`}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text
            className={`text-center text-base font-semibold ${
              allFilled ? 'text-white' : 'text-gray-500'
            }`}
          >
            Import & Continue
          </Text>
        )}
      </TouchableOpacity>

      {/* Cancel */}
      {!loading && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Onboarding')}
          className="mt-3 border border-zinc-700 py-4 rounded-2xl items-center"
        >
          <Text className="text-zinc-300">Cancel</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  inputWrapper: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 6,
  },
  index: {
    color: '#9ca3af',
    fontSize: 14,
    marginRight: 6,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 0,
  },
});
