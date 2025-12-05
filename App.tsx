import React, { JSX, useEffect, useRef, useState } from 'react';
import { Text, AppState, Image, AppStateStatus } from 'react-native';
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
  const [initialRoute, setInitialRoute] = useState<'Onboarding' | 'Unlock'>(
    'Onboarding',
  );
  const { isMandatory, updateMessage, loading, versionInfo } =
    useMandatoryUpdate();
  const [ready, setReady] = useState(false);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  // remember persisted state loaded at boot (so we can treat the 'removed' case once)
  const bootStateRef = useRef<LastState | null>(null);
  const handledRemovedRef = useRef<boolean>(false);

  useEffect(() => {
    if (isMandatory) return;
    let mounted = true;

    const run = async () => {
      setReady(false);

      // Detect if the previous run didn't clean up (session still present) -> previous process
      // was killed/removed without running unmount. This is more reliable than relying on
      // component cleanup which doesn't run when the OS kills the process.
      const prevSession = await getSession();
      const prevWasRemoved = !!prevSession;

      // set a new session id for THIS run; we'll clear it when the component unmounts
      await setSession();

      // 1) Load persisted last state and wallet presence
      const persisted = await getLastState();

      // If prevWasRemoved is true we should treat previous run as 'removed' even if last
      // state says 'background' or 'active' because the OS likely killed the process.
      if (prevWasRemoved) {
        bootStateRef.current = 'removed';
      } else {
        bootStateRef.current = persisted;
      }

      const mnemonic = await loadMnemonic();
      const pwExists = await loadPassword();

      // 2) If last persisted was removed -> enforce Home after unlock (if wallet exists),
      //    otherwise enforce Onboarding.
      if (bootStateRef.current === 'removed') {
        handledRemovedRef.current = false; // will be handled on next 'active'
        if (mnemonic && pwExists) {
          // overwrite lastRoute to Home and set FORCE flag so Unlock must open Home
          await saveLastRoute(
            JSON.stringify({ name: 'Home', params: undefined }),
          );
          await setForceHomeOnUnlock();
          setInitialRoute('Unlock');
        } else {
          // no wallet -> onboarding
          await saveAuthRequirement('never');
          setInitialRoute('Onboarding');
        }
      } else {
        // not removed
        if (mnemonic && pwExists) {
          setInitialRoute('Unlock');
        } else {
          await saveAuthRequirement('never');
          setInitialRoute('Onboarding');
        }
      }

      // mark active for this process
      await markAppClosed('active');

      if (!mounted) return;
      setReady(true);

      // single AppState handler (background / active)
      const handler = async (nextState: AppStateStatus) => {
        try {
          if (nextState === 'background') {
            // going to background: persist route + unlock time + last state
            await markAppClosed('background');
            await saveLastUnlockTime(Date.now().toString());
            if (navigationRef.isReady()) {
              const cur = navigationRef.getCurrentRoute();
              if (cur) {
                const payload = {
                  name: cur.name,
                  params: cur.params ?? undefined,
                };
                await saveLastRoute(JSON.stringify(payload));
              }
            }

            // clear any force-home flag (background -> normal behaviour)
            await clearForceHomeOnUnlock();

            bootStateRef.current = 'background';
            return;
          }

          if (nextState === 'active') {
            await markAppClosed('active');

            // If this process booted from a previous "removed" and we didn't handle it yet,
            // ensure we force Home-after-unlock (if wallet available), and navigate to Unlock.
            if (
              bootStateRef.current === 'removed' &&
              !handledRemovedRef.current
            ) {
              handledRemovedRef.current = true;
              const mnemonicNow = await loadMnemonic();
              const pwNow = await loadPassword();

              if (mnemonicNow && pwNow) {
                // Ensure force flag + saved last route = Home
                await saveLastRoute(
                  JSON.stringify({ name: 'Home', params: undefined }),
                );
                await setForceHomeOnUnlock();
                if (navigationRef.isReady()) {
                  navigationRef.navigate('Unlock');
                } else {
                  // small delay then try
                  await new Promise(res => setTimeout(res, 50));
                  if (navigationRef.isReady()) navigationRef.navigate('Unlock');
                }
                bootStateRef.current = null;
                return;
              } else {
                // no wallet -> go to onboarding
                await saveAuthRequirement('never');
                if (navigationRef.isReady()) {
                  navigationRef.navigate('Onboarding');
                } else {
                  await new Promise(res => setTimeout(res, 50));
                  if (navigationRef.isReady())
                    navigationRef.navigate('Onboarding');
                }
                bootStateRef.current = null;
                return;
              }
            }

            // Normal active handling (background -> active)
            const mnemonicNow = await loadMnemonic();
            const pwNow = await loadPassword();

            if (mnemonicNow && pwNow) {
              if (!navigationRef.isReady()) {
                await new Promise(res => setTimeout(res, 50));
              }

              const auth = (await loadAuthRequirement()) ?? 'every_time';
              const lastUnlock = await loadLastUnlockTime();
              const requiredMs = parseAuthRequirementToMs(auth);
              const now = Date.now();

              // if 'never' => restore saved route
              if (requiredMs === Infinity) {
                const saved = await loadLastRoute();
                if (saved) {
                  try {
                    const { name, params } = JSON.parse(saved);
                    if (navigationRef.isReady()) {
                      navigationRef.navigate(name as any, params);
                    }
                  } catch {}
                }
                return;
              }

              const elapsed = lastUnlock ? now - Number(lastUnlock) : Infinity;
              if (elapsed > requiredMs) {
                // require unlock, ensure lastRoute exists (fallback to Home)
                const saved = await loadLastRoute();
                if (!saved) {
                  await saveLastRoute(
                    JSON.stringify({ name: 'Home', params: undefined }),
                  );
                }
                if (navigationRef.isReady()) {
                  navigationRef.navigate('Unlock');
                } else {
                  await new Promise(res => setTimeout(res, 50));
                  if (navigationRef.isReady()) navigationRef.navigate('Unlock');
                }
                return;
              }

              // not expired -> restore saved route
              const saved = await loadLastRoute();
              if (saved) {
                try {
                  const { name, params } = JSON.parse(saved);
                  if (navigationRef.isReady()) {
                    const cur = navigationRef.getCurrentRoute();
                    if (!cur || cur.name !== name) {
                      navigationRef.navigate(name as any, params);
                    }
                  }
                } catch {}
              }
              return;
            } else {
              // no wallet -> onboarding
              await saveAuthRequirement('never');
              const saved = await loadLastRoute();
              if (saved) {
                try {
                  const { name, params } = JSON.parse(saved);
                  if (navigationRef.isReady()) {
                    navigationRef.navigate(name as any, params);
                    return;
                  }
                } catch {}
              }
              if (navigationRef.isReady()) {
                navigationRef.navigate('Onboarding');
              }
              return;
            }
          }
        } catch (e) {
          console.log('AppState-handler-error', e);
          // swallow errors to avoid app crash on state transitions
        }
      };

      const sub = AppState.addEventListener('change', handler);

      // cleanup function
      return () => {
        try {
          sub?.remove();
        } catch {}
      };
    }; // run()

    const cleanupPromise = run();

    return () => {
      // Component unmount: mark removed and clear session so next run knows it was graceful
      markAppClosed('removed').catch(() => {});
      clearSession().catch(() => {});

      // call cleanup if run returned one
      Promise.resolve(cleanupPromise).then(cleanup => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
  }, []);

  // If an update is mandatory, block the rest of the app
  if (isMandatory) {
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
