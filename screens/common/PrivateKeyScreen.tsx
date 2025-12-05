import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity, Switch, ScrollView} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import {
  verifyPassword,
  getAttempts,
  setAttempts,
  getLockUntil,
  setLockUntil,
  resetAttempts,
  resetLockUntil,
} from '../../utils/auth';

import {RootStackParamList} from '../../types/navigation';
import Keypad from '../../components/KeyPad';

// Icons
import BackIcon from '../../assets/icons/back-arrow.svg';
import KeyIcon from '../../assets/icons/key-icon-1.svg';
import EyeOffIcon from '../../assets/icons/eye-off-1.svg';
import ErrorIcon from '../../assets/icons/error-icon-1.svg';
import ShieldIcon from '../../assets/icons/shield-1.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivateKey'>;

const PrivateKeyScreen = ({route, navigation}: Props) => {
  const {accountId} = route.params;

  const [step, setStep] = useState<'passcode' | 'warning'>('passcode');
  // Renamed to 'code' temporarily in logic for Keypad component consistency
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showCode, setShowCode] = useState(false); // Renamed for Keypad consistency
  const [lockUntil, setLockUntilState] = useState(0);
  const [isDeclared, setIsDeclared] = useState(false);

  // Reset states on screen focus
  useFocusEffect(
    React.useCallback(() => {
      setCode('');
      setIsDeclared(false);
      setStep('passcode');
      setErrorMsg('');
      setShowCode(false);
    }, []),
  );

  // Load lock state
  useEffect(() => {
    const loadLockState = async () => {
      const lock = await getLockUntil();
      setLockUntilState(lock);
    };

    loadLockState();
  }, []);

  const isLocked = Date.now() < lockUntil;

  const handlePress = async (num: string) => {
    // Renamed for Keypad consistency
    if (isLocked) {
      Toast.show({
        type: 'error',
        text1: 'Too many wrong attempts. Try again later.',
      });
      return;
    }

    const newCode = code + num;
    setCode(newCode);
    setErrorMsg('');
    if (newCode.length === 6) {
      const ok = await verifyPassword(newCode);
      if (ok) {
        await resetAttempts();
        await resetLockUntil();
        setErrorMsg('');
        setStep('warning');
      } else {
        setCode('');
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
    setCode(code.slice(0, -1));
  };

  const toggleShowCode = () => {
    // Renamed for Keypad consistency
    setShowCode(prev => !prev);
  };

  const handleContinue = () => {
    if (!isDeclared) {
      Toast.show({
        type: 'error',
        text1: 'Please accept the terms to proceed',
      });
      return;
    }
    navigation.navigate('PrivateKeyShow', {accountId});
  };

  const handleGoBack = () => {
    if (step === 'passcode') {
      navigation.navigate('EditAccount', {accountId});
    } else {
      setStep('passcode');
      setCode('');
      setIsDeclared(false);
    }
  };

  if (step === 'passcode') {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-between p-6">
        {/* Header */}
        <View className="absolute top-0 left-0 w-full px-4 py-6 z-10">
          <TouchableOpacity
            onPress={handleGoBack}
            className="flex flex-row items-center gap-4">
            <BackIcon width={16} height={16} />
            <Text className="text-base Medium text-white">Verify Passcode</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-1 w-full items-center justify-center">
          {/* Title */}
          <Text className="text-white text-3xl Bold mb-12">
            VERIFY PASSCODE
          </Text>
          <Text className="text-white text-xl mb-6">Enter Passcode</Text>

          {/* Passcode dots */}
          <View className="flex-row mb-2">
            {Array.from({length: 6}).map((_, i) => {
              const digit = code[i];
              return (
                <View
                  key={i}
                  className="mx-2 w-4 h-4 items-center justify-center">
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

          {/* Error text */}
          {errorMsg ? (
            <Text className="text-red-500 mt-1">{errorMsg}</Text>
          ) : null}
        </View>

        {/* Keypad Component */}
        <Keypad
          codeLength={code.length}
          showCode={showCode}
          handlePress={handlePress}
          handleBackspace={handleBackspace}
          toggleShowCode={toggleShowCode}
          // The Keypad component handles its own disabled state based on codeLength
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black px-4">
      {/* Header */}
      <View className="pb-3 mb-4 pt-6">
        <TouchableOpacity
          onPress={handleGoBack}
          className="flex flex-row items-center gap-4">
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">Your Private Key</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 w-full">
        {/* Icon Section */}
        <View className="w-full flex-1 p-4">
          <View className="w-full flex items-center justify-center">
            <View className="rounded-full flex items-center justify-center bg-orange2">
              <ShieldIcon width={100} height={100} />
            </View>
          </View>

          <Text className="text-2xl text-white SemiBold text-center my-5">
            Keep your Private Key Secret
          </Text>

          {/* Warning Messages */}
          <View className="w-full">
            <View className="flex flex-row items-start gap-2 pb-5">
              <KeyIcon width={20} height={20} />
              <Text className="text-base text-white Medium flex-1">
                Your private key is like a password for your account.
              </Text>
            </View>

            <View className="flex flex-row items-start gap-2 py-5">
              <EyeOffIcon width={20} height={20} />
              <Text className="text-base text-white Medium flex-1">
                If someone gets it, they can drain your wallet. There’s no way
                to recover lost funds.
              </Text>
            </View>

            <View className="flex flex-row items-start gap-2 py-5">
              <ErrorIcon width={20} height={20} />
              <Text className="text-base text-white Medium flex-1">
                Never share it with anyone - no person, website, or app.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Checkbox and Continue Button */}
      <View className="w-full pt-6 mt-auto">
        <View className="flex flex-row items-start gap-2 mb-5">
          <Switch
            onValueChange={setIsDeclared}
            value={isDeclared}
            trackColor={{false: '#767577', true: '#81b0ff'}}
            thumbColor={isDeclared ? '#f4f3f4' : '#f4f3f4'}
          />
          <Text
            onPress={() => setIsDeclared(prev => !prev)}
            className="text-sm Medium text-white flex-1">
            I understand that sharing my private key could result in permanent
            loss of funds
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleContinue}
          disabled={!isDeclared}
          className={`py-3 px-6 mb-2 w-full rounded-full flex items-center justify-center ${
            !isDeclared ? 'bg-slate-600' : 'bg-[#9707B5]'
          }`}>
          <Text className="text-base text-center SemiBold text-white">
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default PrivateKeyScreen;
