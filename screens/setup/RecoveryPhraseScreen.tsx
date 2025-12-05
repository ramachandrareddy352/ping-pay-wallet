import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';

import { RootStackParamList } from '../../types/navigation';

import BackIcon from '../../assets/icons/back-arrow.svg';
import CopyIcon from '../../assets/icons/copy-white.svg';
import EyeShowIcon from '../../assets/icons/Eye-Show-icon.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'RecoveryPhrase'>;

export default function RecoveryPhraseScreen({ route, navigation }: Props) {
  const mnemonic = (route.params && route.params.mnemonic) || '';

  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState(false);

  const recoveryWords = mnemonic
    ? mnemonic.split(' ').map((w, i) => ({ number: i + 1, word: w }))
    : [];

  useEffect(() => {
    if (copied) {
      Toast.show({
        type: 'success',
        text1: 'Recovery phrase copied to clipboard',
      });
      const t = setTimeout(() => setCopied(false), 900);
      return () => clearTimeout(t);
    }
  }, [copied]);

  const handleCopy = () => {
    if (!mnemonic) return;
    Clipboard.setString(mnemonic);
    setCopied(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-black px-6 pt-6 pb-2">
      {/* Header */}
      <Pressable
        onPress={() => navigation.navigate('Onboarding')}
        className="pb-3 mb-6 flex-row items-center gap-4"
      >
        <BackIcon width={16} height={16} />
        <Text className="text-base text-white">Your Recovery Phrase</Text>
      </Pressable>

      {/* Card */}
      <View className="flex-1">
        <View className="border border-gray-800 rounded-2xl bg-[#0d0d0f] overflow-hidden">
          {!showPhrase ? (
            <View className="flex-col items-center justify-center px-6 py-10">
              <Text className="text-lg font-semibold text-white mb-3 text-center">
                Write it Down
              </Text>
              <Text className="text-sm text-gray-400 text-center leading-6 px-2">
                Make sure no one is watching – this phrase gives full access to
                your wallet. Never share it with anyone
              </Text>
            </View>
          ) : (
            <View>
              {/* Words grid */}
              <ScrollView
                contentContainerStyle={styles.gridContainer}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 340 }}
              >
                {recoveryWords.map(item => (
                  <View key={item.number} style={styles.wordItem}>
                    <Text className="text-base text-gray-400 min-w-[24px]">
                      {item.number}.
                    </Text>
                    <Text className="text-base text-white font-medium flex-1">
                      {item.word}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              {/* Copy button */}
              <TouchableOpacity
                onPress={handleCopy}
                className="flex-row items-center justify-center gap-2 py-4 w-full border-t border-gray-800"
              >
                <CopyIcon width={18} height={18} />
                <Text className="text-sm text-white font-medium">Copy</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom button (Show / Continue) */}
          {!showPhrase ? (
            <TouchableOpacity
              onPress={() => setShowPhrase(true)}
              className="flex-row items-center justify-center gap-2 py-4 w-full border-t border-gray-800"
            >
              <EyeShowIcon width={18} height={18} />
              <Text className="text-base text-white font-medium">Show</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Continue button */}
      {showPhrase && (
        <View className="mt-6">
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ConfirmRecovery' as any, { mnemonic })
            }
            className="py-4 rounded-2xl bg-[#9707B5]"
          >
            <Text className="text-center text-white text-base font-semibold">
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  wordItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
});
