import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import {
  verifyPassword,
  savePassword,
  deletePassword,
  getAttempts,
  setAttempts,
  resetAttempts,
  getLockUntil,
  setLockUntil,
  resetLockUntil,
} from '../../utils/auth';
import { clearAllWalletData } from '../../utils/wallet';

import { RootStackParamList } from '../../types/navigation';

import BackIcon from '../../assets/icons/back-arrow.svg';
import EyeShowIcon from '../../assets/icons/Eye-Show-icon.svg';
import HideCodeIcon from '../../assets/icons/Hidecode-icon.svg';
import BackspaceIcon from '../../assets/icons/backspace-icon.svg';
import EncryptedStorage from 'react-native-encrypted-storage';
import { saveAuthRequirement } from '../../utils/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

const ResetPasswordScreen = ({ navigation }: Props) => {
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showNewPasscode, setShowNewPasscode] = useState(false);
  const [showConfirmPasscode, setShowConfirmPasscode] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [ack, setAck] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [lockUntil, setLockUntilState] = useState(0);
  const [step, setStep] = useState<'old' | 'new' | 'confirm'>('old');

  // Load persisted lock state
  useEffect(() => {
    const loadLockState = async () => {
      const lock = await getLockUntil();
      setLockUntilState(lock);
    };
    loadLockState();
  }, []);

  const isLocked = Date.now() < lockUntil;

  const handlePress = async (num: string) => {
    if (isLocked) {
      Toast.show({
        type: 'error',
        text1: 'Too many wrong attempts. Try again later.',
      });
      return;
    }

    if (step === 'old') {
      const newOldCode = oldCode + num;
      setOldCode(newOldCode);
      setErrorMsg('');
      if (newOldCode.length === 6) {
        const ok = await verifyPassword(newOldCode);
        if (ok) {
          await resetAttempts();
          await resetLockUntil();
          setErrorMsg('');
          setStep('new');
        } else {
          setOldCode('');
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
              text1:
                'Too many wrong attempts. Screen is locked for 30 seconds.',
            });
          } else {
            await setAttempts(attempts);
          }
        }
      }
    } else if (step === 'new') {
      const newPasscode = newCode + num;
      setNewCode(newPasscode);
      setErrorMsg('');
      if (newPasscode.length === 6) {
        setStep('confirm');
      }
    } else if (step === 'confirm') {
      const newConfirmCode = confirmCode + num;
      setConfirmCode(newConfirmCode);
      setErrorMsg('');
      if (newConfirmCode.length === 6) {
        if (newConfirmCode === newCode) {
          try {
            await savePassword(newConfirmCode);
            await resetAttempts();
            await resetLockUntil();
            setErrorMsg('');
            Toast.show({
              type: 'success',
              text1: 'Passcode updated successfully',
            });
            navigation.navigate('Settings');
          } catch (error) {
            setErrorMsg('Failed to update passcode');
            Toast.show({
              type: 'error',
              text1: 'Failed to update passcode',
            });
            setConfirmCode('');
            setNewCode('');
            setStep('new');
          }
        } else {
          setErrorMsg('Passcodes do not match');
          setConfirmCode('');
          Toast.show({
            type: 'error',
            text1: 'Passcodes do not match',
          });
        }
      }
    }
  };

  const handleBackspace = () => {
    if (step === 'old') {
      setOldCode(oldCode.slice(0, -1));
    } else if (step === 'new') {
      setNewCode(newCode.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmCode(confirmCode.slice(0, -1));
    }
  };

  const toggleShowCode = () => {
    if (step === 'old') {
      setShowCode(prev => !prev);
    } else if (step === 'new') {
      setShowNewPasscode(prev => !prev);
    } else if (step === 'confirm') {
      setShowConfirmPasscode(prev => !prev);
    }
  };

  const handleGoBack = () => {
    if (step === 'old') {
      navigation.navigate('Settings');
    } else if (step === 'new') {
      setNewCode('');
      setStep('old');
    } else if (step === 'confirm') {
      setConfirmCode('');
      setStep('new');
    }
  };

  const handleLogout = async () => {
    if (!ack) return;
    try {
      await clearAllWalletData();
      await deletePassword();
      await resetAttempts();
      await resetLockUntil();
      await saveAuthRequirement('never');
      await EncryptedStorage.removeItem('LAST_ROUTE');
      Toast.show({
        type: 'success',
        text1: 'Wallet data and passcode reset successfully',
      });
      navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
    } catch (error) {
      console.log('Logout cleanup failed', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to reset wallet data',
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black items-center justify-center p-6">
      {/* Header */}
      <View className="absolute top-0 left-0 w-full px-4 py-6">
        <TouchableOpacity
          onPress={handleGoBack}
          className="flex flex-row items-center gap-4"
        >
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">
            {step === 'old'
              ? 'Verify Old Passcode'
              : step === 'new'
              ? 'Enter New Passcode'
              : 'Confirm New Passcode'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text className="text-white text-center text-3xl Bold mb-12">
        {step === 'old'
          ? 'VERIFY PASSCODE'
          : step === 'new'
          ? 'NEW PASSCODE'
          : 'CONFIRM PASSCODE'}
      </Text>
      <Text className="text-white text-xl mb-6">
        {step === 'old'
          ? 'Enter Old Passcode'
          : step === 'new'
          ? 'Enter New Passcode'
          : 'Confirm New Passcode'}
      </Text>

      {/* Passcode dots or digits */}
      <View className="flex-row mb-2">
        {[...Array(6)].map((_, i) => {
          const digit =
            step === 'old'
              ? oldCode[i]
              : step === 'new'
              ? newCode[i]
              : confirmCode[i];
          const show =
            step === 'old'
              ? showCode
              : step === 'new'
              ? showNewPasscode
              : showConfirmPasscode;
          return (
            <View key={i} className="w-5 h-6 mx-2 items-center justify-center">
              {digit ? (
                show ? (
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
      {errorMsg ? <Text className="text-red-500 mt-1">{errorMsg}</Text> : null}

      {/* Keypad */}
      <View className="flex-wrap w-64 flex-row justify-center mt-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'view', 0, '⌫'].map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              if (typeof item === 'number') {
                handlePress(item.toString());
              } else if (item === '⌫') {
                handleBackspace();
              } else if (item === 'view') {
                toggleShowCode();
              }
            }}
            className="w-1/3 p-6 items-center"
          >
            {item === 'view' ? (
              (step === 'old' && showCode) ||
              (step === 'new' && showNewPasscode) ||
              (step === 'confirm' && showConfirmPasscode) ? (
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

      {/* Forgot Passcode */}
      {step === 'old' && (
        <TouchableOpacity
          className="mt-6"
          onPress={() => setShowForgotModal(true)}
        >
          <Text className="text-zinc-400">Forgot passcode?</Text>
        </TouchableOpacity>
      )}

      {/* Forgot modal */}
      <Modal visible={showForgotModal} transparent animationType="slide">
        <View className="flex-1 justify-end">
          <View className="bg-zinc-900 p-6 rounded-t-2xl">
            <Text className="text-white text-lg Medium mb-3">
              Forgot Passcode
            </Text>
            <Text className="text-gray-400 mb-4 Medium">
              If you proceed, you will need to logout which will erase the
              wallet data (mnemonic, imported accounts) and app passcode. This
              action is irreversible unless you have your recovery phrase.
            </Text>

            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white Medium">
                I understand — erase my data
              </Text>
              <Switch value={ack} onValueChange={setAck} />
            </View>

            <TouchableOpacity
              disabled={!ack}
              className={`py-3 rounded-2xl items-center ${
                ack ? 'bg-red-600' : 'bg-gray-700'
              }`}
              onPress={handleLogout}
            >
              <Text className="text-white SemiBold">Logout & Erase</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-3 border border-zinc-700 py-3 rounded-2xl items-center"
              onPress={() => setShowForgotModal(false)}
            >
              <Text className="text-zinc-300 Medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;
