import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Image,
  ScrollView,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import NetInfo from '@react-native-community/netinfo';
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  TOKEN_2022_PROGRAM_ID,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import Toast from 'react-native-toast-message';
import { loadWallet } from '../../utils/storage';
import { fetchSolPrice, getRpcUrl } from '../../utils/common';
import { RootStackParamList } from '../../types/navigation';
import SendIcon from '../../assets/icons/send-icon.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import Offline from '../../assets/icons/offline.svg';
import { fetchTokenMetadata } from '../../utils/fetch_spl';
import BottomNavBar from '../../components/BottomNavBar';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmSend'>;

type Token = {
  mint: string;
  balance: number;
  decimals: number;
  symbol: string;
  name: string;
  image: string | any;
  price: number;
};

const ESTIMATED_FEE_SOL = 0.000005; // Approx fee in SOL

const ConfirmSendScreen = ({ route, navigation }: Props) => {
  const {
    fromAddress,
    toAddress,
    amount,
    tokenSymbol,
    tokenMint,
    network,
    label,
    message,
    memo,
  } = route.params;

  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [txHash, setTxHash] = useState('');
  const [tokenPrice, setTokenPrice] = useState(0);

  // Balance states
  const [hasEnoughGas, setHasEnoughGas] = useState(true);
  const [hasEnoughTokens, setHasEnoughTokens] = useState(true);

  const connection = new Connection(getRpcUrl(network), 'confirmed');
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
    const fetchPriceAndBalance = async () => {
      if (!isConnected) {
        Toast.show({
          type: 'error',
          text1: 'Check your Internet connection!',
        });
        return;
      }

      try {
        let price = 0;
        let solBal = 0;
        let tokenBal = 0;

        // Always fetch SOL balance for gas
        try {
          const lamports = await connection.getBalance(
            new PublicKey(fromAddress),
          );
          solBal = lamports / LAMPORTS_PER_SOL;
          const requiredGas = ESTIMATED_FEE_SOL + (tokenMint ? 0.002 : 0); // Extra for ATA creation
          setHasEnoughGas(solBal >= requiredGas);
        } catch (err) {
          setHasEnoughGas(false);
        }

        if (!tokenMint) {
          // Native SOL transfer
          price = await fetchSolPrice(network);
          setTokenPrice(price);
          setHasEnoughTokens(solBal >= amount);
        } else {
          // SPL Token
          const tokens = await fetchSPL(getRpcUrl(network), fromAddress);
          const token = tokens.find(t => t.mint === tokenMint);
          if (token) {
            price = token.price;
            tokenBal = token.balance;
            const required = amount;
            setHasEnoughTokens(tokenBal >= required);
          } else {
            setHasEnoughTokens(false);
          }
          setTokenPrice(price);
        }
      } catch (err) {
        console.log('Error fetching balance/price:', err);
        setHasEnoughGas(false);
        setHasEnoughTokens(false);
      }
    };

    fetchPriceAndBalance();
  }, [fromAddress, tokenMint, amount, network, isConnected]);

  const fetchSPL = async (
    rpcUrl: string,
    ownerAddress: string,
  ): Promise<Token[]> => {
    if (!isConnected) {
      return [];
    }

    let allItems: any[] = [];
    let tempSPL: Token[] = [];
    let page = 1;
    let nativeBalance: number = 0;

    while (true) {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress,
            page,
            limit: 100,
            options: {
              showFungible: true,
              showZeroBalance: false,
              showNativeBalance: true,
            },
          },
        }),
      });

      if (!response.ok) break;
      const { result } = await response.json();

      if (page === 1) {
        nativeBalance = result.nativeBalance?.lamports || 0;
      }
      if (!result?.items || result.items.length === 0) break;

      allItems = allItems.concat(result.items);
      if (result.items.length < 100) break;
      page++;
    }

    for (const item of allItems) {
      const decimals = item.token_info?.decimals ?? 0;
      const user_balance = item.token_info?.balance
        ? item.token_info.balance / Math.pow(10, decimals)
        : 0;
      if (decimals === 0 || user_balance <= 0) continue;

      const price = item.token_info?.price_info?.price_per_token ?? 0;
      tempSPL.push({
        mint: item.id,
        balance: user_balance,
        decimals,
        symbol: item.content?.metadata.symbol || 'UKN',
        name:
          item.content?.metadata?.name ||
          `Unknown [${item.id.slice(0, 4)}...${item.id.slice(-4)}]`,
        image:
          item.content?.links?.image ||
          (item.content?.files?.length > 0 ? item.content.files[0].uri : '') ||
          require('../../assets/images/sol-img.png'),
        price,
      });
    }

    // Add native SOL
    const solBalance = nativeBalance / LAMPORTS_PER_SOL;
    if (solBalance > 0) {
      const solPrice = await fetchSolPrice(network);
      tempSPL.unshift({
        name: 'Solana',
        balance: solBalance,
        image: require('../../assets/images/solana-icon.png'),
        mint: '',
        symbol: 'SOL',
        decimals: 9,
        price: solPrice,
      });
    }

    return tempSPL;
  };

  const handleSendTransaction = async () => {
    if (!isConnected) {
      return;
    }

    try {
      setSending(true);
      const wallet = await loadWallet();
      const currentAccount = wallet?.accounts.find(
        (a: any) => a.publicKey === fromAddress,
      );
      if (!currentAccount) throw new Error('Wallet not found');

      const payer = Keypair.fromSecretKey(
        bs58.decode(currentAccount.secretKey),
      );
      const transaction = new Transaction();

      if (!tokenMint) {
        // Native SOL transfer (unchanged)
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: new PublicKey(toAddress),
            lamports,
          }),
        );
      } else {
        const mintKey = new PublicKey(tokenMint);

        // Determine token program by checking the mint account owner
        const mintAccountInfo = await connection.getAccountInfo(mintKey);
        let tokenProgramId = TOKEN_PROGRAM_ID; // default
        if (
          mintAccountInfo &&
          mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
        ) {
          tokenProgramId = TOKEN_2022_PROGRAM_ID;
        }

        // Create / fetch ATAs — ensure correct argument order:
        // getOrCreateAssociatedTokenAccount(connection, payer, mint, owner, allowOwnerOffCurve?, commitment?, confirmOptions?, programId?, associatedTokenProgramId?)
        const ownerPub = new PublicKey(fromAddress);
        const recipientPub = new PublicKey(toAddress);

        const isPDA = PublicKey.isOnCurve(recipientPub) === false;

        const sourceATA = await getOrCreateAssociatedTokenAccount(
          connection,
          payer,
          mintKey,
          ownerPub,
          true, // allowOwnerOffCurve
          undefined, // commitment
          undefined, // confirmOptions
          tokenProgramId, // programId: ensures ATA is for same token program as mint
        );

        const destinationATA = await getOrCreateAssociatedTokenAccount(
          connection,
          payer,
          mintKey,
          recipientPub,
          isPDA,
          undefined,
          undefined,
          tokenProgramId,
        );

        // Fetch decimals (metadata fallback)
        const metadata = await fetchTokenMetadata(mintKey.toString(), network);
        const decimals = metadata?.decimals ?? 0;
        const amountInLamports = BigInt(Math.floor(amount * 10 ** decimals));

        // IMPORTANT: pass tokenProgramId as the last argument to createTransferInstruction
        transaction.add(
          createTransferInstruction(
            sourceATA.address,
            destinationATA.address,
            payer.publicKey,
            Number(amountInLamports), // createTransferInstruction expects number | bigint depending on version
            [], // multisig signers
            tokenProgramId, // programId -> ensures correct token program is used for the transfer
          ),
        );
      }

      const latest = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latest.blockhash;
      transaction.feePayer = payer.publicKey;
      transaction.sign(payer);

      const raw = transaction.serialize();
      const signature = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 5,
      });
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
      Toast.show({ type: 'success', text1: 'Transaction sent successfully!' });
    } catch (err: any) {
      console.log('Send error:', err);
      setSuccess(false);
      Toast.show({
        type: 'error',
        text1: 'Transaction failed to send tokens',
        text2: err?.message ?? '',
      });
    } finally {
      setSending(false);
    }
  };

  const renderTransactionInfo = () => (
    <View>
      <View className="bg-gray-900 p-4 rounded-2xl mt-2 space-y-2">
        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">From</Text>
          <View className="flex-row items-center">
            <Text className="text-white mr-2">
              {fromAddress.slice(0, 4)}...{fromAddress.slice(-4)}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Clipboard.setString(fromAddress);
                Toast.show({ type: 'success', text1: 'From Address copied' });
              }}
            >
              <CopyIcon width={12} height={12} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">To</Text>
          <View className="flex-row items-center">
            <Text className="text-white mr-2">
              {toAddress.slice(0, 4)}...{toAddress.slice(-4)}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Clipboard.setString(toAddress);
                Toast.show({ type: 'success', text1: 'To Address copied' });
              }}
            >
              <CopyIcon width={12} height={12} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">Token</Text>
          <View className="flex-row items-center">
            <Text className="text-white mr-2">
              {tokenMint
                ? `${tokenMint.slice(0, 4)}...${tokenMint.slice(-4)}`
                : 'SOLANA'}
            </Text>
            {tokenMint && (
              <TouchableOpacity
                onPress={() => {
                  Clipboard.setString(tokenMint);
                  Toast.show({ type: 'success', text1: 'Token Mint copied' });
                }}
              >
                <CopyIcon width={12} height={12} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">Amount</Text>
          <Text className="text-white">
            {amount} {tokenSymbol}
          </Text>
        </View>

        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">Value (USD)</Text>
          <Text className="text-white">
            {tokenPrice > 0 ? `$${(amount * tokenPrice).toFixed(2)}` : '-'}
          </Text>
        </View>

        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">Network</Text>
          <Text className="text-white capitalize">{network}</Text>
        </View>

        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">Est. Fee</Text>
          <Text className="text-white">~0.000005 SOL</Text>
        </View>
      </View>

      <View className="bg-gray-900 p-4 rounded-2xl mt-4 space-y-2">
        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">Label</Text>
          <Text className="text-white">{label || 'N/A'}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">Message</Text>
          <Text className="text-white">{message || 'N/A'}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-gray-400">Memo</Text>
          <Text className="text-white">{memo || 'N/A'}</Text>
        </View>
      </View>
    </View>
  );

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
            Tx: {txHash.slice(0, 8)}...{txHash.slice(-8)}
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
            Something went wrong. Please try again.
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('SendInputAmount', {
                recipient: toAddress,
                mintAddress: tokenMint,
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
        <BottomNavBar active="null" />
      </View>
    );
  }

  if (success !== null) return renderStatusScreen();

  return (
    <View className="flex-1 bg-black px-4 py-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="items-center my-3">
          <View className="bg-green-500 p-5 mb-3 rounded-full">
            <SendIcon width={24} height={24} />
          </View>
          <Text className="text-4xl text-white font-bold">
            {amount} {tokenSymbol}
          </Text>
          <Text className="text-gray-400 mt-2">
            {tokenPrice > 0 ? `≈ $${(amount * tokenPrice).toFixed(2)}` : '-'}
          </Text>

          {/* Priority: Show gas error first */}
          {!hasEnoughGas && (
            <Text className="text-red-500 text-center mt-4 font-semibold text-base">
              Not enough SOL for transaction fee (~0.000005 SOL required)
            </Text>
          )}

          {/* Show token error only if gas is sufficient */}
          {hasEnoughGas && !hasEnoughTokens && (
            <Text className="text-red-500 text-center mt-4 font-semibold text-base">
              Not enough {tokenSymbol} to send
            </Text>
          )}
        </View>

        {renderTransactionInfo()}
      </ScrollView>

      <View className="my-4 mb-2 flex-row justify-between items-center">
        <TouchableOpacity
          disabled={sending}
          onPress={() => navigation.navigate('Home')}
          className="border border-gray-600 w-[48%] py-3 rounded-full"
        >
          <Text className="text-center text-white font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={sending || !hasEnoughGas || !hasEnoughTokens}
          onPress={handleSendTransaction}
          className={`w-[48%] py-3 rounded-full ${
            sending || !hasEnoughGas || !hasEnoughTokens
              ? 'bg-gray-600'
              : 'bg-[#9707B5]'
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
            <Text
              className={`text-center font-semibold text-lg ${
                !hasEnoughGas || !hasEnoughTokens
                  ? 'text-gray-400'
                  : 'text-white'
              }`}
            >
              Confirm
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ConfirmSendScreen;
