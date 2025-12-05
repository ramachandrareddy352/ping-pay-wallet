import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { RootStackParamList } from '../../types/navigation';
import { validateSolanaAddress } from '../../utils/helper';
import { loadWallet } from '../../utils/storage';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { fetchTransaction } from '@solana/pay';
import { getRpcUrl } from '../../utils/common';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

type Props = NativeStackScreenProps<RootStackParamList, 'ScanQr'>;

// Reusable merchant check
async function checkIfMerchant(address: string): Promise<{
  isMerchant: boolean;
  details: any;
}> {
  try {
    const url = `https://api-platform.pingpay.info/public/payment/merchant/${address}`;
    const res = await fetch(url);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.success && json.body) {
        return { isMerchant: true, details: json.body };
      }
    } catch {}
    return { isMerchant: false, details: null };
  } catch {
    return { isMerchant: false, details: null };
  }
}

// Parse solana: URI properly
function parseSolanaUri(uri: string) {
  if (!uri.startsWith('solana:')) return null;
  const payload = uri.slice('solana:'.length);
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

export default function ScanQrScreen({ navigation, route }: Props) {
  const { mintAddress, isNFT } = route.params || {};
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const lastScanned = useRef<string | null>(null);

  // Load wallet once
  const walletRef = useRef<any>(null);
  const connectionRef = useRef<Connection | null>(null);

  useEffect(() => {
    (async () => {
      const wallet = await loadWallet();
      if (!wallet || !wallet.currentAccountId) {
        Toast.show({
          type: 'error',
          text1: 'No wallet found or account selected.',
        });
        navigation.replace('Home');
        return;
      }
      walletRef.current = wallet;
      connectionRef.current = new Connection(
        getRpcUrl(wallet.network),
        'confirmed',
      );
    })();
  }, []);

  const handleScanned = async (rawValue: string) => {
    if (!rawValue || rawValue === lastScanned.current) return;
    lastScanned.current = rawValue;

    const wallet = walletRef.current;
    const connection = connectionRef.current;
    if (!wallet || !connection) {
      Toast.show({ type: 'error', text1: 'Wallet not ready' });
      return;
    }

    try {
      // Case 1: Plain Solana address
      if (validateSolanaAddress(rawValue)) {
        const { isMerchant, details } = await checkIfMerchant(rawValue);
        if (isMerchant && details) {
          navigation.replace('MerchantPayment', {
            merchantAddress: rawValue,
            merchantDetails: details,
          });
        } else {
          if (isNFT) {
            navigation.replace('ConfirmNFTSend', {
              toAddress: rawValue,
              NFTMint: mintAddress,
            });
          } else {
            navigation.replace('SendInputAmount', {
              recipient: rawValue,
              mintAddress,
            });
          }
        }
        return;
      }

      // Case 2: solana: URI → could be address or payment request
      if (rawValue.startsWith('solana:')) {
        const decoded = parseSolanaUri(rawValue);
        if (!decoded) {
          Toast.show({ type: 'error', text1: 'Invalid solana: URI' });
          return;
        }

        // Extract recipient from solana:ADDRESS?...
        const [recipientPart] = decoded.split('?');
        if (validateSolanaAddress(recipientPart)) {
          const { isMerchant, details } = await checkIfMerchant(recipientPart);
          if (isMerchant && details) {
            navigation.replace('MerchantPayment', {
              merchantAddress: recipientPart,
              merchantDetails: details,
            });
          } else {
            if (isNFT) {
              navigation.replace('ConfirmNFTSend', {
                toAddress: recipientPart,
                NFTMint: mintAddress,
              });
            } else {
              navigation.replace('SendInputAmount', {
                recipient: recipientPart,
                mintAddress,
              });
            }
          }
          return;
        }

        // If not a direct address → likely a Solana Pay transaction request
        const link = decoded.startsWith('http') ? decoded : rawValue;
        const tx = await fetchTransaction(
          connection,
          new PublicKey(wallet.currentAccountId),
          link,
        );

        if (tx) {
          const serialized = tx.serialize({ requireAllSignatures: false });
          const base64 = Buffer.from(serialized).toString('base64');
          navigation.replace('ConfirmTransaction', {
            transactionBase64: base64,
            requestUrl: link,
          });
        } else {
          Toast.show({ type: 'error', text1: 'Invalid transaction request' });
        }
        return;
      }

      // Case 3: Direct HTTPS transaction request (Solana Pay)
      if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
        try {
          console.log(rawValue);
          const tx = await fetchTransaction(
            connection,
            new PublicKey(wallet.currentAccountId),
            rawValue,
          );

          if (tx) {
            const serialized = tx.serialize({ requireAllSignatures: false });
            const base64 = Buffer.from(serialized).toString('base64');
            navigation.replace('ConfirmTransaction', {
              transactionBase64: base64,
              requestUrl: rawValue,
            });
          } else {
            Toast.show({ type: 'error', text1: 'Failed to load transaction' });
          }
        } catch (err) {
          Toast.show({ type: 'error', text1: 'Unsupported QR code format' });
        }
        return;
      }

      // Fallback
      Toast.show({ type: 'error', text1: 'Invalid or unsupported QR code' });
    } catch (error: any) {
      console.error('QR Scan Error:', error);
      Toast.show({
        type: 'error',
        text1: error.message || 'Failed to process QR code',
      });
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      const value = codes[0]?.value;
      if (value) handleScanned(value);
    },
  });

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  if (!device || !hasPermission) {
    return (
      <View className="flex-1 bg-black justify-center items-center px-5">
        <Text className="text-white mb-4 text-center">
          Please grant camera permission to scan QR codes.
        </Text>

        <TouchableOpacity
          className="bg-[#9707B5] py-3 px-5 rounded-full mb-3"
          onPress={() => requestPermission()}
        >
          <Text className="text-white font-semibold">Grant Camera Access</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-gray-700 py-3 px-16 rounded-full"
          onPress={() => navigation.replace('Home')}
        >
          <Text className="text-white font-semibold">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Camera
        style={{ flex: 1 }}
        device={device}
        isActive={true}
        codeScanner={codeScanner}
        enableZoomGesture={false}
      />

      <View className="absolute mt-4 left-0 right-0 px-5 flex-row justify-between items-center">
        <Text className="text-white text-lg font-semibold">Scan QR</Text>
        <TouchableOpacity onPress={() => navigation.replace('Home')}>
          <Text className="text-white text-4xl font-bold">×</Text>
        </TouchableOpacity>
      </View>

      <View className="absolute top-0 left-0 right-0 bottom-0 flex-1 justify-center items-center">
        <View className="w-64 h-64 relative">
          <View className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-xl" />
          <View className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-xl" />
          <View className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-xl" />
          <View className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-xl" />
        </View>
      </View>

      <View className="absolute bottom-12 left-0 right-0 items-center">
        <TouchableOpacity
          className="bg-white/90 py-3 px-10 rounded-full"
          onPress={() => navigation.replace('Home')}
        >
          <Text className="text-black font-semibold text-base">Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
