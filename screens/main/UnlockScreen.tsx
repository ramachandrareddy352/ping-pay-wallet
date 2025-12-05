import React, { useEffect, useState } from 'react';

import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable, Modal, Switch } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import EncryptedStorage from 'react-native-encrypted-storage';
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
import { clearAllWalletData } from '../../utils/wallet';
import EyeShowIcon from '../../assets/icons/Eye-Show-icon.svg';
import HideCodeIcon from '../../assets/icons/Hidecode-icon.svg';
import BackspaceIcon from '../../assets/icons/backspace-icon.svg';
import { RootStackParamList } from '../../types/navigation';
import { saveAuthRequirement } from '../../utils/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Unlock'>;

const LAST_ROUTE_KEY = 'LAST_ROUTE';

export default function UnlockScreen({ navigation }: Props) {
  const [code, setCode] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [ack, setAck] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [lockUntil, setLockUntilState] = useState(0);

  useEffect(() => {
    (async () => {
      const lock = await getLockUntil();
      setLockUntilState(lock);
      setCode([]);
    })();
  }, []);

  const isLocked = Date.now() < lockUntil;

  // --------------------------------------------------------------
  // 1. Passcode handling
  // --------------------------------------------------------------
  const handlePress = async (num: string) => {
    if (isLocked) {
      Toast.show({
        type: 'error',
        text1: 'Too many wrong attempts. Try again later.',
      });
      return;
    }

    const newCode = [...code, num];
    setCode(newCode);
    setErrorMsg('');

    if (newCode.length === 6) {
      const ok = await verifyPassword(newCode.join(''));
      if (ok) {
        await resetAttempts();
        await resetLockUntil();

        // ----- SUCCESS → go to saved screen (or Home) -----
        const saved = await EncryptedStorage.getItem(LAST_ROUTE_KEY);
        if (saved) {
          try {
            const { name, params } = JSON.parse(saved);
            if (name === 'Unlock') {
              navigation.navigate('Home');
            } else {
              navigation.replace(name as any, params);
            }
            return;
          } catch {
            navigation.replace('Home');
            return;
          }
        }
        // fallback
        navigation.replace('Home');
      } else {
        // ----- WRONG -----
        setCode([]);
        setErrorMsg('Wrong passcode');
        let attempts = (await getAttempts()) + 1;

        if (attempts >= 3) {
          if (lockUntil === 0) {
            const until = Date.now() + 30_000;
            await setLockUntil(until);
            setLockUntilState(until);
            await setAttempts(0);
            Toast.show({
              type: 'error',
              text1: 'Too many wrong attempts. Locked for 30 s.',
            });
          } else {
            // wipe everything
            await clearAllWalletData();
            await deletePassword();
            await resetAttempts();
            await resetLockUntil();
            await saveAuthRequirement('never');
            await EncryptedStorage.removeItem(LAST_ROUTE_KEY);
            Toast.show({
              type: 'error',
              text1: 'Too many failed attempts. Wallet reset.',
            });
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          }
        } else {
          await setAttempts(attempts);
          Toast.show({
            type: 'error',
            text1: `You have ${3 - attempts} attempt(s) left`,
          });
        }
      }
    }
  };

  const handleBackspace = () => setCode(prev => prev.slice(0, -1));
  const toggleShowCode = () => setShowCode(v => !v);

  // --------------------------------------------------------------
  // 2. Logout (forgot passcode)
  // --------------------------------------------------------------
  const handleLogout = async () => {
    if (!ack) return;
    await clearAllWalletData();
    await deletePassword();
    await saveAuthRequirement('never');
    await EncryptedStorage.removeItem(LAST_ROUTE_KEY);
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  // --------------------------------------------------------------
  // 3. UI
  // --------------------------------------------------------------
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <SafeAreaView className="flex-1 bg-black items-center justify-between py-6 px-6">
      <Text className="text-white text-4xl mt-12 Bold mb-12">WELCOME BACK</Text>
      <Text className="text-white text-xl mb-6 ">Enter Passcode</Text>

      {/* Dots */}
      <View className="flex-row mb-20">
        {Array.from({ length: 6 }).map((_, i) => {
          const digit = code[i];
          return (
            <View key={i} className="mx-2 w-4 h-4 items-center justify-center">
              {digit ? (
                showCode ? (
                  <Text className="text-white text-2xl font-medium -mt-2.5">
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

      {/* Keypad */}
      <View className="w-full px-4 pb-4">
        {[0, 3, 6].map(start => (
          <View key={start} className="flex-row justify-between mb-4">
            {digits.slice(start, start + 3).map(d => (
              <Pressable
                key={d}
                onPress={() => handlePress(d)}
                disabled={code.length >= 6 || isLocked}
                className="w-20 h-20 bg-[#12151E] rounded-full items-center justify-center disabled:opacity-50 active:bg-gray-600"
              >
                <Text className="text-white text-xl SemiBold">{d}</Text>
              </Pressable>
            ))}
          </View>
        ))}

        {/* Bottom row */}
        <View className="flex-row justify-between">
          <Pressable
            onPress={toggleShowCode}
            className="w-20 h-20 bg-[#12151E] rounded-full items-center justify-center active:bg-gray-700"
          >
            {showCode ? (
              <HideCodeIcon width={28} height={28} />
            ) : (
              <EyeShowIcon width={28} height={28} />
            )}
          </Pressable>

          <Pressable
            onPress={() => handlePress('0')}
            disabled={code.length >= 6 || isLocked}
            className="w-20 h-20 bg-[#12151E] rounded-full items-center justify-center disabled:opacity-50 active:bg-gray-600"
          >
            <Text className="text-white text-xl SemiBold">0</Text>
          </Pressable>

          <Pressable
            onPress={handleBackspace}
            disabled={code.length === 0 || isLocked}
            className="w-20 h-20 bg-[#12151E] rounded-full items-center justify-center disabled:opacity-50 active:bg-gray-700"
          >
            <BackspaceIcon width={30} height={20} />
          </Pressable>
        </View>
      </View>

      {/* Forgot */}
      <Pressable className="mt-6" onPress={() => setShowForgotModal(true)}>
        <Text className="text-zinc-400 ">Forgot passcode?</Text>
      </Pressable>

      {/* Forgot modal */}
      <Modal visible={showForgotModal} transparent animationType="slide">
        <View className="flex-1 justify-end">
          <View className="bg-zinc-900 p-6 rounded-t-2xl">
            <Text className="text-white text-lg mb-3 Bold">
              Forgot Passcode
            </Text>
            <Text className="text-gray-400 mb-4 ">
              Proceeding will erase your wallet data and passcode. Keep your
              recovery phrase safe.
            </Text>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white ">I understand — erase my data</Text>
              <Switch value={ack} onValueChange={setAck} />
            </View>
            <Pressable
              disabled={!ack}
              onPress={handleLogout}
              className={`py-3 rounded-2xl items-center ${
                ack ? 'bg-red-600' : 'bg-gray-700'
              }`}
            >
              <Text className="text-white SemiBold">Logout & Erase</Text>
            </Pressable>
            <Pressable
              className="mt-3 border border-zinc-700 py-3 rounded-2xl items-center"
              onPress={() => setShowForgotModal(false)}
            >
              <Text className="text-zinc-300 ">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
