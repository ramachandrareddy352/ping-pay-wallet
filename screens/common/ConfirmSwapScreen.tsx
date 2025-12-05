import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageSourcePropType } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  PublicKey,
  Connection,
  Keypair,
  VersionedTransaction,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import NetInfo from '@react-native-community/netinfo';
import BN from 'bn.js';
import bs58 from 'bs58';
import Toast from 'react-native-toast-message';
import RightArrow from '../../assets/icons/move-right.svg';
import Offline from '../../assets/icons/offline.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import { RootStackParamList } from '../../types/navigation';
import { loadWallet, WalletAccount } from '../../utils/storage';
import {
  Raydium,
  PoolFetchType,
  getPdaObservationId,
  PoolUtils,
} from '@raydium-io/raydium-sdk-v2';
import Clipboard from '@react-native-clipboard/clipboard';
import { getRpcUrl, getSwapInfo } from '../../utils/common';
import UsernameFrame from '../../assets/images/user-logo.png';
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getConnection } from '../../utils/solana';
import BottomNavBar from '../../components/BottomNavBar';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmSwap'>;

const safeImageSource = (img?: string | ImageSourcePropType | null) => {
  const solImageSource: ImageSourcePropType = require('../../assets/images/sol-img.png');
  if (!img) return solImageSource;
  if (typeof img === 'string') {
    if (img.trim() === '') return solImageSource;
    return { uri: img };
  }
  return img as ImageSourcePropType;
};

