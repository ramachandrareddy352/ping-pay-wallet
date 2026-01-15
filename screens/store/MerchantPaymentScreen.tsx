import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  ImageBackground,
  Pressable,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';

import { RootStackParamList } from '../../types/navigation';
import { loadWallet } from '../../utils/storage';
import { getRpcUrl } from '../../utils/common';

import BackArrowIcon from '../../assets/icons/back-arrow.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import UsernameFrame from '../../assets/images/user-logo.png';
import { fetchTransaction } from '@solana/pay';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantPayment'>;

const MAINNET_MEA_MINT = 'mecySk7eSawDNfAXvW3CquhLyxyKaXExFXgUUbEZE1T';
const DEVNET_MEA_MINT = 'DUbbqANBKJqAUCJveSEFgVPGHDwkdc6d9UiQyxBLcyN3';
const BASE_IMAGE_URL =
  'https://meapay-merchant-prod.s3.ap-northeast-2.amazonaws.com';

// Local screenshot path (you uploaded earlier in the session)
const LOCAL_SCREENSHOT_PATH = '/mnt/data/Screenshot 2025-11-21 172622.png';

const ownerEquals = (info: any, pubkey: PublicKey | null) => {
  if (!info || !info.owner || !pubkey) return false;
  try {
    return info.owner.equals(pubkey);
  } catch {
    const ownerBytes = info.owner;
    return (
      ownerBytes &&
      Buffer.from(ownerBytes).equals(
        Buffer.from(pubkey.toBuffer ? pubkey.toBuffer() : []),
      )
    );
  }
};

