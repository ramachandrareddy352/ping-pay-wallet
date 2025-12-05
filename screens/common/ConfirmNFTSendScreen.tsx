import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import NetInfo from '@react-native-community/netinfo';
import { WebView } from 'react-native-webview';
import bs58 from 'bs58';
import Toast from 'react-native-toast-message';
import Video from 'react-native-video';

import { loadWallet } from '../../utils/storage';
import { getRpcUrl } from '../../utils/common';
import { fetchNFTMetadata } from '../../utils/fetch_nft';

import { RootStackParamList } from '../../types/navigation';
import { NFTMetadata, NFTMetadataResponse } from '../../types/dataTypes';

import BackArrowIcon from '../../assets/icons/back-arrow.svg';
import Offline from '../../assets/icons/offline.svg';
import BottomNavBar from '../../components/BottomNavBar';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmNFTSend'>;

const { width } = Dimensions.get('window');

const ConfirmNFTSendScreen = ({ route, navigation }: Props) => {
  const { toAddress, NFTMint } = route.params;

  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [txHash, setTxHash] = useState('');
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [fromAddress, setFromAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<'devnet' | 'mainnet-beta'>('devnet');
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

  useEffect(() => {
    const loadWalletData = async () => {
      try {
        const wallet = await loadWallet();
        if (wallet && wallet.accounts && wallet.accounts.length > 0) {
          setFromAddress(wallet.currentAccountId); // Use first account as default
          setNetwork(wallet.network || 'devnet');
        } else {
          throw new Error('No accounts found in wallet');
        }
      } catch (err) {
        console.log('Error loading wallet:', err);
        Toast.show({ type: 'error', text1: 'Failed to load wallet data' });
      }
    };

    loadWalletData();
  }, []);

  useEffect(() => {
    if (NFTMint && network && isConnected) {
      const fetchData = async () => {
        setLoadingMetadata(true);
        const result: NFTMetadataResponse = await fetchNFTMetadata(
          NFTMint,
          getRpcUrl(network),
        );

        if (result.success && result.data) {
          setMetadata(result.data);
        } else {
          setMetadata(null);
          Toast.show({
            type: 'error',
            text1: result.error || 'Failed to load NFT',
          });
        }

        setLoadingMetadata(false);
      };

      fetchData();
    }
  }, [NFTMint, network, isConnected]);

  const handleSendTransaction = async () => {
    if (!isConnected) return;

    if (!fromAddress) {
      Toast.show({ type: 'error', text1: 'No sender address available' });
      return;
    }

    try {
      setSending(true);

      const wallet = await loadWallet();
      const currentAccount = wallet?.accounts.find(
        (a: any) => a.publicKey === fromAddress,
      );
      if (!currentAccount) throw new Error('Wallet not found');

      const connection = new Connection(getRpcUrl(network), 'confirmed');
      const payer = Keypair.fromSecretKey(
        bs58.decode(currentAccount.secretKey),
      );

      const mintKey = new PublicKey(NFTMint);

      // Detect token program (Token22 or Token Classic)
      const mintInfo = await connection.getAccountInfo(mintKey);
      let tokenProgramId = TOKEN_PROGRAM_ID;

      if (mintInfo && mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        tokenProgramId = TOKEN_2022_PROGRAM_ID;
      }

      const recipient = new PublicKey(toAddress);
      const isPDA = !PublicKey.isOnCurve(recipient);

      // Fetch or create ATAs
      const sourceATA = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintKey,
        payer.publicKey,
        true,
        undefined,
        undefined,
        tokenProgramId,
      );

      const destinationATA = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintKey,
        recipient,
        isPDA,
        undefined,
        undefined,
        tokenProgramId,
      );

      // Create transfer instruction (NFT = amount 1)
      const transaction = new Transaction().add(
        createTransferInstruction(
          sourceATA.address,
          destinationATA.address,
          payer.publicKey,
          1,
          [],
          tokenProgramId, // FIXED: must use detected token program
        ),
      );

      // Latest blockhash (correct RN-safe pattern)
      const latest = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latest.blockhash;
      transaction.feePayer = payer.publicKey;

      transaction.sign(payer);

      const rawTx = transaction.serialize();

      // Send raw tx
      const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 5,
      });

      // Confirm transaction (no timeout issues)
      await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        'confirmed',
      );

      setSuccess(true);
      setTxHash(signature);

      Toast.show({
        type: 'success',
        text1: 'NFT sent successfully!',
      });
    } catch (err: any) {
      console.log('Send error:', err);
      Toast.show({
        type: 'error',
        text1: err?.message ?? 'Transaction failed',
      });

      setSuccess(false);
      setTxHash('');
    } finally {
      setSending(false);
    }
  };

  const renderMedia = () => {
    if (!metadata) return null;
    const firstFile =
      metadata.files && metadata.files.length > 0 ? metadata.files[0] : null;
    const mediaUri =
      firstFile?.cdn_uri || firstFile?.uri || metadata.image || null;
    const mime = firstFile?.mime || '';

    if (!mediaUri) {
      return (
        <View className="w-full h-48 bg-gray-800 rounded-lg items-center justify-center">
          <Text className="text-gray-400">No media available</Text>
        </View>
      );
    }

    if (
      mime.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif)$/i.test(mediaUri)
    ) {
      if (
        mediaUri?.startsWith('https://ipfs.io') ||
        mime.includes('gif') ||
        /\.gif$/i.test(mediaUri)
      ) {
        return (
          <View
            style={{
              width: '100%',
              height: 200,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: '#000', // for better contrast while loading gifs
            }}
          >
            <WebView
              source={{ uri: mediaUri }}
              style={{ flex: 1 }}
              scrollEnabled={false}
            />
          </View>
        );
      }

      // ✅ Full image (no cropping)
      return (
        <View
          style={{
            width: width - 32,
            height: 200,
            borderRadius: 12,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000', // helps keep aspect ratio visible
          }}
        >
          <Image
            source={{ uri: mediaUri }}
            style={{
              width: '100%',
              height: '100%',
              resizeMode: 'contain', // shows full image without cropping
            }}
          />
        </View>
      );
    }

    if (mime.startsWith('video/') || /\.mp4$/i.test(mediaUri)) {
      return (
        <View
          style={{
            width: width - 32,
            height: 200,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          <Video
            source={{ uri: mediaUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            controls
          />
        </View>
      );
    }

    // Fallback: show webview for anything else
    return (
      <View
        style={{
          width: '100%',
          height: 200,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <WebView source={{ uri: mediaUri }} style={{ flex: 1 }} />
      </View>
    );
  };

  const renderTransactionInfo = () => (
    <View className="bg-gray-900 p-4 rounded-2xl mt-4 space-y-2">
      {fromAddress && (
        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">From</Text>
          <Text className="text-white">
            {fromAddress.slice(0, 4)}...{fromAddress.slice(-4)}
          </Text>
        </View>
      )}
      <View className="flex-row justify-between py-1">
        <Text className="text-gray-400">To</Text>
        <Text className="text-white">
          {toAddress.slice(0, 4)}...{toAddress.slice(-4)}
        </Text>
      </View>
      <View className="flex-row justify-between py-1">
        <Text className="text-gray-400">NFT</Text>
        <Text className="text-white">{metadata?.name || 'Unknown NFT'}</Text>
      </View>
      <View className="flex-row justify-between py-1">
        <Text className="text-gray-400">Mint</Text>
        <Text className="text-white">
          {NFTMint.slice(0, 4)}...{NFTMint.slice(-4)}
        </Text>
      </View>
      <View className="flex-row justify-between py-1">
        <Text className="text-gray-400">Network</Text>
        <Text className="text-white capitalize">{network}</Text>
      </View>
      <View className="flex-row justify-between py-1">
        <Text className="text-gray-400">Estimated Fee</Text>
        <Text className="text-white">0.0001 SOL</Text>
      </View>
    </View>
  );

  // --- Success / Failure screen ---
  const renderStatusScreen = () => {
    if (success === true)
      return (
        <View className="flex-1 bg-black items-center justify-center px-6">
          <Image
            source={require('../../assets/images/success-logo.png')}
            style={{ width: 120, height: 120 }}
          />
          <Text className="text-green-400 mt-5 font-semibold text-2xl">
            Sent Successfully!
          </Text>
          <Text className="text-gray-400 mt-2 text-sm">
            Tx: {txHash.slice(0, 8)} **** {txHash.slice(-8)}
          </Text>

          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                `https://explorer.solana.com/tx/${txHash}${
                  network === 'mainnet-beta' ? '' : '?cluster=devnet'
                }`,
              )
            }
            className="mt-3"
          >
            <Text className="text-[#9707B5] underline">View on Explorer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            className="bg-[#9707B5] py-3 px-10 rounded-full mt-8"
          >
            <Text className="text-white text-lg font-semibold text-center">
              Done
            </Text>
          </TouchableOpacity>
        </View>
      );

    if (success === false)
      return (
        <View className="flex-1 bg-black items-center justify-center px-6">
          <Image
            source={require('../../assets/images/failed-image.png')}
            style={{ width: 110, height: 110 }}
          />
          <Text className="text-red-500 mt-5 font-semibold text-2xl">
            Transaction Failed
          </Text>
          <Text className="text-gray-400 mt-2 text-sm text-center">
            Something went wrong while sending your transaction.
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('SendRecipient', {
                mintAddress: NFTMint,
                isNFT: true,
              })
            }
            className="bg-[#9707B5] py-3 px-10 rounded-full mt-8"
          >
            <Text className="text-white text-lg font-semibold text-center">
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );

    return null;
  };

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

  // --- Main Content (only visible before sending completes) ---
  if (success !== null) return renderStatusScreen();

  return (
    <View className="flex-1 bg-black px-4 py-6">
      {/* Header */}
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('SendRecipient', {
            mintAddress: NFTMint,
            isNFT: true,
          })
        }
        className="flex-row items-center mb-6 gap-3"
      >
        <BackArrowIcon width={16} height={16} />
        <Text className="text-white text-lg font-semibold">
          Confirm Send NFT
        </Text>
      </TouchableOpacity>

      {/* NFT Media and Name */}
      <View className="items-center my-3">
        {loadingMetadata ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : (
          <>
            {renderMedia()}
            <Text className="text-4xl text-white font-bold mt-3">
              {metadata?.name || 'Unknown NFT'}
            </Text>
            <Text className="text-gray-400 mt-2">{metadata?.symbol || ''}</Text>
          </>
        )}
      </View>

      {renderTransactionInfo()}

      {/* Action buttons */}
      <View className="mt-10 flex-row justify-between items-center">
        {/* Cancel */}
        <TouchableOpacity
          disabled={sending}
          onPress={() =>
            navigation.navigate('SendRecipient', {
              mintAddress: NFTMint,
              isNFT: true,
            })
          }
          className="border border-gray-600 w-[48%] py-3 rounded-full"
        >
          <Text className="text-center text-white font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>

        {/* Send */}
        <TouchableOpacity
          disabled={sending || loadingMetadata || !fromAddress}
          onPress={handleSendTransaction}
          className={`w-[48%] py-3 rounded-full ${
            sending || !fromAddress ? 'bg-[#9707B5]' : 'bg-[#9707B5]'
          }`}
        >
          {sending ? (
            <View className="flex-row justify-center items-center">
              <ActivityIndicator size="small" color="#fff" />
              <Text className="text-white ml-2 font-semibold text-lg">
                Sending...
              </Text>
            </View>
          ) : (
            <Text className="text-center text-white font-semibold text-lg">
              Confirm
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ConfirmNFTSendScreen;
