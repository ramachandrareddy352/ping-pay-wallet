import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';

import {
  verifyPassword,
  getAttempts,
  setAttempts,
  resetAttempts,
  getLockUntil,
  setLockUntil,
  resetLockUntil,
} from '../../utils/auth';
import { loadMnemonic } from '../../utils/wallet';

import { RootStackParamList } from '../../types/navigation';
import { WordItem } from '../../types/dataTypes';

import BackIcon from '../../assets/icons/back-arrow.svg';
import ShieldIcon from '../../assets/icons/shield-1.svg';
import CopyIcon from '../../assets/icons/copy-white.svg';
import EyeShowIcon from '../../assets/icons/Eye-Show-icon.svg';
import HideCodeIcon from '../../assets/icons/Hidecode-icon.svg';
import BackspaceIcon from '../../assets/icons/backspace-icon.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'ShowMnemonic'>;

const ShowMnemonicScreen = ({ navigation }: Props) => {
  const [step, setStep] = useState<'passcode' | 'warning' | 'mnemonic'>(
    'passcode',
  );
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [lockUntil, setLockUntilState] = useState(0);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load lock state
  useEffect(() => {
    const loadLockState = async () => {
      const lock = await getLockUntil();
      setLockUntilState(lock);
    };
    loadLockState();
  }, []);

  // Handle clipboard copy feedback
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

  const isLocked = Date.now() < lockUntil;

  const handlePasscodePress = async (num: string) => {
    if (isLocked) {
      Toast.show({
        type: 'error',
        text1: 'Too many wrong attempts. Try again later.',
      });
      return;
    }

    const newPasscode = passcode + num;
    setPasscode(newPasscode);
    setErrorMsg('');
    if (newPasscode.length === 6) {
      const ok = await verifyPassword(newPasscode);
      if (ok) {
        await resetAttempts();
        await resetLockUntil();
        setErrorMsg('');
        try {
          const loadedMnemonic = await loadMnemonic();
          if (!loadedMnemonic) {
            setErrorMsg('No mnemonic found');
            Toast.show({
              type: 'error',
              text1: 'No mnemonic found',
            });
            setPasscode('');
            return;
          }
          setMnemonic(loadedMnemonic);
          setStep('warning');
        } catch (error) {
          console.log('Error loading mnemonic:', error);
          setErrorMsg('Failed to load mnemonic');
          Toast.show({
            type: 'error',
            text1: 'Failed to load mnemonic',
          });
          setPasscode('');
        }
      } else {
        setPasscode('');
        setErrorMsg('Incorrect passcode');
        let attempts = await getAttempts();
        attempts += 1;
        if (attempts >= 3) {
          const until = Date.now() + 30 * 1000;
          await setLockUntil(until);
          setLockUntilState(until);
          await setAttempts(0);
          Toast.show({
            type: 'error',
            text1: 'Too many wrong attempts. Screen is locked for 30 seconds.',
          });
        } else {
          await setAttempts(attempts);
          Toast.show({
            type: 'error',
            text1: 'Incorrect passcode',
          });
        }
      }
    }
  };

  const handleBackspace = () => {
    setPasscode(passcode.slice(0, -1));
  };

  const toggleShowPasscode = () => {
    setShowPasscode(prev => !prev);
  };

  const handleAcceptTerms = () => {
    if (!acceptTerms) {
      Toast.show({
        type: 'error',
        text1: 'Please accept the terms to proceed',
      });
      return;
    }
    setStep('mnemonic');
  };

  const handleCopy = () => {
    if (!mnemonic) return;
    Clipboard.setString(mnemonic);
    setCopied(true);
  };

  const handleGoBack = () => {
    if (step === 'passcode') {
      navigation.navigate('Settings');
    } else if (step === 'warning') {
      setStep('passcode');
      setPasscode('');
      setAcceptTerms(false);
    } else if (step === 'mnemonic') {
      setStep('warning');
      setAcceptTerms(false);
    }
  };

  const recoveryWords: WordItem[] = mnemonic
    ? mnemonic.split(' ').map((w, i) => ({ number: i + 1, word: w }))
    : [];

  if (step === 'passcode') {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center p-6">
        {/* Header */}
        <View className="absolute top-0 left-0 w-full px-4 py-6">
          <TouchableOpacity
            onPress={handleGoBack}
            className="flex flex-row items-center gap-4"
          >
            <BackIcon width={16} height={16} />
            <Text className="text-base Medium text-white">Verify Passcode</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text className="text-white text-3xl Bold mb-12">VERIFY PASSCODE</Text>
        <Text className="text-white text-xl mb-6">Enter Passcode</Text>

        {/* Passcode dots or digits */}
        <View className="flex-row mb-2">
          {[...Array(6)].map((_, i) => {
            const digit = passcode[i];
            return (
              <View
                key={i}
                className="w-5 h-6 mx-2 items-center justify-center"
              >
                {digit ? (
                  showPasscode ? (
                    <Text className="text-white text-xl -mt-1 leading-none">
                      {digit}
                    </Text>
                  ) : (
                    <View className="w-4 h-4 rounded-full bg-white" />
                  )
                ) : (
                  <View className="w-4 h-4 rounded-full border border-gray-500" />
                )}
              </View>
            );
          })}
        </View>

        {/* Error text */}
        {errorMsg ? (
          <Text className="text-red-500 mt-1">{errorMsg}</Text>
        ) : null}

        {/* Keypad */}
        <View className="flex-wrap w-64 flex-row justify-center mt-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'view', 0, '⌫'].map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                if (typeof item === 'number') {
                  handlePasscodePress(item.toString());
                } else if (item === '⌫') {
                  handleBackspace();
                } else if (item === 'view') {
                  toggleShowPasscode();
                }
              }}
              className="w-1/3 p-6 items-center"
            >
              {item === 'view' ? (
                showPasscode ? (
                  <HideCodeIcon width={28} height={28} />
                ) : (
                  <EyeShowIcon width={28} height={28} />
                )
              ) : item === '⌫' ? (
                <BackspaceIcon width={30} height={20} />
              ) : (
                <Text className="text-white text-2xl">{item}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black p-6">
      {/* Header */}
      <View className="pb-3 mb-6">
        <TouchableOpacity
          onPress={handleGoBack}
          className="flex flex-row items-center gap-4"
        >
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">
            Your Recovery Phrase
          </Text>
        </TouchableOpacity>
      </View>

      {/* Card */}
      <View className="flex-1">
        <View className="border border-gray-800 rounded-2xl bg-[#0d0d0f] overflow-hidden">
          {step === 'warning' ? (
            <View className="flex-col items-center justify-center px-6 pt-10 pb-6">
              <View className="w-full flex items-center justify-center mb-6">
                <View className="w-[92px] h-[92px] rounded-full flex items-center justify-center p-3 bg-orange2">
                  <ShieldIcon width={100} height={100} />
                </View>
              </View>
              <Text className="text-lg SemiBold text-white mb-3 text-center">
                Write it Down
              </Text>
              <Text className="text-sm text-red-400 Medium text-center leading-6 px-2">
                Make sure no one is watching – this phrase gives full access to
                your wallet. Never share it with anyone.
              </Text>
              <View className="flex-row items-center justify-between mt-20 mb-4 w-full">
                <Text className="text-white Medium">
                  I understand the risks
                </Text>
                <Switch value={acceptTerms} onValueChange={setAcceptTerms} />
              </View>
              <TouchableOpacity
                onPress={handleAcceptTerms}
                className={`py-4 w-full items-center ${
                  acceptTerms ? 'bg-[#9707B5]' : 'bg-gray-700'
                } border-t rounded-full border-gray-800`}
              >
                <Text className="text-base text-white Medium">
                  Show Recovery Phrase
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View>
                {/* Words grid */}
                <FlatList
                  data={recoveryWords}
                  renderItem={({ item }) => (
                    <View style={styles.wordItem}>
                      <Text className="text-base text-gray-400 min-w-[24px]">
                        {item.number}.
                      </Text>
                      <Text className="text-base text-white Medium flex-1">
                        {item.word}
                      </Text>
                    </View>
                  )}
                  keyExtractor={item => item.number.toString()}
                  numColumns={2}
                  columnWrapperStyle={styles.columnWrapper}
                  contentContainerStyle={styles.gridContainer}
                  showsVerticalScrollIndicator={false}
                />

                {/* Copy button */}
                <TouchableOpacity
                  onPress={handleCopy}
                  className="flex-row items-center justify-center gap-2 py-4 w-full border-t border-gray-800"
                >
                  <CopyIcon width={18} height={18} />
                  <Text className="text-sm text-white Medium">Copy</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('Settings')}
                className="py-4 w-full items-center 'bg-[#9707B5]' border-t border-gray-800"
              >
                <Text className="text-base text-[#9707B5] Medium">Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
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
  columnWrapper: {
    flex: 1,
  },
});

export default ShowMnemonicScreen;