const MerchantPaymentScreen = ({ navigation, route }: Props) => {
  const { merchantAddress, merchantDetails } = route.params;

  const [usdtAmount, setUsdtAmount] = useState('');
  const [meaAmount, setMeaAmount] = useState('');
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [pricePerMea, setPricePerMea] = useState(0);
  const [userMeaBalance, setUserMeaBalance] = useState(0);
  const [currentAccount, setCurrentAccount] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [isAcknowledgmentEnabled, setIsAcknowledgmentEnabled] = useState(false);

  const [txSuccess, setTxSuccess] = useState<boolean | null>(null);
  const [txHash, setTxHash] = useState('');

  const network = wallet?.network || 'mainnet-beta';
  const meaMint = network === 'devnet' ? DEVNET_MEA_MINT : MAINNET_MEA_MINT;
  const mintPubkey = new PublicKey(meaMint);

  // Load wallet
  useEffect(() => {
    const load = async () => {
      const w = await loadWallet();
      if (w) {
        setWallet(w);
        const acc = w.accounts.find((a: any) => a.id === w.currentAccountId);
        setCurrentAccount(acc);
      }
    };
    load();
  }, []);

  // Fetch MEA price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setLoadingPrice(true);
        const cgRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=mecca&vs_currencies=usd',
        );
        const cgData = await cgRes.json();
        if (cgData.mecca?.usd) {
          setPricePerMea(cgData.mecca.usd);
        } else {
          setPricePerMea(0.00052);
        }
      } catch (err) {
        setPricePerMea(0.00052);
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch user MEA balance
  useEffect(() => {
    if (!currentAccount || !wallet) return;

    const fetchMeaBalance = async () => {
      try {
        const response = await fetch(getRpcUrl(network), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '1',
            method: 'getAssetsByOwner',
            params: {
              ownerAddress: currentAccount.publicKey,
              page: 1,
              limit: 1000,
              options: { showFungible: true },
            },
          }),
        });

        if (!response.ok) return;
        const { result } = await response.json();

        const meaItem = (result.items || []).find(
          (item: any) =>
            item.id === meaMint ||
            (item.token_info && item.token_info.mint === meaMint),
        );

        if (meaItem && meaItem.token_info?.balance) {
          const decimals = meaItem.token_info.decimals ?? 6;
          const balance = meaItem.token_info.balance / Math.pow(10, decimals);
          setUserMeaBalance(balance);
        } else {
          setUserMeaBalance(0);
        }
      } catch (err) {
        setUserMeaBalance(0);
      }
    };

    fetchMeaBalance();
  }, [currentAccount, network, meaMint]);

  // Update MEA amount from USDT input
  useEffect(() => {
    if (usdtAmount && pricePerMea > 0) {
      const amount = parseFloat(usdtAmount);
      if (!isNaN(amount) && amount > 0) {
        const mea = amount / pricePerMea;
        setMeaAmount(mea.toFixed(4));
      } else {
        setMeaAmount('');
      }
    } else {
      setMeaAmount('');
    }
  }, [usdtAmount, pricePerMea]);

  const isValidAmount = () => {
    const num = parseFloat(usdtAmount);
    return !isNaN(num) && num > 0;
  };

  const hasSufficientBalance = () => {
    const num = parseFloat(meaAmount || '0');
    return !isNaN(num) && num <= userMeaBalance;
  };

  const canConfirm =
    isValidAmount() && hasSufficientBalance() && isAcknowledgmentEnabled;

  // Detect Token Program (2022 vs legacy)
  const detectMintProgram = async (connection: Connection, mint: PublicKey) => {
    try {
      const acctInfo = await connection.getAccountInfo(mint);
      if (acctInfo && acctInfo.owner) {
        if (acctInfo.owner.equals(TOKEN_2022_PROGRAM_ID))
          return TOKEN_2022_PROGRAM_ID;
        if (acctInfo.owner.equals(TOKEN_PROGRAM_ID)) return TOKEN_PROGRAM_ID;
      }

      return TOKEN_PROGRAM_ID;
    } catch (err) {
      return TOKEN_PROGRAM_ID;
    }
  };

  // Notify backend after successful payment
  const notifyPaymentToBackend = async (usdtAmt: number, slug: string) => {
    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');

    const raw = JSON.stringify({
      amount: usdtAmt,
      slug: slug,
    });

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow' as const, // Important for some proxies/CDNs
      // These help on Android with bad SSL
      // @ts-ignore – React Native supports these internally
      cache: 'no-cache',
    };

    try {
      console.log('Notifying backend with:', { amount: usdtAmt, slug });

      const response = await fetch(
        'https://api-platform.pingpay.info/public/payment/initiate',
        requestOptions,
      );

      const result = await response.json();
      console.log('Backend response:', result);

      if (!response.ok) {
        console.log('Backend returned error status:', response.status);
      } else {
        console.log('Payment successfully reported to merchant backend');
      }

      return result.body.paymentLink;
    } catch (error: any) {
      console.log(
        "Failed to notify backend (this won't affect your payment):",
        error.message || error,
      );
      return null;
      // Do NOT throw or break UX – Solana tx already succeeded
    }
  };

  const handlePay = async () => {
    if (!wallet || wallet?.network === 'devnet') {
      Toast.show({
        type: 'error',
        text1: 'Please change the network to Mainnet',
      });
      return;
    }

    if (!canConfirm || !currentAccount || !merchantDetails?.slug) {
      Toast.show({
        type: 'error',
        text1: 'Invalid payment state or missing slug',
      });
      return;
    }

    setSending(true);

    try {
      const connection = new Connection(getRpcUrl(network), 'confirmed');
      const payer = Keypair.fromSecretKey(
        bs58.decode(currentAccount.secretKey),
      );
      const recipientPubkey = new PublicKey(merchantAddress);

      // -------------------------------
      // 1. DETECT TOKEN PROGRAM
      // -------------------------------
      const detectedTokenProgram = await detectMintProgram(
        connection,
        mintPubkey,
      );
      const tokenProgramId = detectedTokenProgram.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      // -------------------------------
      // 2. GET SOURCE + DESTINATION ATA
      // -------------------------------
      const sourceATA = await getAssociatedTokenAddress(
        mintPubkey,
        payer.publicKey,
        false,
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintPubkey,
        recipientPubkey,
        true,
        undefined,
        undefined,
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const srcInfo = await connection.getAccountInfo(sourceATA);
      if (!srcInfo) throw new Error('Source token account not found.');

      // -------------------------------
      // 3. Notify backend (non-blocking)
      // -------------------------------
      const usdtValue = parseFloat(usdtAmount);
      const paymentLink = await notifyPaymentToBackend(
        usdtValue,
        merchantDetails.slug,
      );
      if (!paymentLink) {
        throw new Error('Merchant backend did not return payment link.');
      }

      // -------------------------------
      // 4. FETCH THE PARTIALLY SIGNED TX
      // -------------------------------
      const txs = await fetchTransaction(
        connection,
        new PublicKey(payer.publicKey),
        paymentLink,
      );
      if (!txs)
        throw new Error('Failed to load transaction from merchant backend.');

      // IMPORTANT: serialize without requiring all signatures so we preserve partial signatures
      const serializedMerchant = txs.serialize({ requireAllSignatures: false });
      const base64 = Buffer.from(serializedMerchant).toString('base64');
      const txBytes = Buffer.from(base64, 'base64');
      let tx = Transaction.from(txBytes);

      // -------------------------------
      // 5. DO NOT OVERWRITE merchant's signing context
      //    Only set feePayer / recentBlockhash if they are MISSING.
      // -------------------------------
      if (!tx.feePayer) {
        tx.feePayer = payer.publicKey;
        console.log('feePayer was missing; set to payer.publicKey');
      } else {
        console.log(
          'feePayer already present in merchant tx:',
          tx.feePayer.toBase58(),
        );
      }

      if (!tx.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        console.log('recentBlockhash was missing; fetched and set.');
      } else {
        console.log(
          'recentBlockhash already present in merchant tx:',
          tx.recentBlockhash,
        );
      }

      // -------------------------------
      // 6. LOG & VERIFY SIGNATURE STATUS BEFORE WALLET SIGNS
      // -------------------------------
      console.log('---- REQUIRED SIGNERS (before wallet signs) ----');
      tx.signatures.forEach((sig, idx) => {
        console.log(
          `Signer[${idx}]`,
          sig.publicKey.toBase58(),
          sig.signature ? 'SIGNED' : 'NOT SIGNED',
        );
      });

      const missingBefore = tx.signatures.filter(s => !s.signature);
      if (missingBefore.length > 1) {
        // More than one missing -> merchant didn't partial sign, cannot proceed
        throw new Error(
          'Merchant did NOT partially sign the transaction. Ask merchant to sign/regenerate.',
        );
      }

      // -------------------------------
      // 7. ADD WALLET SIGNATURE USING partialSign (DO NOT USE sign)
      // -------------------------------
      // partialSign appends this wallet signature without invalidating existing ones.
      tx.partialSign(payer);
      console.log('Wallet partialSign applied.');

      // -------------------------------
      // 8. LOG & VERIFY SIGNATURE STATUS AFTER WALLET SIGNS
      // -------------------------------
      console.log('---- FINAL SIGNERS (after wallet partialSign) ----');
      tx.signatures.forEach((sig, idx) => {
        console.log(
          `Final Signer[${idx}]`,
          sig.publicKey.toBase58(),
          sig.signature ? 'SIGNED' : 'NOT SIGNED',
        );
      });

      const missingAfter = tx.signatures.filter(s => !s.signature);
      if (missingAfter.length > 0) {
        // still missing -> merchant signature lost or merchant did not sign
        const missingKeys = missingAfter.map(s => s.publicKey.toBase58());
        throw new Error(
          `Transaction is still missing signatures for: ${missingKeys.join(
            ', ',
          )}.`,
        );
      }

      // -------------------------------
      // 9. FINAL SERIALIZE & SEND
      // -------------------------------
      const finalSerialized = tx.serialize({ requireAllSignatures: true });
      const signature = await connection.sendRawTransaction(finalSerialized, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      setTxSuccess(true);
      setTxHash(signature);
      Toast.show({ type: 'success', text1: 'Payment Successful' });
    } catch (err: any) {
      console.error('Payment failed:', err);
      const message = err?.message || JSON.stringify(err);
      Toast.show({
        type: 'error',
        text1: 'Payment Failed',
        text2:
          message.length > 100 ? message.substring(0, 97) + '...' : message,
      });
      setTxSuccess(false);
      setTxHash('');
    } finally {
      setSending(false);
    }
  };

  // Success / Failure Screen
  if (txSuccess !== null) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Image
          source={
            txSuccess
              ? require('../../assets/images/success-logo.png')
              : require('../../assets/images/failed-image.png')
          }
          style={{ width: 120, height: 120 }}
        />
        <Text
          className={`mt-8 text-3xl font-bold ${
            txSuccess ? 'text-green-400' : 'text-red-500'
          }`}
        >
          {txSuccess ? 'Payment Successful!' : 'Payment Failed'}
        </Text>
        {txSuccess && (
          <>
            <Text className="text-gray-400 mt-4 text-sm">
              Tx: {txHash.slice(0, 8)}...{txHash.slice(-8)}
            </Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(
                  `https://explorer.solana.com/tx/${txHash}${
                    network === 'devnet' ? '?cluster=devnet' : ''
                  }`,
                )
              }
              className="mt-3"
            >
              <Text className="text-purple-500 underline text-sm">
                View on Explorer
              </Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          onPress={() => navigation.replace('Home')}
          className="bg-[#9707B5] py-4 px-12 rounded-full mt-12"
        >
          <Text className="text-white text-lg font-bold">Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main UI
  return (
    <ScrollView className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-6 pb-2">
        <Pressable
          onPress={() => navigation.replace('Home')}
          className="w-6 items-center justify-center mr-3"
        >
          <BackArrowIcon width={16} height={16} fill="#FFF" />
        </Pressable>
        <Text className="text-white font-medium text-base">
          Merchant Payment
        </Text>
      </View>

      {/* Merchant Banner */}
      <ImageBackground
        source={{
          uri: merchantDetails?.banner
            ? `${BASE_IMAGE_URL}/${merchantDetails.banner}`
            : `file://${LOCAL_SCREENSHOT_PATH}`,
        }}
        className="h-32 rounded-2xl overflow-hidden mx-4"
        resizeMode="cover"
      >
        <View className="flex-1 bg-black/50 justify-end p-4">
          <View className="flex-row items-center">
            <Image
              source={{
                uri: merchantDetails?.businessImage
                  ? `${BASE_IMAGE_URL}/${merchantDetails.businessImage}`
                  : undefined,
              }}
              defaultSource={UsernameFrame}
              className="w-12 h-12 rounded-xl mr-3"
            />
            <View>
              <Text className="text-white text-xl font-bold">
                {merchantDetails?.businessName || 'Merchant'}
              </Text>
              <Text className="text-green-400 text-sm">
                ✔ Verified Merchant
              </Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      {/* Payer Account */}
      {currentAccount && (
        <View className="mx-4 mt-4 bg-[#181920] rounded-2xl px-4 py-2">
          <Text className="text-gray-400 text-sm mb-2">Payer</Text>
          <View className="flex-row items-center">
            <Image
              source={
                currentAccount.imageUri
                  ? { uri: currentAccount.imageUri }
                  : UsernameFrame
              }
              className="w-10 h-10 rounded-full mr-4"
            />
            <View className="flex-1">
              <Text className="text-white font-bold text-sm">
                {currentAccount.name}
              </Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-gray-400 text-sm">
                  {currentAccount.publicKey.slice(0, 6)}...
                  {currentAccount.publicKey.slice(-4)}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Clipboard.setString(currentAccount.publicKey);
                    Toast.show({ type: 'success', text1: 'Address copied' });
                  }}
                  className="ml-2"
                >
                  <CopyIcon width={16} height={16} fill="#888" />
                </TouchableOpacity>
              </View>
            </View>
            <View className="px-3 py-1 rounded-md bg-[#9707B5]/30 border border-[#9707B5]/50">
              <Text className="text-[#9707B5] font-semibold text-xs">
                {network}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Amount Input */}
      <View className="mx-4 mt-4 bg-[#181920] rounded-2xl px-4 py-3 items-center">
        <Text className="text-gray-400 text-sm self-start mb-2">
          Amount in USDT
        </Text>

        <TextInput
          value={usdtAmount}
          onChangeText={setUsdtAmount}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor="#666"
          className="text-white text-4xl font-bold text-center w-full mb-2"
        />

        <View className="flex-row items-center justify-center mt-2">
          <Text className="text-gray-400 text-base">You pay ≈ </Text>
          <Text className="text-white text-medium font-bold">
            {meaAmount || '0.0000'} MEA
          </Text>
        </View>

        <Text className="text-gray-500 text-sm text-center mt-2">
          Balance: {userMeaBalance.toFixed(4)} MEA
        </Text>
      </View>

      {/* Acknowledgment */}
      <View className="mx-4 mt-4 bg-yellow-900/20 border border-yellow-600 rounded-2xl px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-yellow-400 font-bold text-sm flex-1">
            NOTE: Payment is made using MEA tokens only
          </Text>
          <Switch
            value={isAcknowledgmentEnabled}
            onValueChange={setIsAcknowledgmentEnabled}
            trackColor={{ false: '#333', true: '#9707B5' }}
            thumbColor={isAcknowledgmentEnabled ? '#fff' : '#666'}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-3 mx-4 mt-12 mb-8">
        <TouchableOpacity
          onPress={() => navigation.replace('Home')}
          className="flex-1 bg-gray-800 py-3 rounded-2xl items-center border border-gray-700"
        >
          <Text className="text-white font-bold text-lg">Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePay}
          disabled={!canConfirm || sending}
          className={`flex-1 py-3 rounded-2xl items-center ${
            !canConfirm || sending ? 'bg-gray-700' : 'bg-[#9707B5]'
          }`}
        >
          {sending ? (
            <View className="flex-row items-center">
              <ActivityIndicator color="#fff" size="small" />
              <Text className="text-white ml-3 font-bold text-lg">
                Sending...
              </Text>
            </View>
          ) : (
            <Text className="text-white font-bold text-lg">Confirm</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default MerchantPaymentScreen;
