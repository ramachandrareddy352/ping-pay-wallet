import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import NetInfo from '@react-native-community/netinfo';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Transaction, Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import axios from 'axios';
import { loadWallet, WalletAccount, WalletData } from '../../utils/storage';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import Offline from '../../assets/icons/offline.svg';
import { getRpcUrl } from '../../utils/common';
import Toast from 'react-native-toast-message';

global.Buffer = Buffer;

function shorten(addr: string) {
  return addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';
}

function hexPreview(data: Buffer | string, length = 100) {
  if (!data) return '';
  const hex =
    typeof data === 'string' ? data : Buffer.from(data).toString('hex');
  return hex.length <= length ? hex : `${hex.slice(0, length)}...`;
}

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmTransaction'>;

export default function ConfirmTransactionScreen({ route, navigation }: Props) {
  const { transactionBase64, requestUrl } = route.params;

  const [metadata, setMetadata] = useState<any>({
    feePayer: '',
    recentBlockhash: '',
    totalInstructions: 0,
    totalAccounts: 0,
    accounts: [],
    programs: [],
    instructions: [],
  });

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [txHash, setTxHash] = useState('');
  const [balanceChanges, setBalanceChanges] = useState<any[]>([]);
  const [solanaPayData, setSolanaPayData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  const network = wallet?.network ?? 'devnet';
  const connection = new Connection(getRpcUrl(network), 'confirmed');

  // ----------------- LOAD WALLET -----------------
  useEffect(() => {
    (async () => {
      const w = await loadWallet();
      if (!w) {
        setError('No wallet found.');
        setIsLoading(false);
        return;
      }
      setWallet(w);

      const acc = w.accounts.find(a => a.id === w.currentAccountId);
      if (!acc) {
        setError('Current account not found.');
        setIsLoading(false);
        return;
      }
      setCurrentAccount(acc);
    })();
  }, []);

  // ----------------- NETWORK MONITOR -----------------
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      if (!state.isConnected) {
        Toast.show({ type: 'error', text1: 'Check internet connection!' });
      }
    });
    return () => unsub();
  }, []);

  // ----------------- FETCH SOLANA PAY INFO -----------------
  useEffect(() => {
    if (!requestUrl) return;
    axios
      .get(requestUrl)
      .then(res => {
        const hostname = requestUrl.replace(/^https?:\/\//, '').split('/')[0];
        setSolanaPayData({
          label: res.data.label || 'Unknown',
          icon: res.data.icon || '',
          url: hostname,
        });
      })
      .catch(err => console.log('Solana Pay fetch error:', err));
  }, [requestUrl]);

  // ----------------- PARSE TX + METADATA + PROCESSPAYMENT DECODE -----------------
  useEffect(() => {
    if (!transactionBase64 || !currentAccount) {
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        setIsLoading(true);

        const txBytes = Buffer.from(transactionBase64, 'base64');
        const tx = Transaction.from(txBytes);

        // METADATA RESTORE
        const accounts = tx.instructions.flatMap(i =>
          i.keys.map(k => k.pubkey.toBase58()),
        );
        const programs = tx.instructions.map(i => i.programId.toBase58());
        const instructions = tx.instructions.map(instr => ({
          programId: instr.programId.toBase58(),
          data: instr.data,
          accounts: instr.keys.map(k => ({
            pubkey: k.pubkey.toBase58(),
            isSigner: k.isSigner,
            isWritable: k.isWritable,
          })),
        }));

        setMetadata({
          feePayer: tx.feePayer?.toBase58() || currentAccount.publicKey,
          recentBlockhash: tx.recentBlockhash || 'Not set',
          totalInstructions: tx.instructions.length,
          totalAccounts: new Set(accounts).size,
          accounts: [...new Set(accounts)],
          programs: [...new Set(programs)],
          instructions,
        });

        // ------------------ DECODE PROCESS PAYMENT ONLY IF FROM pingpay ------------------
        if (
          typeof requestUrl === 'string' &&
          requestUrl.startsWith('https://api-platform.pingpay.info')
        ) {
          const ix0 = instructions[0];
          if (!ix0) throw new Error('Instruction[0] missing.');

          const data = ix0.data;
          if (data.length < 100)
            throw new Error('Instruction data too short for processPayment.');

          // discriminator
          const discBytes = data.slice(0, 8);
          const disc = bs58.encode(discBytes);
          if (disc !== 'YfcRsw3sAai') {
            throw new Error(`Unexpected instruction discriminator.`);
          }

          // reference
          const refLen = data.readUInt32LE(40);
          const refStart = 44;
          const referenceBytes = data.slice(refStart, refStart + refLen);
          const reference = referenceBytes.toString('utf8');

          // flag
          const flagStart = refStart + refLen;
          const flag = data.readBigUInt64LE(flagStart);

          // MEA
          const meaStart = flagStart + 8;
          const meaRaw = data.readBigUInt64LE(meaStart);
          const mea = Number(meaRaw) / 1_000_000;

          // USDT
          const usdtStart = meaStart + 8;
          const usdtRaw = data.readBigUInt64LE(usdtStart);
          const usdt = Number(usdtRaw) / 1_000_000;

          // extra field
          const extraStart = usdtStart + 8;
          const extra = Number(data.readBigUInt64LE(extraStart));

          // sol fee
          const solFee = -0.0001;

          // FINAL BALANCE CHANGES (no separate USDT token)
          setBalanceChanges([
            {
              type: 'MEA',
              name: 'MEA Token',
              symbol: 'MEA',
              change: -mea,
              usdtAmount: usdt, // <== for display below MEA
              image_uri:
                'https://img-v1.raydium.io/icon/mecySk7eSawDNfAXvW3CquhLyxyKaXExFXgUUbEZE1T.png',
            },
            {
              type: 'SOL',
              name: 'SOLANA',
              symbol: 'SOL',
              change: solFee,
              image_uri:
                'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
            },
          ]);
        }

        setIsLoading(false);
      } catch (e: any) {
        console.log('Parse error', e);
        setError(e.message);
        setIsLoading(false);
      }
    })();
  }, [transactionBase64, isConnected, currentAccount]);

  // ----------------- CONFIRM (SIGN + SEND) -----------------
  const handleConfirm = async () => {
    if (!isConnected) return;

    try {
      setIsLoading(true);

      const txBytes = Buffer.from(transactionBase64, 'base64');
      let tx = Transaction.from(txBytes);

      const walletKeypair = Keypair.fromSecretKey(
        bs58.decode(currentAccount!.secretKey),
      );

      const missing = tx.signatures.filter(s => !s.signature);
      const unsigned = missing.map(s => s.publicKey.toBase58());

      if (unsigned.includes(currentAccount!.publicKey)) {
        tx.partialSign(walletKeypair);
      }

      const raw = tx.serialize({ requireAllSignatures: true });
      const sig = await connection.sendRawTransaction(raw);
      await connection.confirmTransaction(sig, 'confirmed');

      setSuccess(true);
      setTxHash(sig);
      Toast.show({ type: 'success', text1: 'Transaction successful' });
    } catch (e: any) {
      console.log(e);
      setSuccess(false);
      Toast.show({ type: 'error', text1: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------ UI BELOW ------------------

  if (isLoading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator color="#9707B5" size="large" />
        <Text className="text-gray-300 mt-3">Loading transaction...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-black justify-center items-center px-5">
        <Text className="text-red-400 text-center">{error}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          className="mt-5 px-10 py-3 bg-gray-700 rounded-full"
        >
          <Text className="text-white font-semibold">Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View className="flex-1 bg-black">
        <View className="flex-1 justify-center items-center">
          <Offline width={80} height={80} />
          <Text className="text-white mt-4 font-semibold text-lg">
            Please connect to the internet
          </Text>
        </View>
      </View>
    );
  }

  // SUCCESS / FAIL
  if (success !== null) {
    if (success) {
      return (
        <View className="flex-1 bg-black justify-center items-center px-5">
          <Image
            source={require('../../assets/images/success-logo.png')}
            style={{ width: 120, height: 120 }}
          />
          <Text className="text-green-400 mt-4 text-2xl font-semibold">
            Transaction Successful
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
            className="mt-6 bg-[#9707B5] px-10 py-3 rounded-full"
            onPress={() => navigation.navigate('Home')}
          >
            <Text className="text-white font-semibold text-lg">Done</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1 bg-black justify-center items-center px-5">
        <Image
          source={require('../../assets/images/failed-image.png')}
          style={{ width: 120, height: 120 }}
        />
        <Text className="text-red-500 mt-4 text-2xl font-semibold">
          Transaction Failed
        </Text>
        <Text className="text-gray-400 mt-2 text-sm text-center">
          Something went wrong while processing your transaction.
        </Text>
        <TouchableOpacity
          className="mt-6 bg-[#9707B5] px-10 py-3 rounded-full"
          onPress={() => navigation.navigate('Home')}
        >
          <Text className="text-white font-semibold text-lg">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // MAIN UI
  return (
    <View className="flex-1 bg-black px-4 py-2">
      <TouchableOpacity
        onPress={() => navigation.navigate('Home')}
        className="w-full pt-2 items-center justify-center"
      >
        <Text className="text-[#9707B5] mb-2 text-lg font-semibold">
          Confirm Transaction
        </Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* TRANSACTION DETAILS */}
        <View className="bg-gray-900 p-4 rounded-2xl mb-3">
          <Text className="text-[#9707B5] font-semibold mb-3">
            Transaction Details
          </Text>

          <View className="flex-row justify-between py-1">
            <Text className="text-gray-400">Fee Payer</Text>
            <Text className="text-white">{shorten(metadata.feePayer)}</Text>
          </View>

          <View className="flex-row justify-between py-1">
            <Text className="text-gray-400">Recent Blockhash</Text>
            <Text className="text-white">
              {shorten(metadata.recentBlockhash)}
            </Text>
          </View>

          <View className="flex-row justify-between py-1">
            <Text className="text-gray-400">Total Instructions</Text>
            <Text className="text-white">{metadata.totalInstructions}</Text>
          </View>

          <View className="flex-row justify-between py-1">
            <Text className="text-gray-400">Total Accounts</Text>
            <Text className="text-white">{metadata.totalAccounts}</Text>
          </View>

          <View className="flex-row justify-between py-1">
            <Text className="text-gray-400">Cluster</Text>
            <Text className="text-white capitalize">{network}</Text>
          </View>
        </View>

        <View className="bg-gray-900 p-4 rounded-2xl mb-3">
          {/* Solana Pay info */}
          {solanaPayData && (
            <View className="">
              <Text className="text-[#9707B5] font-semibold mb-2">
                Solana Pay Details
              </Text>
              <View className="flex-row items-center">
                {solanaPayData.icon ? (
                  <Image
                    source={{ uri: solanaPayData.icon }}
                    style={{ width: 50, height: 50, borderRadius: 10 }}
                  />
                ) : (
                  <View className="w-12 h-12 bg-gray-700 rounded-lg items-center justify-center">
                    <Text className="text-white text-lg font-bold">
                      {solanaPayData.label?.[0] || '?'}
                    </Text>
                  </View>
                )}

                <View className="ml-3 flex-1">
                  <Text className="text-white text-lg font-semibold">
                    {solanaPayData.label}
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    {solanaPayData.url}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* BALANCE CHANGES */}
        {balanceChanges.length > 0 && (
          <View className="bg-gray-900 px-4 py-2 rounded-2xl mb-3">
            <Text className="text-[#9707B5] font-semibold mb-2">
              Balance Changes
            </Text>

            {balanceChanges.map((c, idx) => (
              <View
                key={idx}
                className="flex-row items-start bg-black/20 p-3 rounded-lg mb-3"
              >
                <Image
                  source={{ uri: c.image_uri }}
                  style={{ width: 40, height: 40, borderRadius: 10 }}
                />

                <View className="ml-3 flex-1">
                  <Text className="text-white font-semibold">{c.name}</Text>
                  <Text className="text-gray-400 text-xs">{c.symbol}</Text>
                </View>

                <View className="items-end">
                  {/* Main MEA or SOL amount */}
                  <Text
                    className={`text-lg font-semibold ${
                      c.change < 0
                        ? 'text-red-400'
                        : c.change > 0
                        ? 'text-green-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {c.change > 0 ? '+' : ''}
                    {c.change.toFixed(6)}
                  </Text>

                  {/* USDT amount shown ONLY for MEA entry */}
                  {'usdtAmount' in c ? (
                    <Text className="text-green-300 text-xs">
                      USDT : {c.usdtAmount.toFixed(6)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* INSTRUCTIONS */}
        <View className="bg-gray-900 p-4 rounded-2xl mb-12">
          <Text className="text-[#9707B5] font-semibold mb-3">
            Instructions
          </Text>

          {metadata.instructions.map((instr: any, i: any) => (
            <View key={i} className="bg-black/20 p-3 rounded-lg mb-3">
              <Text className="text-gray-300 text-sm font-semibold mb-2">
                Instruction {i + 1}
              </Text>

              <View className="flex-row justify-between">
                <Text className="text-gray-400 text-sm">Program</Text>
                <Text className="text-white text-sm">
                  {shorten(instr.programId)}
                </Text>
              </View>

              <Text className="text-gray-400 text-sm mt-2">Data (hex)</Text>
              <Text className="text-gray-300 text-xs">
                {hexPreview(instr.data, 120)}
              </Text>

              <Text className="text-gray-400 text-sm mt-2">Accounts</Text>
              {instr.accounts.map((acc: any, id: number) => (
                <Text key={id} className="text-gray-300 text-xs">
                  {shorten(acc.pubkey)} {acc.isSigner ? '(signer)' : ''}
                  {acc.isWritable ? '(writable)' : ''}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* FOOTER */}
      <View className="flex-row justify-between mt-3">
        <TouchableOpacity
          className="border border-gray-600 w-[48%] py-3 rounded-full"
          onPress={() => navigation.navigate('Home')}
        >
          <Text className="text-center text-white font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-[#9707B5] w-[48%] py-3 rounded-full"
          onPress={handleConfirm}
        >
          <Text className="text-center text-white font-semibold text-lg">
            Confirm
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