export default function ConfirmSwapScreen({ navigation, route }: Props) {
  const {
    sellToken: sellMint,
    buyToken: buyMint,
    sellAmount,
    buyAmount,
    inputType,
    isSellNativeSol,
    isBuyNativeSol,
    slippage,
    network,
  } = route.params;

  const [isSwapping, setIsSwapping] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [txHash, setTxHash] = useState('');
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(
    null,
  );
  const [bestPool, setBestPool] = useState<any | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [computedAmount, setComputedAmount] = useState<BN>();
  const [computedSupportAmount, setComputedSupportAmount] = useState<BN>();
  const [isComputing, setIsComputing] = useState(false);
  const [remainingAccountsData, setRemainingAccountsData] =
    useState<PublicKey[]>();
  const [hasEnoughGasFee, setHasEnoughGasFee] = useState(false);
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

  const getMintMetaFromPool = (mint: string) => {
    if (!bestPool) return { decimals: 9, symbol: '', name: '' };
    const mintA = bestPool.mintA || {};
    const mintB = bestPool.mintB || {};
    if (mint === mintA.address) {
      return {
        decimals: mintA.decimals ?? 9,
        symbol: mintA.symbol ?? '',
        name: mintA.name ?? '',
      };
    }
    if (mint === mintB.address) {
      return {
        decimals: mintB.decimals ?? 9,
        symbol: mintB.symbol ?? '',
        name: mintB.name ?? '',
      };
    }
    return { decimals: 9, symbol: '', name: '' };
  };

  const getUIAmount = useCallback(
    (bnAmount?: BN, mint?: string) => {
      if (!bnAmount || !mint) return 0;
      const meta = getMintMetaFromPool(mint);
      return Number(bnAmount) / Math.pow(10, meta.decimals);
    },
    [bestPool],
  );

  useEffect(() => {
    (async () => {
      try {
        const wallet = await loadWallet();

        if (!wallet || !wallet.currentAccountId) {
          setCurrentAccount(null);
          setHasEnoughGasFee(false);
          return;
        }

        const acc = wallet.accounts.find(a => a.id === wallet.currentAccountId);
        if (!acc) {
          setCurrentAccount(null);
          setHasEnoughGasFee(false);
          return;
        }

        setCurrentAccount(acc);

        const conn = getConnection(
          wallet.network === 'devnet' ? 'devnet' : 'mainnet',
        );
        let balance = await conn.getBalance(
          new PublicKey(wallet.currentAccountId),
        );

        if (isSellNativeSol) {
          balance =
            balance - Math.floor(parseFloat(sellAmount) * LAMPORTS_PER_SOL);
        }
        setHasEnoughGasFee(balance >= 50000);
      } catch (e) {
        console.log('loadWallet or getSolBalance error', e);
        setCurrentAccount(null);
        setHasEnoughGasFee(false);
      }
    })();
  }, []);

  const getRaydium = useCallback(
    async (ownerPubkey?: PublicKey) => {
      const connection = new Connection(getRpcUrl(network), 'confirmed');
      const raydium = await Raydium.load({
        connection,
        owner: ownerPubkey,
        cluster: network === 'devnet' ? 'devnet' : 'mainnet',
        apiRequestInterval: 10_000,
      });
      return { raydium, connection };
    },
    [network, isConnected],
  );

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    let mounted = true;
    setIsComputing(true);
    (async () => {
      if (!sellMint || !buyMint) {
        setIsComputing(false);
        return;
      }
      try {
        setPoolLoading(true);
        const { raydium, connection } = await getRaydium();
        const res = await raydium.api.fetchPoolByMints({
          mint1: sellMint,
          mint2: buyMint,
          type: PoolFetchType.All,
          sort: 'liquidity',
          order: 'desc',
          page: 1,
        });

        if (!mounted) {
          setIsComputing(false);
          return;
        }

        if (res && res.data && res.data.length > 0) {
          const pool = res.data[0];
          setBestPool(pool);

          const epochInfo = await connection.getEpochInfo();
          const { computePoolInfo, tickData } =
            await raydium.clmm.getPoolInfoFromRpc(pool.id);
          const tickArrayCache = tickData[pool.id];

          const mintA = pool.mintA;
          const mintB = pool.mintB;
          const sellMeta = mintA.address === sellMint ? mintA : mintB;
          const buyMeta = mintA.address === buyMint ? mintA : mintB;

          if (inputType === 'sell') {
            const amountInUI = parseFloat(sellAmount || '0');
            if (amountInUI <= 0) {
              setIsComputing(false);
              return;
            }
            const amountInBN = new BN(
              Math.floor(amountInUI * Math.pow(10, sellMeta.decimals ?? 9)),
            );
            console.log('SELL');

            const { amountOut, remainingAccounts } = PoolUtils.computeAmountOut(
              {
                poolInfo: computePoolInfo,
                tickArrayCache,
                baseMint: new PublicKey(sellMint),
                epochInfo,
                amountIn: amountInBN,
                slippage,
                catchLiquidityInsufficient: true,
              },
            );
            setRemainingAccountsData(remainingAccounts);
            setComputedAmount(amountOut.amount);
            const slippageAmount = amountOut.amount
              .mul(new BN(Math.round(slippage * 100)))
              .div(new BN(10000));
            setComputedSupportAmount(amountOut.amount.sub(slippageAmount));
          } else {
            console.log('BUY');
            const amountOutUI = parseFloat(buyAmount || '0');
            if (amountOutUI <= 0) {
              setIsComputing(false);
              return;
            }
            const amountOutBN = new BN(
              Math.floor(amountOutUI * Math.pow(10, buyMeta.decimals ?? 9)),
            );
            const { amountIn, remainingAccounts } = PoolUtils.computeAmountIn({
              poolInfo: computePoolInfo,
              tickArrayCache,
              baseMint: new PublicKey(buyMint),
              epochInfo,
              amountOut: amountOutBN,
              slippage,
            });
            setRemainingAccountsData(remainingAccounts);
            setComputedAmount(amountIn.amount);
            const slippageAmount = amountIn.amount
              .mul(new BN(Math.round(slippage * 100)))
              .div(new BN(10000));
            setComputedSupportAmount(amountIn.amount.add(slippageAmount));
          }
        } else {
          setBestPool(null);
        }
      } catch (e) {
        console.log('fetchPoolByMints error', e);
        setBestPool(null);
      } finally {
        setIsComputing(false);
        if (mounted) setPoolLoading(false);
      }
    })();
    return () => {
      mounted = false;
      setIsComputing(false);
    };
  }, [
    sellMint,
    buyMint,
    sellAmount,
    buyAmount,
    inputType,
    slippage,
    isConnected,
    getRaydium,
  ]);

  const fromUI =
    inputType === 'sell'
      ? parseFloat(sellAmount || '0') || 0
      : getUIAmount(computedAmount, sellMint);
  const toUI =
    inputType === 'sell'
      ? getUIAmount(computedAmount, buyMint)
      : parseFloat(buyAmount || '0') || 0;
  const supportUI =
    inputType === 'sell'
      ? getUIAmount(computedSupportAmount, buyMint)
      : getUIAmount(computedSupportAmount, sellMint);
  const supportLabel = inputType === 'sell' ? 'Min received' : 'Max sent';
  const supportSymbol =
    inputType === 'sell'
      ? getMintMetaFromPool(buyMint).symbol || buyMint?.slice(0, 6) || ''
      : getMintMetaFromPool(sellMint).symbol || sellMint?.slice(0, 6) || '';

  const sellLogoURI = bestPool
    ? bestPool.mintA?.address === sellMint
      ? bestPool.mintA?.logoURI ?? ''
      : bestPool.mintB?.logoURI ?? ''
    : '';
  const buyLogoURI = bestPool
    ? bestPool.mintA?.address === buyMint
      ? bestPool.mintA?.logoURI ?? ''
      : bestPool.mintB?.logoURI ?? ''
    : '';

  const doSwap = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    if (isSwapping) return;
    setIsSwapping(true);

    try {
      const walletData = await loadWallet();
      if (!walletData || !walletData.currentAccountId) {
        Toast.show({
          type: 'error',
          text1: 'Wallet or Account not found.',
        });
        setIsSwapping(false);
        return;
      }
      const acc =
        walletData.accounts.find(a => a.id === walletData.currentAccountId) ??
        null;

      if (!acc || !remainingAccountsData) {
        Toast.show({
          type: 'error',
          text1: 'Account not found',
        });
        setIsSwapping(false);
        setCurrentAccount(null);
        return;
      }
      setCurrentAccount(acc);

      const ownerPubkey = new PublicKey(acc.publicKey);
      const keypair = Keypair.fromSecretKey(bs58.decode(acc.secretKey));
      const { raydium, connection } = await getRaydium(ownerPubkey);

      let pool = bestPool;
      if (!pool) {
        const res = await raydium.api.fetchPoolByMints({
          mint1: sellMint,
          mint2: buyMint,
          type: PoolFetchType.All,
          sort: 'liquidity',
          order: 'desc',
          page: 1,
        });
        if (!res || !res.data || res.data.length === 0) {
          setIsSwapping(false);
          throw new Error('No pool found for the selected pair');
        }
        pool = res.data[0];
      }

      const poolKeys = await raydium.clmm.getClmmPoolKeys(pool.id);
      const poolInfoArr = await raydium.api.fetchPoolById({ ids: pool.id });
      const poolInfo = poolInfoArr[0];

      if (!poolInfo || poolInfo.type !== 'Concentrated') {
        setIsSwapping(false);
        throw new Error('Not a concentrated liquidity pool');
      }

      const { publicKey: observationId } = getPdaObservationId(
        new PublicKey(poolInfo.programId),
        new PublicKey(poolInfo.id),
      );

      const ownerInfo = {
        useSOLBalance: isSellNativeSol || isBuyNativeSol,
        feePayer: ownerPubkey,
      };

      const sellMeta =
        pool.mintA?.address === sellMint ? pool.mintA : pool.mintB;
      const buyMeta = pool.mintA?.address === buyMint ? pool.mintA : pool.mintB;

      if (!sellMeta || !buyMeta) {
        setIsSwapping(false);
        throw new Error('Token metadata not found for sell or buy mint');
      }

      const inputDecimals = sellMeta.decimals ?? 9;
      const outputDecimals = buyMeta.decimals ?? 9;

      const poolPrice = Number(pool.price ?? pool.currentPrice ?? 1);
      if (isNaN(poolPrice) || poolPrice <= 0) {
        setIsSwapping(false);
        throw new Error('Invalid pool price');
      }

      const signer = Keypair.fromSecretKey(bs58.decode(acc.secretKey));

      // Determine token program by checking the mint account owner
      const sellMintAccountInfo = await connection.getAccountInfo(
        new PublicKey(sellMint),
      );
      let sellTokenProgramId = TOKEN_PROGRAM_ID; // default
      if (
        sellMintAccountInfo &&
        sellMintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
      ) {
        sellTokenProgramId = TOKEN_2022_PROGRAM_ID;
      }

      const buyMintAccountInfo = await connection.getAccountInfo(
        new PublicKey(buyMint),
      );
      let buyTokenProgramId = TOKEN_PROGRAM_ID; // default
      if (
        buyMintAccountInfo &&
        buyMintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
      ) {
        buyTokenProgramId = TOKEN_2022_PROGRAM_ID;
      }

      // Ensure token accounts exist
      const sellTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        signer,
        new PublicKey(sellMint),
        ownerPubkey,
        true, // allowOwnerOffCurve
        undefined, // commitment
        undefined, // confirmOptions
        sellTokenProgramId, // programId: ensures ATA is for same token program as mint
      );

      const isPDA = PublicKey.isOnCurve(ownerPubkey) === false;

      const buyTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        signer,
        new PublicKey(buyMint),
        ownerPubkey,
        isPDA, // allowOwnerOffCurve
        undefined, // commitment
        undefined, // confirmOptions
        buyTokenProgramId, // programId: ensures ATA is for same token program as mint
      );

      if (!sellTokenAccount || !buyTokenAccount) {
        setIsSwapping(false);
        throw new Error('Failed to create or find associated token accounts');
      }

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

      let txData: any;
      if (inputType === 'sell') {
        const amountIn = new BN(
          Math.floor(parseFloat(sellAmount) * Math.pow(10, inputDecimals)),
        );

        // Validate amounts
        if (amountIn.isZero()) {
          setIsSwapping(false);
          throw new Error(
            'Invalid swap amounts: amountIn and amountOutMin must be non-zero',
          );
        }

        txData = await raydium.clmm.swap({
          poolInfo,
          poolKeys,
          inputMint: new PublicKey(sellMint),
          amountIn,
          amountOutMin: computedSupportAmount,
          observationId,
          ownerInfo,
          remainingAccounts: remainingAccountsData,
          associatedOnly: false,
          checkCreateATAOwner: true,
          feePayer: ownerPubkey,
        });
      } else {
        const amountOut = new BN(
          Math.floor(parseFloat(buyAmount) * Math.pow(10, outputDecimals)),
        );

        // Validate amounts
        if (amountOut.isZero()) {
          setIsSwapping(false);
          throw new Error(
            'Invalid swap amounts: amountOut and amountInMax must be non-zero',
          );
        }

        txData = await raydium.clmm.swapBaseOut({
          poolInfo,
          poolKeys,
          outputMint: new PublicKey(buyMint),
          amountOut,
          amountInMax: computedSupportAmount,
          observationId,
          ownerInfo,
          remainingAccounts: remainingAccountsData,
          associatedOnly: false,
          checkCreateATAOwner: true,
          feePayer: ownerPubkey,
        });
      }

      if (!txData || !txData.transaction) {
        setIsSwapping(false);
        throw new Error('Failed to create swap transaction');
      }

      const tx = txData.transaction;
      if (tx instanceof VersionedTransaction) {
        tx.message.recentBlockhash = blockhash;
        tx.sign([keypair]);
      } else {
        (tx as Transaction).recentBlockhash = blockhash;
        (tx as Transaction).lastValidBlockHeight = lastValidBlockHeight;
        (tx as Transaction).partialSign(keypair);
      }

      if (txData.signers && txData.signers.length > 0) {
        if (tx instanceof VersionedTransaction) {
          tx.sign(txData.signers);
        } else {
          (tx as Transaction).partialSign(...txData.signers);
        }
      }

      const rawTransaction = tx.serialize();
      const transactionId = await connection.sendRawTransaction(
        rawTransaction,
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        },
      );

      await connection.confirmTransaction(
        { signature: transactionId, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      Toast.show({
        type: 'success',
        text1: 'Tokens Swapped successfully!',
      });

      // Collect fee from received tokens
      const { feePercentage, receiver } = await getSwapInfo();
      if (feePercentage > 0 && receiver && toUI > 0) {
        try {
          const receiverPubkey = new PublicKey(receiver);
          const buyDecimals = getMintMetaFromPool(buyMint).decimals;
          const receivedRawAmount = Math.floor(
            toUI * Math.pow(10, buyDecimals),
          );
          const feeRawAmount = Math.floor(
            (receivedRawAmount * feePercentage) / 10000,
          );

          if (feeRawAmount > 0) {
            const {
              blockhash: transferBlockhash,
              lastValidBlockHeight: transferLastValidBlockHeight,
            } = await connection.getLatestBlockhash('confirmed');
            const transferTx = new Transaction();

            transferTx.recentBlockhash = transferBlockhash;
            transferTx.lastValidBlockHeight = transferLastValidBlockHeight;
            transferTx.feePayer = ownerPubkey;

            if (isBuyNativeSol) {
              // Native SOL transfer
              const solTransferIx = SystemProgram.transfer({
                fromPubkey: ownerPubkey,
                toPubkey: receiverPubkey,
                lamports: feeRawAmount,
              });
              transferTx.add(solTransferIx);
            } else {
              // SPL token transfer
              // Create or get receiver's ATA
              const receiverTokenAccount =
                await getOrCreateAssociatedTokenAccount(
                  connection,
                  signer, // payer
                  new PublicKey(buyMint),
                  receiverPubkey,
                  true, // allowOwnerOffCurve
                  'confirmed',
                  undefined,
                  buyTokenProgramId,
                );

              if (!receiverTokenAccount) {
                console.log('Failed to get receiver token account');
              } else {
                // Create transfer instruction
                const transferIx = createTransferInstruction(
                  buyTokenAccount.address,
                  receiverTokenAccount.address,
                  ownerPubkey,
                  feeRawAmount,
                  [], // multiSigners
                  buyTokenProgramId,
                );
                transferTx.add(transferIx);
              }
            }

            // Sign and send the transfer transaction
            transferTx.partialSign(keypair);
            const transferSignature = await connection.sendTransaction(
              transferTx,
              [keypair],
              {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
              },
            );

            await connection.confirmTransaction(
              {
                signature: transferSignature,
                blockhash: transferBlockhash,
                lastValidBlockHeight: transferLastValidBlockHeight,
              },
              'confirmed',
            );

            const feeUiAmount = feeRawAmount / Math.pow(10, buyDecimals);
            console.log(
              `Fee collected => Amount: ${feeUiAmount} (raw: ${feeRawAmount}), From: ${signer.publicKey} to ${receiver}, Mint: ${buyMint}`,
            );
          }
        } catch (feeError) {
          console.log('Fee transfer failed:', feeError);
        }
      }

      setSuccess(true);
      setTxHash(transactionId);
    } catch (error: any) {
      setSuccess(false);
      setTxHash('');
      console.log('Swap failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Executing Swap failed',
      });
    } finally {
      setIsSwapping(false);
    }
  }, [
    isSwapping,
    sellMint,
    buyMint,
    sellAmount,
    buyAmount,
    inputType,
    slippage,
    network,
    bestPool,
    computedSupportAmount,
    getRaydium,
    isSellNativeSol,
    currentAccount,
    isConnected,
    remainingAccountsData,
  ]);

  const renderStatusScreen = () => {
    if (success === true)
      return (
        <View className="flex-1 bg-black items-center justify-center px-6">
          <Image
            source={require('../../assets/images/success-logo.png')}
            style={{ width: 120, height: 120 }}
          />
          <Text className="text-green-400 mt-5 font-semibold text-2xl">
            Swap Successful!
          </Text>
          <Text className="text-gray-400 mt-2 text-sm">
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
            <Text className="text-[#9707B5] underline">View on Explorer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setSuccess(null);
              navigation.navigate('Home');
            }}
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
            Swap Failed
          </Text>
          <Text className="text-gray-400 mt-2 text-sm text-center">
            Something went wrong while swapping your tokens.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setSuccess(null);
              navigation.navigate('Swap');
            }}
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
        <BottomNavBar active="Swap" />
      </View>
    );
  }

  if (success !== null) return renderStatusScreen();

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-white text-center text-xl font-bold mb-2">
          Confirm Swap
        </Text>
      </View>

      {!hasEnoughGasFee && (
        <View>
          <Text className="text-center text-red-600 text-xs mb-2">
            Not Enough Fees to pay ~0.00005 SOL
          </Text>
        </View>
      )}

      {isComputing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="white" />
          <Text className="text-gray-300 mt-3">Computing best pool...</Text>
        </View>
      ) : (
        <View className="flex-1">
          <ScrollView className="flex-1 px-4">
            <View className="bg-[#18181f] rounded-2xl p-4 mb-4">
              <Text className="text-gray-400 text-sm mb-2">SELL</Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Image
                    source={safeImageSource(sellLogoURI)}
                    className="w-8 h-8 rounded-full mr-3"
                  />
                  <View>
                    <Text className="text-white font-bold">
                      {isSellNativeSol
                        ? 'SOL'
                        : getMintMetaFromPool(sellMint).symbol || '----'}
                    </Text>
                    <Text className="text-gray-400 text-xs">
                      {isSellNativeSol
                        ? 'SOLANA'
                        : getMintMetaFromPool(sellMint).name || '----'}
                    </Text>
                  </View>
                </View>
                <Text className="text-red-500 text-xl font-bold">
                  {fromUI.toFixed(3)}{' '}
                  {isSellNativeSol
                    ? 'SOL'
                    : getMintMetaFromPool(sellMint).symbol || ''}
                </Text>
              </View>
            </View>

            <View className="bg-[#18181f] rounded-2xl p-4 mb-4">
              <Text className="text-gray-400 text-sm mb-2">BUY</Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Image
                    source={safeImageSource(buyLogoURI)}
                    className="w-8 h-8 rounded-full mr-3"
                  />
                  <View>
                    <Text className="text-white font-bold">
                      {isBuyNativeSol
                        ? 'SOL'
                        : getMintMetaFromPool(buyMint).symbol || '----'}
                    </Text>
                    <Text className="text-gray-400 text-xs">
                      {isBuyNativeSol
                        ? 'SOLANA'
                        : getMintMetaFromPool(buyMint).name || '----'}
                    </Text>
                  </View>
                </View>
                <Text className="text-green-500 text-xl font-bold">
                  +{toUI.toFixed(3)}{' '}
                  {isBuyNativeSol
                    ? 'SOL'
                    : getMintMetaFromPool(buyMint).symbol || ''}
                </Text>
              </View>
            </View>

            <View className="mb-4">
              <View className="bg-[#18181f] rounded-2xl p-3">
                <Text className="text-white text-base mb-1">Swap Payer</Text>
                <View className="flex-row items-center">
                  <Image
                    source={
                      currentAccount?.imageUri
                        ? { uri: currentAccount.imageUri }
                        : UsernameFrame
                    }
                    className="w-8 h-8 rounded-full mr-3"
                  />
                  <View className="flex-1">
                    <Text className="text-white font-medium">
                      {currentAccount?.name ?? 'Unknown Account'}
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="text-gray-400 text-sm">
                        {currentAccount?.publicKey
                          ? `${currentAccount.publicKey.slice(
                              0,
                              4,
                            )}...${currentAccount.publicKey.slice(-4)}`
                          : 'No address'}
                      </Text>
                      {currentAccount?.publicKey && (
                        <TouchableOpacity
                          onPress={() =>
                            Clipboard.setString(currentAccount.publicKey)
                          }
                          className="p-1"
                        >
                          <CopyIcon width={16} height={16} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View className="bg-[#0f0f14] rounded-2xl p-4 mb-4">
              <Text className="text-gray-400 text-base mb-3">Metadata</Text>

              {poolLoading ? (
                <Text className="text-gray-400">Checking pool...</Text>
              ) : bestPool ? (
                (() => {
                  const sellMeta =
                    bestPool.mintA?.address === sellMint
                      ? bestPool.mintA
                      : bestPool.mintB;
                  const buyMeta =
                    bestPool.mintA?.address === buyMint
                      ? bestPool.mintA
                      : bestPool.mintB;

                  return (
                    <View className="space-y-2">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-300 text-sm font-medium">
                          Route
                        </Text>
                        <View className="flex-row items-center">
                          <View className="flex-row items-center mr-3">
                            <Image
                              source={safeImageSource(sellMeta?.logoURI ?? '')}
                              className="w-6 h-6 rounded-full mr-1"
                            />
                            <Text className="text-white text-sm font-semibold">
                              {isSellNativeSol
                                ? 'SOL'
                                : sellMeta?.symbol ??
                                  (sellMint ? sellMint.slice(0, 6) : 'N/A')}
                            </Text>
                          </View>
                          <RightArrow height={16} width={16} />
                          <View className="flex-row items-center ml-3">
                            <Image
                              source={safeImageSource(buyMeta?.logoURI ?? '')}
                              className="w-6 h-6 rounded-full mr-1"
                            />
                            <Text className="text-white text-sm font-semibold">
                              {isBuyNativeSol
                                ? 'SOL'
                                : buyMeta?.symbol ??
                                  (buyMint ? buyMint.slice(0, 6) : 'N/A')}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-300 text-sm font-medium">
                          Pool fee
                        </Text>
                        <Text className="text-white text-sm font-semibold">
                          {bestPool.feeRate
                            ? `${bestPool.feeRate.toFixed(4)}%`
                            : 'N/A'}
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-300 text-sm font-medium">
                          Pool ID
                        </Text>
                        <View className="flex-row items-center">
                          <Text className="text-white text-sm font-semibold">
                            {bestPool.id
                              ? `${bestPool.id.slice(
                                  0,
                                  4,
                                )} **** ${bestPool.id.slice(-4)}`
                              : 'N/A'}
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              Clipboard.setString(bestPool.id ?? '')
                            }
                            className="p-1"
                            accessibilityLabel="Copy pool id"
                          >
                            <CopyIcon width={16} height={16} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-300 text-sm font-medium">
                          Slippage tolerance
                        </Text>
                        <Text className="text-white text-sm font-semibold">
                          {slippage}%
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-300 text-sm font-medium">
                          {supportLabel}
                        </Text>
                        <Text className="text-white text-sm font-semibold">
                          {supportUI.toFixed(4)}{' '}
                          {isBuyNativeSol ? 'SOL' : supportSymbol}
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-300 text-sm font-medium">
                          Cluster
                        </Text>
                        <Text className="text-white text-sm font-semibold">
                          {network}
                        </Text>
                      </View>
                    </View>
                  );
                })()
              ) : (
                <Text className="text-gray-400">
                  No pool found for this pair
                </Text>
              )}
            </View>
          </ScrollView>

          <View className="px-4 pb-2">
            <TouchableOpacity
              disabled={isSwapping}
              onPress={() => navigation.navigate('Home')}
              className="bg-transparent border border-gray-600 py-4 rounded-2xl mb-2"
            >
              <Text className="text-white text-center font-semibold">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={doSwap}
              disabled={isSwapping || !bestPool || !hasEnoughGasFee}
              className={`py-4 rounded-2xl items-center justify-center ${
                isSwapping || !bestPool || !hasEnoughGasFee
                  ? 'bg-gray-400'
                  : 'bg-[#9707B5]'
              }`}
            >
              {isSwapping ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold">
                  Swap
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
