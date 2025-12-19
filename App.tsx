import React, { JSX, useEffect, useRef, useState } from 'react';
import { Text, AppState, Image, AppStateStatus, Alert } from 'react-native';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MenuProvider } from 'react-native-popup-menu';
import Toast from 'react-native-toast-message';
import EncryptedStorage from 'react-native-encrypted-storage';
// ----- Screens -----
import OnboardingScreen from './screens/setup/OnboardingScreen';
import RecoveryPhraseScreen from './screens/setup/RecoveryPhraseScreen';
import ConfirmRecoveryScreen from './screens/setup/ConfirmRecoveryScreen';
import PasscodeScreen from './screens/setup/PasscodeScreen';
import ConfirmPasscodeScreen from './screens/setup/ConfirmPasscodeScreen';
import ImportPhraseScreen from './screens/setup/ImportPhraseScreen';
import HomeScreen from './screens/main/HomeScreen';
import UnlockScreen from './screens/main/UnlockScreen';
import BiometricUnlockScreen from './screens/main/BiometricUnlockScreen'; // NEW: Add this import
import TokenDataScreen from './screens/main/TokenDataScreen';
import AccountsScreen from './screens/accounts/AccountsScreen';
import ImportAccountScreen from './screens/accounts/ImportAccountScreen';
import EditAccountScreen from './screens/accounts/EditAccountScreen';
import SettingsScreen from './screens/settings/SettingsScreen';
import NetworkPreferenceScreen from './screens/settings/NetworkPreferenceScreen';
import RequireAuthScreen from './screens/settings/RequireAuthScreen';
import SelectLanguageScreen from './screens/settings/SelectLanguageScreen';
import QRCodeScreen from './screens/common/QRCodeScreen';
import PrivateKeyScreen from './screens/common/PrivateKeyScreen';
import PrivateKeyShowScreen from './screens/common/PrivateKeyShowScreen';
import SendRecipientScreen from './screens/common/SendRecipientScreen';
import SendInputAmountScreen from './screens/common/SendInputAmountScreen';
import SwapTokenScreen from './screens/common/SwapTokenScreen';
import ExploreScreen from './screens/explore/ExploreScreen';
import TransactionHistoryScreen from './screens/history/TransactionHistoryScreen';
import { loadMnemonic } from './utils/wallet';
import { loadPassword } from './utils/auth';
import { RootStackParamList } from './types/navigation';
import SelectCurrencyScreen from './screens/settings/SelectCurrencyScreen';
import ResetPasswordScreen from './screens/settings/ResetPasswordScreen';
import ShowMnemonicScreen from './screens/settings/ShowMnemonicScreen';
import AddressBookScreen from './screens/settings/AddressBookScreen';
import ResetAppScreen from './screens/settings/ResetAppScreen';
import NFTDataScreen from './screens/main/NFTDataScreen';
import AccountNameScreen from './screens/accounts/AccountNameScreen';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import { WalletProvider } from './src/provider/Wallet';
import SignPopupProvider from './src/provider/SignMessagePopup';
import ConfirmSendScreen from './screens/common/ConfirmSendScreen';
import ConfirmNFTSendScreen from './screens/common/ConfirmNFTSendScreen';
import ScanQRScreen from './screens/main/ScanQrScreen';
import ConfirmSwapScreen from './screens/common/ConfirmSwapScreen';
import ConfirmTransactionScreen from './screens/common/ConfirmTransactionScreen';
import RewardsScreen from './screens/main/RewardsScreen';
import {
  saveAuthRequirement,
  loadAuthRequirement,
  saveLastUnlockTime,
  loadLastUnlockTime,
  saveLastRoute,
  loadLastRoute,
} from './utils/storage';
import { checkBiometricsAvailability } from './utils/biometric'; // NEW: Add this import
import TermsAndConditionsScreen from './screens/settings/TermsAndConditionsScreen';
import { useMandatoryUpdate } from './src/hooks/useMandatoryUpdate';
import UpdateRequiredScreen from './screens/setup/UpdateRequiredScreen';
import MerchantPaymentScreen from './screens/store/MerchantPaymentScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** "every_time" → 1.5 s (others as before) */
const parseAuthRequirementToMs = (value: string): number => {
  const map: Record<string, number> = {
    every_time: 1500,
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '3h': 10_800_000,
    '8h': 28_800_000,
    '24h': 86_400_000,
    never: Infinity,
  };
  return map[value] ?? 1500;
};

