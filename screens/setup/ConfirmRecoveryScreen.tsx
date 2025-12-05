import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import BackIcon from '../../assets/icons/back-arrow.svg';

import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmRecovery'>;

export default function ConfirmRecoveryScreen({ route, navigation }: Props) {
  const { mnemonic } = route.params;
  const mnemonicWords = mnemonic.trim().split(' ');

  const [questions, setQuestions] = useState<
    { index: number; options: string[] }[]
  >([]);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, string>
  >({});
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    generateQuestions();
  }, []);

  const generateQuestions = () => {
    const indexes = Array.from({ length: 12 }, (_, i) => i);
    const randomIndexes = indexes.sort(() => 0.5 - Math.random()).slice(0, 3);

    const q = randomIndexes.map(i => {
      // correct word
      const correct = mnemonicWords[i];
      // pick 3 other random distinct words
      const others = mnemonicWords
        .filter((_, idx) => idx !== i)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      const allOptions = [...others, correct].sort(() => 0.5 - Math.random());
      return { index: i, options: allOptions };
    });

    setQuestions(q);
  };

  const handleSelect = (questionIndex: number, word: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: word }));
  };

  const handleConfirm = () => {
    if (Object.keys(selectedAnswers).length < 3) {
      Toast.show({
        type: 'info',
        text1: 'Please answer all questions',
      });
      return;
    }

    const allCorrect = questions.every(
      q => selectedAnswers[q.index] === mnemonicWords[q.index],
    );

    if (allCorrect) {
      Toast.show({ type: 'success', text1: 'Recovery phrase confirmed!' });
      navigation.replace('Passcode');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setSelectedAnswers({});
      if (newAttempts >= 5) {
        Toast.show({
          type: 'error',
          text1: 'Too many wrong attempts!',
          text2: 'Redirecting to onboarding...',
        });
        setTimeout(() => navigation.replace('Onboarding'), 1500);
      } else {
        Toast.show({
          type: 'error',
          text1: `Incorrect! Attempts left: ${5 - newAttempts}`,
        });
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black px-6">
      {/* Title */}
      <Text className="text-xl text-white font-semibold text-center mt-4">
        Confirm Recovery Phrase
      </Text>
      <Text className="text-sm text-gray-400 text-center mb-2">
        Select the correct words to verify your seed phrase.
      </Text>

      <ScrollView>
        {/* Questions */}
        <View className="flex-1">
          {questions.map((q, idx) => (
            <View
              key={idx}
              className="bg-[#111] border border-gray-800 rounded-2xl px-4 pt-3 mb-3"
            >
              <Text className="text-white text-base font-semibold mb-3">
                {`Select the ${q.index + 1}${
                  q.index + 1 === 1
                    ? 'st'
                    : q.index + 1 === 2
                    ? 'nd'
                    : q.index + 1 === 3
                    ? 'rd'
                    : 'th'
                } word`}
              </Text>

              <View className="flex-row flex-wrap justify-between">
                {q.options.map((opt, i) => {
                  const isSelected = selectedAnswers[q.index] === opt;
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => handleSelect(q.index, opt)}
                      className={`w-[48%] py-3 px-2 mb-3 rounded-xl border ${
                        isSelected
                          ? 'bg-[#9707B5] border-[#9707B5]'
                          : 'bg-gray-900 border-gray-800'
                      }`}
                    >
                      <Text
                        className={`text-center font-medium ${
                          isSelected ? 'text-white' : 'text-gray-300'
                        }`}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Continue button */}
      <TouchableOpacity
        onPress={handleConfirm}
        disabled={Object.keys(selectedAnswers).length < 3}
        className={`mt-4 py-4 mb-2 rounded-2xl ${
          Object.keys(selectedAnswers).length < 3
            ? 'bg-gray-800'
            : 'bg-[#9707B5]'
        }`}
      >
        <Text
          className={`text-center text-base font-semibold ${
            Object.keys(selectedAnswers).length < 3
              ? 'text-gray-500'
              : 'text-white'
          }`}
        >
          Continue
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
