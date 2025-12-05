import {
  SolanaSignAndSendTransaction,
  SolanaSignIn,
  SolanaSignMessage,
  SolanaSignTransaction,
  type SolanaSignInInput,
  type SolanaSignInOutput,
} from '@solana/wallet-standard-features';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  BackHandler,
  FlatList,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WebView } from 'react-native-webview';
import ExploreIcon from '../../assets/icons/search-icon.svg';
import GlobeIcon from '../../assets/icons/Globe.svg';
import Offline from '../../assets/icons/offline.svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
import { loadWallet, WalletData } from '../../utils/storage';
import React from 'react';
import BottomNavBar from '../../components/BottomNavBar';
import { Image } from 'react-native';
import { DappRequest, RpcMethod } from '../../lib/injected_provider';
import { DappRequestUtils } from '../../lib/injected_provider/dapp_request';
import { useSelector } from 'react-redux';
import { RootState } from '../../src/store/store';
import { useWallet } from '../../src/provider/Wallet';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import Toast from 'react-native-toast-message';
type Props = NativeStackScreenProps<RootStackParamList, 'Explore'>;

const predefinedSites = [
  {
    name: 'Meccain',
    url: 'https://meccain.com',
    icon: 'https://meccain.com/wp-content/uploads/2024/12/Mecca-favicon-e1735028744779-150x150.webp',
  },
  {
    name: 'PingPay',
    url: 'https://pingpay.info',
    icon: 'https://pingpay.info/wp-content/uploads/2025/07/pingo-pay-favicon-150x150.webp',
  },
  {
    name: 'Multilevel',
    url: 'https://mc.meccain.com',
    icon: 'https://meccain.com/wp-content/uploads/2024/12/Mecca-favicon-e1735028744779-150x150.webp',
  },
  {
    name: 'Rocket',
    url: 'https://mr.meccain.com',
    icon: 'https://mr.meccain.com/logo.webp',
  },
];

