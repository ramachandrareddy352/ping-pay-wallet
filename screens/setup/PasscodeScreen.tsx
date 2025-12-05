import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import Keypad from '../../components/KeyPad';

type Props = NativeStackScreenProps<RootStackParamList, 'Passcode'>;

export default function PasscodeScreen({ navigation }: Props) {
  const [code, setCode] = useState<string[]>([]);
  const [showCode, setShowCode] = useState(false);

  const handlePress = (num: string) => {
    if (code.length < 6) {
      const newCode = [...code, num];
      setCode(newCode);
      if (newCode.length === 6) {
        navigation.navigate('ConfirmPasscode', { password: newCode.join('') });
      }
    }
  };

  const handleBackspace = () => setCode(prev => prev.slice(0, -1));
  const toggleShowCode = () => setShowCode(prev => !prev);

  return (
    <SafeAreaView className="flex-1 bg-black items-center justify-between py-6 px-6">
      {/* Title */}
      <Text className="text-white text-xl Bold mb-8">Enter New Passcode</Text>
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

      {/* Keypad Component */}
      <Keypad
        codeLength={code.length}
        showCode={showCode}
        handlePress={handlePress}
        handleBackspace={handleBackspace}
        toggleShowCode={toggleShowCode}
      />
    </SafeAreaView>
  );
}
