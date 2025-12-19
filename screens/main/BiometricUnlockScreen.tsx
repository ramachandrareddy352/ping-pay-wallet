import React, { useEffect, useRef, useState } from 'react';

import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ImageBackground, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import EncryptedStorage from 'react-native-encrypted-storage';

import { RootStackParamList } from '../../types/navigation';
import {
  checkBiometricsAvailability,
  authenticateWithBiometrics,
  BiometricType,
} from '../../utils/biometric';
import { saveLastUnlockTime } from '../../utils/storage';
import { loadPassword } from '../../utils/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'BiometricUnlock'>;

const LAST_ROUTE_KEY = 'LAST_ROUTE';

/**
 * Static asset map (React Native requires static paths)
 */
const BIOMETRIC_ICONS = {
  FaceID: require('../../assets/images/facebiometric.png'),
  TouchID: require('../../assets/images/fingerprint.png'),
  Biometrics: require('../../assets/images/fingerprint.png'),
  Lock: require('../../assets/images/fingerprint.png'),
};

export default function BiometricUnlockScreen({ navigation }: Props) {
  // ---- Hooks (DO NOT reorder / change types during dev without restart) ----
  const [biometricType, setBiometricType] = useState<BiometricType>(null);

  // Prevent double execution (RN StrictMode + Fast Refresh safe)
  const authStartedRef = useRef<boolean>(false);

  // ------------------------------------------------------------------------
  // Auto biometric flow
  // ------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (authStartedRef.current) return;
      authStartedRef.current = true;

      // 1. PIN must exist
      const pwExists = await loadPassword();
      if (!pwExists || cancelled) {
        navigation.replace('Onboarding');
        return;
      }

      // 2. Check biometric availability
      const type = await checkBiometricsAvailability();
      if (!type || cancelled) {
        navigation.replace('Unlock');
        return;
      }

      setBiometricType(type);

      // 3. Trigger biometric immediately
      const success = await authenticateWithBiometrics(
        'Unlock your wallet securely',
      );

      if (!success || cancelled) {
        navigation.replace('Unlock');
        return;
      }

      // 4. Success → mark unlock time
      await saveLastUnlockTime(Date.now().toString());

      // 5. Navigate to last route or Home (reset stack)
      const saved = await EncryptedStorage.getItem(LAST_ROUTE_KEY);
      if (saved) {
        try {
          const { name, params } = JSON.parse(saved);

          navigation.reset({
            index: 0,
            routes: [
              {
                name:
                  name === 'Unlock' || name === 'BiometricUnlock'
                    ? 'Home'
                    : (name as keyof RootStackParamList),
                params,
              },
            ],
          });
          return;
        } catch {
          navigation.replace('Home');
          return;
        }
      }

      navigation.replace('Home');
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  // ------------------------------------------------------------------------
  // UI helpers
  // ------------------------------------------------------------------------
  const getIconSrc = (type: BiometricType) => {
    if (!type) return BIOMETRIC_ICONS.Lock;
    if (type === 'FaceID') return BIOMETRIC_ICONS.FaceID;
    if (type === 'TouchID' || type === 'Biometrics')
      return BIOMETRIC_ICONS.Biometrics;
    return BIOMETRIC_ICONS.Lock;
  };

  // ------------------------------------------------------------------------
  // Render (non-interactive screen)
  // ------------------------------------------------------------------------
  return (
    <SafeAreaView className="flex-1 bg-black items-center justify-center px-6">
      <View className="w-64 h-65 rounded-3xl overflow-hidden mb-8">
        <ImageBackground
          source={getIconSrc(biometricType)}
          resizeMode="cover"
          className="flex-1"
          imageStyle={{ opacity: 0.6 }}
        >
          <View className="flex-1 bg-black/20 justify-end items-center pb-4">
            <Text className="text-white SemiBold text-lg">Unlocking…</Text>
          </View>
        </ImageBackground>
      </View>

      <ActivityIndicator color="white" size="large" />
    </SafeAreaView>
  );
}