export default function ExploreScreen({ navigation }: Props) {
  const processingRef = useRef(false);
  const queueRef = useRef<DappRequest[]>([]);

  const walletDetails = useSelector((state: RootState) => state.wallet.data);
  const wallet = useWallet();
  const account = useMemo(() => {
    return walletDetails.accounts.find(
      acc => acc.id === walletDetails.currentAccountId,
    )!;
  }, [walletDetails]);

  const [injectedJavaScriptContent, setInjectedJavaScriptContent] =
    useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchUrl, setSearchUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);
  // Default to Google
  const [currentAccountId, setCurrentAccountId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // Monitor internet connection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (!state.isConnected) {
        Toast.show({
          type: 'error',
          text1: 'Check your Internet connection!',
        });
      }
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  const loadWalletBridge = async () => {
    try {
      // 👇 this resolves to a local file URI (like "file:///data/.../test.txt")
      const localUri = Image.resolveAssetSource(
        require('../../assets/scripts/test.txt'),
      ).uri;

      // 👇 fetch() can read file:// URIs on React Native
      const response = await fetch(localUri);
      const text = await response.text();

      setInjectedJavaScriptContent(text);
      console.log('✅ test.txt loaded dynamically as string');
    } catch (error) {
      console.log('❌ Error loading test.txt:', error);
    }
  };

  useEffect(() => {
    loadWalletBridge();
  }, []);

  // Load current account ID from storage
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const walletData: WalletData | null = await loadWallet();
        if (walletData && walletData.currentAccountId) {
          setCurrentAccountId(walletData.currentAccountId);
        } else {
          setCurrentAccountId(''); // Fallback to empty string if no account ID
        }
      } catch (error) {
        console.log('Error loading wallet:', error);
        setCurrentAccountId('');
      }
    };
    fetchWallet();
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    // Check if the input is a valid HTTPS URL
    const urlPattern = /^https:\/\/[^\s/$.?#].[^\s]*$/;
    if (urlPattern.test(searchQuery.trim())) {
      setSearchUrl(searchQuery.trim());
    } else {
      const url = `https://www.google.com/search?q=${encodeURIComponent(
        searchQuery.trim(),
      )}`;
      setSearchUrl(url);
    }
  };
  const handleSitePress = (url: string) => {
    setSearchUrl(url);
  };
  const clearSearch = () => {
    setSearchQuery('');
    setSearchUrl(null);
  };

  const [canGoBack, setCanGoBack] = useState(false);

  // Listen for navigation changes inside WebView
  const handleNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
  };

  // Handle hardware back press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack(); // 👈 Go back inside the WebView
          return true; // prevent RN from exiting the screen
        } else {
          if (searchUrl) {
            setSearchUrl(null);
            return true;
          }
          // If webview can't go back, fallback to app navigation
          // navigation?.goBack?.();
          navigation.replace('Home');
          return true;
        }
      },
    );

    return () => backHandler.remove();
  }, [canGoBack, searchUrl]);

  useEffect(() => {
    if (!loading && webViewRef.current && injectedJavaScriptContent) {
      webViewRef.current.injectJavaScript(injectedJavaScriptContent);
      console.log(
        'wallet_bridge.js injected successfully via injectJavaScript()',
      );
    }
  }, [injectedJavaScriptContent, loading]);

  const processDappRequest = async (request: DappRequest) => {
    console.log('processing dapp request ', request);
    await wallet.waitForWalletLoaded();
    console.log('wallet loaded continue');
    if (request.method === RpcMethod.Connect) {
      sendWalletData(
        JSON.stringify({
          id: request.id,
          result: {
            publicKey: account.publicKey.toString(),
          },
          error: null,
        }),
      );
    } else if (request.method === RpcMethod.Disconnect) {
      sendWalletData(
        JSON.stringify({
          id: request.id,
          result: {},
          error: null,
        }),
      );
    } else if (request.method === RpcMethod.SignMessage) {
      let decodedMessage = Buffer.from(
        request.params.message,
        'base64',
      ).toString();
      console.log('decoded message', decodedMessage);
      let signature = await wallet.signMessage(decodedMessage);
      console.log('signature here', signature);
      sendWalletData(
        JSON.stringify({
          id: request.id,
          result: signature ? Buffer.from(signature).toString('base64') : null,
          error: 'User rejected request',
        }),
      );
    } else if (request.method === RpcMethod.SignIn) {
      let input = request.params.input as SolanaSignInInput;
      let output = await wallet.signIn(input);
      if (output) {
        //verification failed recheck
        sendWalletData(
          JSON.stringify({
            id: request.id,
            result: output,
            error: null,
          }),
        );
      } else {
        sendWalletData(
          JSON.stringify({
            id: request.id,
            result: null,
            error: 'User rejected request',
          }),
        );
      }
    } else if (request.method === RpcMethod.SignTransaction) {
      let encodedTxString = request.params.transaction as string;
      let decodedTx: Transaction | VersionedTransaction;
      if (request.transactionType === 'legacy') {
        decodedTx = Transaction.from(Buffer.from(encodedTxString, 'base64'));
      } else {
        decodedTx = VersionedTransaction.deserialize(
          new Uint8Array(Buffer.from(encodedTxString, 'base64')),
        );
      }
      let signedTx = await wallet.signTransaction(decodedTx, {
        info: 'Sign Transaction Request',
        networkFees: '0.00005',
        values: [],
      });
      if (!signedTx) {
        sendWalletData(
          JSON.stringify({
            id: request.id,
            result: null,
            error: 'User rejected request',
          }),
        );
      } else {
        const serializedTransaction = Buffer.from(
          new Uint8Array(signedTx.serialize()),
        ).toString('base64');

        sendWalletData(
          JSON.stringify({
            id: request.id,
            result: serializedTransaction,
            error: null,
          }),
        );
      }
    } else if (request.method === RpcMethod.SignAndSendTransaction) {
      let encodedTxString = request.params.transaction as string;
      let decodedTx: Transaction | VersionedTransaction;
      if (request.transactionType === 'legacy') {
        decodedTx = Transaction.from(Buffer.from(encodedTxString, 'base64'));
      } else {
        decodedTx = VersionedTransaction.deserialize(
          new Uint8Array(Buffer.from(encodedTxString, 'base64')),
        );
      }
      let signature = await wallet.signAndSendTransaction(decodedTx, {
        info: 'Sign Transaction Request',
        networkFees: '0.00005',
        values: [],
      });
      if (!signature) {
        sendWalletData(
          JSON.stringify({
            id: request.id,
            result: null,
            error: 'User rejected request',
          }),
        );
      } else {
        sendWalletData(
          JSON.stringify({
            id: request.id,
            result: signature,
            error: null,
          }),
        );
      }
    }
  };
  /** Add a new DappRequest to the queue */
  const enqueueDappRequest = (request: DappRequest) => {
    queueRef.current.push(request);
    processDappQueue();
  };

  /** Process queued DappRequests sequentially */
  const processDappQueue = async () => {
    if (processingRef.current) return; // already running
    processingRef.current = true;

    try {
      while (queueRef.current.length > 0) {
        const request = queueRef.current.shift()!;
        try {
          await processDappRequest(request);
        } catch (err) {
          console.log('Error processing DappRequest:', err);
        }
      }
    } finally {
      processingRef.current = false;
    }
  };

  const handleWebViewMessage = (event: any) => {
    console.log('Message from WebView:', event.nativeEvent.data);
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      console.log('Parsed message:', msg);
      if (DappRequestUtils.isDappRequest(msg)) {
        enqueueDappRequest(msg);
      } else {
        console.log('not a valid dapp request', event);
      }
    } catch (error) {
      console.log('Error parsing message from WebView:', error);
    }
  };
  const sendWalletData = (data: string) => {
    if (!webViewRef.current) {
      console.log('webview not ready');
      return;
    }

    const escapedData = JSON.stringify(data); // properly escape quotes/newlines
    const script = `
    (function() {
      try {
        const event = new CustomEvent('message', { detail: ${escapedData} });
        window.dispatchEvent(event);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'jsResult', result: 'sent' }));
      } catch (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'jsError', error: String(error) }));
      }
    })();
    true;
  `;

    webViewRef.current.injectJavaScript(script);
  };

  const logOverride = `
  (function() {
    const originalLog = console.log;
    console.log = function(...args) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', args }));
      originalLog.apply(console, args);
    };
  })();
  true;
`;

  if (!isConnected) {
    return (
      <View className="flex-1 bg-black">
        <View className="flex-1 justify-center items-center">
          <Offline width={80} height={80} />
          <Text className="text-white text-lg mt-6 font-semibold">
            Please connect to the internet
          </Text>
        </View>
        <BottomNavBar active="Explore" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Search Bar */}
      <View className="px-4 pt-4 pb-2 bg-black">
        <View className="flex-row items-center bg-gray-800 rounded-lg p-1">
          <TextInput
            className="flex-1 ml-2 text-white text-base"
            placeholder="Search the web or enter URL..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={clearSearch} className="mr-2">
              <Text className="text-[#9707B5] font-medium">Clear</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleSearch} className="mr-2">
              <ExploreIcon width={20} height={20} fill="#9707B5" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content Section */}
      {!searchUrl ? (
        <View className="flex-1 px-4">
          {/* “Start browsing” indicator */}

          {/* Predefined Sites Grid - Max 4 per row */}
          <View className="flex-row flex-wrap justify-between mt-4">
            {predefinedSites.slice(0, 8).map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleSitePress(item.url)}
                className="w-[22%] p-4 aspect-square bg-gray-900 rounded-2xl items-center justify-center mb-4"
              >
                <Image
                  source={{ uri: item.icon }}
                  className="w-8 h-8 mb-2 rounded-md"
                />
                <Text
                  className="text-white text-xs text-center"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="items-center justify-center gap-3 py-6 flex-1">
            <GlobeIcon width={50} height={50} />
            <Text className="text-gray-400 text-base mt-3">
              Start browsing the web
            </Text>
          </View>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: searchUrl }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            if (webViewRef.current && injectedJavaScriptContent) {
              webViewRef.current.injectJavaScript(injectedJavaScriptContent);
              webViewRef.current.injectJavaScript(logOverride);
            }
          }}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          style={{ flex: 1 }}
        />
      )}

      <BottomNavBar active="Explore" />
    </View>
  );
}

{
  /* <WebView
        ref={webViewRef}
        source={{uri: searchUrl}}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          if (webViewRef.current && injectedJavaScriptContent) {
            webViewRef.current.injectJavaScript(injectedJavaScriptContent);
            // inject log override
            webViewRef.current.injectJavaScript(logOverride);
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onNavigationStateChange={handleNavigationStateChange}
        style={{flex: 1}}
        onMessage={handleWebViewMessage}
      /> */
}
