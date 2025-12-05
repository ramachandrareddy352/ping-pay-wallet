import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import {
  verifyPassword,
  deletePassword,
  getAttempts,
  setAttempts,
  resetAttempts,
  getLockUntil,
  setLockUntil,
  resetLockUntil,
} from '../../utils/auth';
import {clearAllWalletData} from '../../utils/wallet';
import {
  clearWallet,
  clearLanguage,
  clearCurrency,
  clearAuthRequirement,
  clearAddressBook,
  saveAuthRequirement,
} from '../../utils/storage';

import {RootStackParamList} from '../../types/navigation';

import BackIcon from '../../assets/icons/back-arrow.svg';
import EyeShowIcon from '../../assets/icons/Eye-Show-icon.svg';
import HideCodeIcon from '../../assets/icons/Hidecode-icon.svg';
import BackspaceIcon from '../../assets/icons/backspace-icon.svg';
import EncryptedStorage from 'react-native-encrypted-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetApp'>;

const ResetAppScreen = ({navigation}: Props) => {
  const [step, setStep] = useState<'passcode' | 'warning'>('passcode');
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [lockUntil, setLockUntilState] = useState(0);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Load lock state
  useEffect(() => {
    const loadLockState = async () => {
      const lock = await getLockUntil();
      setLockUntilState(lock);
    };
    loadLockState();
  }, []);

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
        setErrorMsg(''); /// issue here
        setStep('warning');
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

  const handleResetApp = async () => {
    if (!acceptTerms) {
      Toast.show({
        type: 'error',
        text1: 'Please accept the terms to proceed',
      });
      return;
    }
    setIsResetting(true);
    try {
      await clearAllWalletData();
      await deletePassword();
      await saveAuthRequirement('never');
      await EncryptedStorage.removeItem('LAST_ROUTE');
      await clearWallet();
      await clearLanguage();
      await clearCurrency();
      await clearAuthRequirement();
      await clearAddressBook();
      await resetAttempts();
      await resetLockUntil();
      Toast.show({
        type: 'success',
        text1: 'App reset successfully',
      });
      navigation.reset({index: 0, routes: [{name: 'Onboarding'}]});
    } catch (error) {
      console.log('Error resetting app:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to reset app',
      });
      setIsResetting(false);
    }
  };

  const handleGoBack = () => {
    if (step === 'passcode') {
      navigation.navigate('Settings');
    } else {
      setStep('passcode');
      setPasscode('');
      setAcceptTerms(false);
    }
  };

  if (step === 'passcode') {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center p-6">
        {/* Header */}
        <View className="absolute top-0 left-0 w-full px-4 py-6">
          <TouchableOpacity
            onPress={handleGoBack}
            className="flex flex-row items-center gap-4">
            <BackIcon width={16} height={16} />
            <Text className="text-base Medium text-white">Reset App</Text>
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
                className="w-5 h-6 mx-2 items-center justify-center">
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
              className="w-1/3 p-6 items-center">
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
    <SafeAreaView className="flex-1 bg-black px-4 py-6">
      {/* Back Arrow and Title */}
      <View className="pb-3 mb-4">
        <TouchableOpacity
          onPress={handleGoBack}
          className="flex flex-row items-center gap-4">
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">Reset App</Text>
        </TouchableOpacity>
      </View>

      {/* Warning Modal */}
      <Modal visible={step === 'warning'} transparent animationType="slide">
        <View className="flex-1 justify-end">
          <View className="bg-zinc-900 p-6 rounded-t-2xl">
            <Text className="text-white text-lg Medium mb-3">
              Reset App Data
            </Text>
            <Text className="text-gray-400 mb-4 Medium">
              Resetting the app will permanently delete all wallet data
              (mnemonic, accounts, addresses), passcode, and preferences
              (language, currency). This action is irreversible unless you have
              your recovery phrase.
            </Text>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white Medium">
                I understand — reset all data
              </Text>
              <Switch value={acceptTerms} onValueChange={setAcceptTerms} />
            </View>
            <TouchableOpacity
              disabled={isResetting || !acceptTerms}
              onPress={handleResetApp}
              className={`py-3 rounded-2xl items-center ${
                acceptTerms ? 'bg-red-600' : 'bg-gray-700'
              }`}>
              {isResetting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white SemiBold">Reset</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              className="mt-3 border border-zinc-700 py-3 rounded-2xl items-center">
              <Text className="text-zinc-300 Medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ResetAppScreen;