// keys
type LastState = 'background' | 'removed' | 'active';
const LAST_STATE_KEY = 'APP_LAST_STATE';
const FORCE_HOME_FLAG = 'FORCE_HOME_ON_UNLOCK';
const SESSION_KEY = 'APP_SESSION_ID';

const markAppClosed = async (state: LastState) => {
  try {
    await EncryptedStorage.setItem(LAST_STATE_KEY, state);
  } catch {}
};
const getLastState = async (): Promise<LastState | null> => {
  try {
    const s = await EncryptedStorage.getItem(LAST_STATE_KEY);
    if (s === 'background' || s === 'removed' || s === 'active') return s;
    return null;
  } catch {
    return null;
  }
};
const setForceHomeOnUnlock = async () => {
  try {
    await EncryptedStorage.setItem(FORCE_HOME_FLAG, '1');
  } catch {}
};
const clearForceHomeOnUnlock = async () => {
  try {
    await EncryptedStorage.removeItem(FORCE_HOME_FLAG);
  } catch {}
};

const setSession = async (): Promise<string> => {
  try {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await EncryptedStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return '';
  }
};
const clearSession = async () => {
  try {
    await EncryptedStorage.removeItem(SESSION_KEY);
  } catch {}
};
const getSession = async (): Promise<string | null> => {
  try {
    return await EncryptedStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};

function AppContent() {
  const [initialRoute, setInitialRoute] = useState<
    'Onboarding' | 'Unlock' | 'BiometricUnlock'
  >('Onboarding'); // UPDATED: Include 'BiometricUnlock'

  const { isMandatory, updateMessage, loading, versionInfo } =
    useMandatoryUpdate();

  const [ready, setReady] = useState(false);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // track initial state and boot logic
  const bootStateRef = useRef<LastState | null>(null);
  const handledRemovedRef = useRef<boolean>(false);

  /** IMPORTANT:
   * If mandatory update is required — BLOCK EVERYTHING
   * do not run unlock/home logic, app state, navigation, etc.
   */
  useEffect(() => {
    if (isMandatory || loading) return; // Block logic when update-screen must show

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      setReady(false);

      /** Restore last session */
      const prevSession = await getSession();
      const prevWasRemoved = !!prevSession;
      await setSession();

      const persistedState = await getLastState();
      bootStateRef.current = prevWasRemoved ? 'removed' : persistedState;

      const mnemonic = await loadMnemonic();
      const pwExists = await loadPassword();

      // UPDATED: Check biometrics availability for routing
      const biometricsAvailable = await checkBiometricsAvailability();

      // Routing logic remains identical, but prioritize biometrics if available
      if (bootStateRef.current === 'removed') {
        handledRemovedRef.current = false;

        if (mnemonic && pwExists) {
          await saveLastRoute(JSON.stringify({ name: 'Home' }));
          await setForceHomeOnUnlock();
          setInitialRoute(biometricsAvailable ? 'BiometricUnlock' : 'Unlock'); // UPDATED
        } else {
          await saveAuthRequirement('never');
          setInitialRoute('Onboarding');
        }
      } else {
        if (mnemonic && pwExists) {
          setInitialRoute(biometricsAvailable ? 'BiometricUnlock' : 'Unlock'); // UPDATED
        } else {
          await saveAuthRequirement('never');
          setInitialRoute('Onboarding');
        }
      }

      await markAppClosed('active');
      if (!isMounted) return;
      setReady(true);

      /**
       * IMPORTANT CHANGE FOR RN 0.82:
       * Always use AppState.currentState because events are now delayed.
       */
      let lastState: AppStateStatus = AppState.currentState;

      const onAppStateChange = async (nextState: AppStateStatus) => {
        if (!isMounted) return;
        if (isMandatory) return; // never run logic if update-screen is shown

        // Track transitions
        const wasBackground = lastState.match(/background|inactive/);
        const isNowActive = nextState === 'active';

        lastState = nextState;

        /** BACKGROUND → record lock info */
        if (nextState === 'background') {
          await markAppClosed('background');
          await saveLastUnlockTime(Date.now().toString());

          if (navigationRef.isReady()) {
            const route = navigationRef.getCurrentRoute();
            if (route) {
              await saveLastRoute(
                JSON.stringify({
                  name: route.name,
                  params: route.params ?? undefined,
                }),
              );
            }
          }

          await clearForceHomeOnUnlock();
          bootStateRef.current = 'background';
          return;
        }

        /** ACTIVE → triggered after unlock or re-open */
        if (isNowActive && wasBackground) {
          await markAppClosed('active');

          const unlockRequired = await loadAuthRequirement();
          const ms = parseAuthRequirementToMs(unlockRequired);
          const lastUnlock = Number(await loadLastUnlockTime());

          const shouldLock =
            unlockRequired !== 'never' && Date.now() - lastUnlock >= ms;

          if (!navigationRef.isReady()) {
            // Wait until navigation is ready, otherwise navigate() fails silently
            const interval = setInterval(() => {
              if (navigationRef.isReady()) {
                clearInterval(interval);
                if (shouldLock) {
                  // UPDATED: Prefer biometrics if available
                  checkBiometricsAvailability()
                    .then(available => {
                      navigationRef.navigate(
                        available ? 'BiometricUnlock' : 'Unlock',
                      );
                    })
                    .catch(() => navigationRef.navigate('Unlock'));
                }
              }
            }, 50);
          } else {
            if (shouldLock) {
              // UPDATED: Prefer biometrics if available
              checkBiometricsAvailability()
                .then(available => {
                  navigationRef.reset({
                    index: 0,
                    routes: [
                      {
                        name: available ? 'BiometricUnlock' : 'Unlock',
                      },
                    ],
                  });
                })
                .catch(() =>
                  navigationRef.reset({
                    index: 0,
                    routes: [{ name: 'Unlock' }],
                  }),
                );
            }
          }
        }
      };

      // NEW RN 0.82 API
      unsubscribe = AppState.addEventListener(
        'change',
        onAppStateChange,
      ).remove;
    };

    init();

    return () => {
      isMounted = false;
      if (!isMandatory) {
        markAppClosed('removed').catch(() => {});
        clearSession().catch(() => {});
      }
      unsubscribe?.();
    };
  }, [isMandatory, loading]);

  // 🔒 BLOCK APP AND SHOW UPDATE SCREEN
  if (isMandatory && versionInfo && !loading) {
    return (
      <UpdateRequiredScreen message={updateMessage} versionInfo={versionInfo} />
    );
  }

  // ----------------------
  // UI
  // ----------------------
  if (!ready) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <Image
          source={require('./assets/images/ping-pay-icon.png')}
          style={{ width: 60, height: 60 }}
        />
        <Text className="text-white mt-4">Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <Provider store={store}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
        <SignPopupProvider>
          <WalletProvider>
            <MenuProvider skipInstanceCheck>
              <NavigationContainer ref={navigationRef}>
                <Stack.Navigator
                  initialRouteName={initialRoute}
                  screenOptions={{ headerShown: false }}
                >
                  {/* ----- All screens ----- */}
                  <Stack.Screen
                    name="Onboarding"
                    component={OnboardingScreen}
                  />
                  <Stack.Screen
                    name="RecoveryPhrase"
                    component={RecoveryPhraseScreen}
                  />
                  <Stack.Screen
                    name="ConfirmRecovery"
                    component={ConfirmRecoveryScreen}
                  />
                  <Stack.Screen name="Passcode" component={PasscodeScreen} />
                  <Stack.Screen
                    name="ConfirmPasscode"
                    component={ConfirmPasscodeScreen}
                  />
                  <Stack.Screen
                    name="ImportPhrase"
                    component={ImportPhraseScreen}
                  />
                  <Stack.Screen name="Unlock" component={UnlockScreen} />
                  <Stack.Screen
                    name="BiometricUnlock"
                    component={BiometricUnlockScreen}
                  />
                  {/* NEW: Add this screen */}
                  <Stack.Screen name="Home" component={HomeScreen} />
                  <Stack.Screen name="Accounts" component={AccountsScreen} />
                  <Stack.Screen name="Settings" component={SettingsScreen} />
                  <Stack.Screen name="Explore" component={ExploreScreen} />
                  <Stack.Screen
                    name="ImportAccount"
                    component={ImportAccountScreen}
                  />
                  <Stack.Screen
                    name="EditAccount"
                    component={EditAccountScreen}
                  />
                  <Stack.Screen
                    name="AccountName"
                    component={AccountNameScreen}
                  />
                  <Stack.Screen name="QRCode" component={QRCodeScreen} />
                  <Stack.Screen
                    name="PrivateKey"
                    component={PrivateKeyScreen}
                  />
                  <Stack.Screen
                    name="PrivateKeyShow"
                    component={PrivateKeyShowScreen}
                  />
                  <Stack.Screen name="ScanQr" component={ScanQRScreen} />
                  <Stack.Screen
                    name="SendRecipient"
                    component={SendRecipientScreen}
                  />
                  <Stack.Screen
                    name="MerchantPayment"
                    component={MerchantPaymentScreen}
                  />
                  <Stack.Screen name="Swap" component={SwapTokenScreen} />
                  <Stack.Screen name="Rewards" component={RewardsScreen} />
                  <Stack.Screen
                    name="SendInputAmount"
                    component={SendInputAmountScreen}
                  />
                  <Stack.Screen name="TokenData" component={TokenDataScreen} />
                  <Stack.Screen
                    name="NFTDataScreen"
                    component={NFTDataScreen}
                  />
                  <Stack.Screen
                    name="TermsAndConditions"
                    component={TermsAndConditionsScreen}
                  />
                  <Stack.Screen
                    name="TransactionHistory"
                    component={TransactionHistoryScreen}
                  />
                  <Stack.Screen
                    name="NetworkPreference"
                    component={NetworkPreferenceScreen}
                  />
                  <Stack.Screen
                    name="SelectLanguage"
                    component={SelectLanguageScreen}
                  />
                  <Stack.Screen
                    name="SelectCurrency"
                    component={SelectCurrencyScreen}
                  />
                  <Stack.Screen
                    name="ResetPassword"
                    component={ResetPasswordScreen}
                  />
                  <Stack.Screen
                    name="RequireAuth"
                    component={RequireAuthScreen}
                  />
                  <Stack.Screen
                    name="ShowMnemonic"
                    component={ShowMnemonicScreen}
                  />
                  <Stack.Screen
                    name="AddressBook"
                    component={AddressBookScreen}
                  />
                  <Stack.Screen
                    name="ConfirmSend"
                    component={ConfirmSendScreen}
                  />
                  <Stack.Screen
                    name="ConfirmNFTSend"
                    component={ConfirmNFTSendScreen}
                  />
                  <Stack.Screen
                    name="ConfirmSwap"
                    component={ConfirmSwapScreen}
                  />
                  <Stack.Screen
                    name="ConfirmTransaction"
                    component={ConfirmTransactionScreen}
                  />
                  <Stack.Screen name="ResetApp" component={ResetAppScreen} />
                </Stack.Navigator>
              </NavigationContainer>
              <Toast visibilityTime={3000} swipeable />
            </MenuProvider>
          </WalletProvider>
        </SignPopupProvider>
      </SafeAreaView>
    </Provider>
  );
}

export default function App(): JSX.Element {
  return <AppContent />;
}
