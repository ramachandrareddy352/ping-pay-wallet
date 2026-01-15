/* eslint-disable react/no-unstable-nested-components */
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  Linking,
  Dimensions,
  Platform,
  StyleSheet,
  Image,
} from 'react-native';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';

import { RootStackParamList } from '../../types/navigation';
import { loadWallet, WalletAccount, WalletData } from '../../utils/storage';
import BottomNavBar from '../../components/BottomNavBar';
import UsernameFrame from '../../assets/images/user-logo.png';
import Offline from '../../assets/icons/offline.svg';
import OpenLinkIcon from '../../assets/icons/open-link.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import TxSentIcon from '../../assets/icons/tx-sent.svg';
import TxReceivedIcon from '../../assets/icons/tx-received.svg';
import TxDappIcon from '../../assets/icons/tx-dapp.svg';
import TxErrorIcon from '../../assets/icons/tx-error.svg'; // default / fallback

import { useIsFocused } from '@react-navigation/native';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const LIMIT = 10;
const BATCH_SIZE = 10;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionHistory'>;

export enum TransactionType {
  All = 'All',
  Sent = 'sent',
  Received = 'received',
  DappInteraction = 'dapp_interaction',
}

interface Token {
  mint: string;
  change: number;
  isNFT: boolean;
  direction?: string;
  type?: string;
}

interface SolanaTransaction {
  signature: string;
  blockTime: number;
  slot: number;
  type: string;
  subtype: string | null;
  details: {
    solChange: number;
    fee: number;
    programs: string[];
    tokens: Token[];
  };
  formatted?: {
    date: string;
    time: string;
  };
}

interface PaginationState {
  currentPage: number;
  allSignatures: Array<{ signature: string; blockTime: number }>;
  lastBefore: string | undefined;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const getTxIcon = (type: string) => {
  switch (type) {
    case 'sent':
      return TxSentIcon;
    case 'received':
      return TxReceivedIcon;
    case 'dapp_interaction':
      return TxDappIcon;
    default:
      return TxErrorIcon;
  }
};

const getTxIconBg = (type: string) => {
  switch (type) {
    case 'sent':
      return '#EF444420';
    case 'received':
      return '#10B98120';
    case 'dapp_interaction':
      return '#8B5CF620';
    default:
      return '#F59E0B20'; // warning
  }
};

export default function SolanaHistoryScreen({ navigation }: Props) {
  const [isConnected, setIsConnected] = useState(true);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<SolanaTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<SolanaTransaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<TransactionType>(
    TransactionType.All,
  );
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  // Pagination states
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    allSignatures: [],
    lastBefore: undefined,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const isFocused = useIsFocused();
  const mountedRef = useRef(true);

  // INTERNET MONITOR
  useEffect(() => {
    mountedRef.current = true;
    const unsub = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      if (!state.isConnected) {
        Toast.show({ type: 'error', text1: 'No internet connection' });
      }
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, []);

  // LOAD WALLET
  const loadUserWallet = async () => {
    try {
      const data = await loadWallet();
      if (!data) return;
      setWallet(data);
      const acc = data.accounts.find(a => a.id === data.currentAccountId);
      if (acc) {
        setAccount(acc);
      }
    } catch (err) {
      console.log('Wallet load error:', err);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadUserWallet();
    }
  }, [isFocused]);

  useEffect(() => {
    loadUserWallet();
  }, []);

  // FETCH SOLANA TRANSACTIONS FOR CURRENT PAGE
  const fetchSolanaTransactions = async (
    pageNum: number = 1,
    reset: boolean = false,
  ) => {
    if (!account || !isConnected) {
      return;
    }

    try {
      setListLoading(true);
      const connection = new Connection(
        wallet?.network === 'devnet'
          ? 'https://kirstyn-7fsg6s-fast-devnet.helius-rpc.com'
          : 'https://rosemaria-weqok5-fast-mainnet.helius-rpc.com',
      );
      const address = new PublicKey(account.publicKey);

      let allSigs = [...pagination.allSignatures];
      let currentLastBefore: string | undefined = pagination.lastBefore;

      if (reset) {
        allSigs = [];
        currentLastBefore = undefined;
      }

      const startIdx = (pageNum - 1) * LIMIT;
      const neededSigs = startIdx + LIMIT;

      // Lazily fetch more signatures as needed for the requested page (cap at 500 for performance)
      while (allSigs.length < neededSigs && allSigs.length < 500) {
        const neededMore = neededSigs - allSigs.length;
        const batchLimit = Math.min(BATCH_SIZE, neededMore);
        const batch = await connection.getSignaturesForAddress(address, {
          limit: batchLimit,
          before: currentLastBefore,
        });

        if (batch.length === 0) break;

        const sigWithTime = batch
          .filter(s => s.blockTime !== null)
          .map(s => ({
            signature: s.signature,
            blockTime: s.blockTime || 0,
          }));

        allSigs = [...allSigs, ...sigWithTime];
        currentLastBefore = batch[batch.length - 1].signature;
      }

      const totalFetched = allSigs.length;
      let effectivePageNum = pageNum;
      if (startIdx >= totalFetched) {
        effectivePageNum = Math.ceil(totalFetched / LIMIT) || 1;
      }

      const pageStartIdx = (effectivePageNum - 1) * LIMIT;
      const pageSignatures = allSigs.slice(pageStartIdx, pageStartIdx + LIMIT);

      if (pageSignatures.length === 0) {
        if (!mountedRef.current) return;
        setTransactions([]);
        setPagination(prev => ({
          ...prev,
          currentPage: 1,
          allSignatures: [],
          lastBefore: undefined,
          hasNextPage: false,
          hasPrevPage: false,
        }));
        return;
      }

      // Fetch details for the page signatures in parallel
      const detailPromises = pageSignatures.map(sigInfo =>
        connection
          .getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          })
          .then(tx => {
            if (!tx) return null;
            try {
              const categorization = categorizeTransaction(
                tx,
                account.publicKey,
              );
              const date = new Date(sigInfo.blockTime * 1000);

              return {
                signature: sigInfo.signature,
                blockTime: sigInfo.blockTime,
                slot: tx.slot,
                type: categorization.type,
                subtype: categorization.subtype,
                details: categorization.details,
                formatted: {
                  date: date.toLocaleDateString(),
                  time: date.toLocaleTimeString(),
                },
              } as SolanaTransaction;
            } catch (err) {
              console.log(`Error categorizing tx ${sigInfo.signature}:`, err);
              return null;
            }
          })
          .catch(err => {
            console.log(`Error fetching tx ${sigInfo.signature}:`, err);
            return null;
          }),
      );

      const rawCategorizedTxs = await Promise.all(detailPromises);
      let categorizedTxs: SolanaTransaction[] = rawCategorizedTxs.filter(
        (tx): tx is SolanaTransaction => tx !== null,
      );

      // Filter by selected type
      categorizedTxs = categorizedTxs.filter(
        tx => selectedType === TransactionType.All || tx.type === selectedType,
      );

      if (!mountedRef.current) return;

      setTransactions(categorizedTxs);

      // Peek to check if there are more signatures beyond the fetched ones
      let hasNextPage = false;
      if (totalFetched < 500) {
        const peekBatch = await connection.getSignaturesForAddress(address, {
          limit: 1,
          before: currentLastBefore,
        });
        hasNextPage = peekBatch.length > 0;
      }

      setPagination(prev => ({
        ...prev,
        currentPage: effectivePageNum,
        allSignatures: allSigs,
        lastBefore: currentLastBefore,
        hasNextPage,
        hasPrevPage: effectivePageNum > 1,
      }));
    } catch (err) {
      console.log('Fetch Solana transactions error:', err);
      Toast.show({ type: 'error', text1: 'Failed to fetch transactions' });
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (account && isConnected) {
      fetchSolanaTransactions(1);
      setLoading(false);
    }
  }, [account?.id, isConnected]);

  // Reset to page 1 on type filter change (keep signature cache)
  useEffect(() => {
    fetchSolanaTransactions(1, false);
  }, [selectedType]);

  // HANDLE NEXT PAGE
  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      fetchSolanaTransactions(pagination.currentPage + 1, false);
    }
  };

  // HANDLE PREVIOUS PAGE
  const handlePrevPage = () => {
    if (pagination.hasPrevPage) {
      fetchSolanaTransactions(pagination.currentPage - 1, false);
    }
  };

  // CATEGORIZE TRANSACTION
  const categorizeTransaction = (tx: any, ownerAddress: string) => {
    const meta = tx.meta;
    if (!meta) {
      return {
        type: 'unknown',
        subtype: null,
        details: { solChange: 0, fee: 0, tokens: [], programs: [] },
      };
    }

    const accountKeys = tx.transaction.message.accountKeys;
    const accountIndex = accountKeys.findIndex(
      (key: any) => key.toBase58() === ownerAddress,
    );
    if (accountIndex === -1) {
      return {
        type: 'unknown',
        subtype: null,
        details: { solChange: 0, fee: 0, tokens: [], programs: [] },
      };
    }

    const preSol = meta.preBalances[accountIndex] || 0;
    const postSol = meta.postBalances[accountIndex] || 0;
    const solChange = (postSol - preSol) / LAMPORTS_PER_SOL;
    const fee = (meta.fee || 0) / LAMPORTS_PER_SOL;
    const netSolChange = solChange + fee;

    // Extract programs
    const instructions = tx.transaction.message.instructions;
    const programIds: string[] = instructions
      .map((ix: any) => {
        if ('programIdIndex' in ix) {
          const progIdx = ix.programIdIndex;
          const pubkey = accountKeys[progIdx];
          return pubkey ? pubkey.toBase58() : null;
        }
        return null;
      })
      .filter((p: string | null): p is string => p !== null);

    const uniquePrograms = Array.from(new Set(programIds));

    // Token balance changes
    const preTokens = meta.preTokenBalances || [];
    const postTokens = meta.postTokenBalances || [];
    const ownerPreTokens = preTokens.filter(
      (t: any) => t.owner === ownerAddress,
    );
    const ownerPostTokens = postTokens.filter(
      (t: any) => t.owner === ownerAddress,
    );

    const sentTokens: Token[] = [];
    const receivedTokens: Token[] = [];

    for (const preToken of ownerPreTokens) {
      const postToken = ownerPostTokens.find(
        (t: any) =>
          t.mint === preToken.mint && t.accountIndex === preToken.accountIndex,
      );
      if (postToken) {
        const preAmount = parseFloat(
          preToken.uiTokenAmount.uiAmountString || '0',
        );
        const postAmount = parseFloat(
          postToken.uiTokenAmount.uiAmountString || '0',
        );
        const change = postAmount - preAmount;
        if (change < 0) {
          sentTokens.push({
            mint: preToken.mint,
            change: Math.abs(change),
            isNFT: (preToken.uiTokenAmount.decimals || 0) === 0,
          });
        } else if (change > 0) {
          receivedTokens.push({
            mint: postToken.mint,
            change,
            isNFT: (postToken.uiTokenAmount.decimals || 0) === 0,
          });
        }
      }
    }

    for (const postToken of ownerPostTokens) {
      if (
        !ownerPreTokens.find(
          (t: any) =>
            t.mint === postToken.mint &&
            t.accountIndex === postToken.accountIndex,
        )
      ) {
        const amount = parseFloat(
          postToken.uiTokenAmount.uiAmountString || '0',
        );
        receivedTokens.push({
          mint: postToken.mint,
          change: amount,
          isNFT: (postToken.uiTokenAmount.decimals || 0) === 0,
        });
      }
    }

    // Categorization logic
    const hasTokenActivity = sentTokens.length > 0 || receivedTokens.length > 0;
    const isSwapLike =
      (hasTokenActivity &&
        sentTokens.length > 0 &&
        receivedTokens.length > 0) ||
      uniquePrograms.some(
        pid =>
          pid === '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' ||
          pid === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' ||
          pid === '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
      );
    const isFeeOnly = Math.abs(netSolChange) < 0.0001 && !hasTokenActivity;

    let type = 'unknown';
    let subtype = null;

    if (isSwapLike || isFeeOnly) {
      type = 'dapp_interaction';
      subtype = isSwapLike ? 'swap' : 'contract_call';
    } else if (netSolChange > 0 || receivedTokens.length > 0) {
      type = 'received';
    } else if (netSolChange < 0 || sentTokens.length > 0) {
      type = 'sent';
    }

    const allTokens: Token[] = [
      ...receivedTokens.map(t => ({ ...t, direction: 'received' })),
      ...sentTokens.map(t => ({ ...t, direction: 'sent' })),
    ];

    return {
      type,
      subtype,
      details: {
        solChange,
        fee,
        programs: uniquePrograms,
        tokens: allTokens,
      },
    };
  };

  // FILTER TRANSACTIONS
  // Note: Filtering is now handled inside fetchSolanaTransactions for the current page batch

  // FORMAT FUNCTIONS
  const truncate = (s?: string, len = 6) =>
    s
      ? `${s.slice(0, Math.max(2, Math.floor(len / 2)))}...${s.slice(
          -Math.max(2, Math.floor(len / 2)),
        )}`
      : '-';

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Toast.show({ type: 'success', text1: 'Copied to clipboard' });
  };

  const typeColor = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t === 'sent') return '#EF4444';
    if (t === 'received') return '#10B981';
    if (t === 'dapp_interaction') return '#3B82F6';
    return '#7C88FF';
  };

  // RENDER ITEM
  const renderItem = ({ item }: { item: SolanaTransaction }) => {
    const { signature, type, details, formatted } = item;
    const solAmount = Math.abs(details.solChange);
    const hasTokens = details.tokens && details.tokens.length > 0;

    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedTx(item);
          setModalVisible(true);
        }}
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl mx-4 my-1 p-3 shadow-md border border-gray-700"
        activeOpacity={0.92}
      >
        <View className="flex-row items-start justify-between">
          {/* LEFT SIDE */}
          <View className="flex-row items-start" style={{ flex: 1 }}>
            {/* SVG ICON */}
            <View
              className="mr-3 mt-1 rounded-full items-center justify-center"
              style={{
                width: 50,
                height: 50,
                backgroundColor: getTxIconBg(type),
              }}
            >
              {(() => {
                const Icon = getTxIcon(type);
                return <Icon width={35} height={35} opacity={0.6} />;
              })()}
            </View>

            {/* TEXT CONTENT */}
            <View style={{ flex: 1 }}>
              <View className="flex-row items-center mt-1">
                <Text className="text-gray-300 text-xs mr-2 font-semibold">
                  {type.toUpperCase()}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`,
                  )
                }
                className="flex-row items-center mt-2"
                activeOpacity={0.7}
              >
                <Text className="text-blue-400 text-xs mr-1">
                  {truncate(signature, 8)}
                </Text>
                <OpenLinkIcon width={12} height={12} />
              </TouchableOpacity>

              <Text className="text-gray-500 text-xs mt-2">
                {formatted?.date} {formatted?.time}
              </Text>
            </View>
          </View>

          {/* RIGHT SIDE */}
          <View className="items-end">
            {solAmount > 0 && (
              <View
                className="rounded-lg px-3 py-1 mb-2"
                style={{
                  backgroundColor: '#9707B5',
                  borderWidth: 1,
                  borderColor: '#9702B5',
                }}
              >
                <Text className="text-white font-semibold text-sm">
                  {solAmount.toFixed(4)} SOL
                </Text>
              </View>
            )}

            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: `${typeColor(type)}22` }}
            >
              <Text
                style={{
                  color: typeColor(type),
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {type === 'dapp_interaction' ? 'dApp' : type}
              </Text>
            </View>

            {hasTokens && (
              <Text className="text-gray-400 text-xs mt-2">
                {details.tokens.length} token
                {details.tokens.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ===============================================
  // PAGINATION BAR
  // ===============================================
  const PaginationBar = () => {
    const canPrev = pagination.hasPrevPage;
    const canNext = pagination.hasNextPage;

    return (
      <View className="bg-black p-4">
        <View className="flex-row justify-between items-center px-4">
          <TouchableOpacity
            disabled={!canPrev}
            onPress={handlePrevPage}
            className={`px-4 py-2 rounded-lg ${
              canPrev ? 'border-[#9707B5]' : 'border-gray-700'
            } border`}
          >
            <Text
              className={`text-sm ${canPrev ? 'text-white' : 'text-gray-500'}`}
            >
              {'◀ Prev'}
            </Text>
          </TouchableOpacity>
          <View className="flex-row items-center space-x-4">
            <Text className="text-gray-300 text-sm">
              Page {pagination.currentPage}
            </Text>
          </View>
          <TouchableOpacity
            disabled={!canNext}
            onPress={handleNextPage}
            className={`px-4 py-2 rounded-lg ${
              canNext ? 'border-[#9707B5]' : 'border-gray-700'
            } border`}
          >
            <Text
              className={`text-sm ${canNext ? 'text-white' : 'text-gray-500'}`}
            >
              {'Next ▶'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // TYPE DROPDOWN
  const TypeDropdown = () => {
    return (
      <Modal visible={typeDropdownOpen} transparent animationType="slide">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setTypeDropdownOpen(false)}
        >
          <View style={styles.dropdownCardContainer}>
            <View className="bg-gray-900 border border-gray-700 shadow-2xl">
              <View className="px-4 py-3 bg-gray-800 border-b border-gray-700">
                <Text className="text-white font-semibold text-base">
                  Filter by Type
                </Text>
              </View>
              <View className="p-1 max-h-[320]">
                {Object.values(TransactionType).map((t: any) => {
                  const label =
                    t === 'All'
                      ? 'All'
                      : t === 'dapp_interaction'
                      ? 'dApp'
                      : t.charAt(0).toUpperCase() + t.slice(1);

                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        setSelectedType(t);
                        setTypeDropdownOpen(false);
                      }}
                      className="px-4 py-4 border-b border-gray-800 last:border-b-0"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text
                          className={`text-sm font-medium ${
                            t === selectedType
                              ? 'text-[#9707B5] font-semibold'
                              : 'text-gray-300'
                          }`}
                        >
                          {label}
                        </Text>
                        {t === selectedType && (
                          <View className="w-2 h-2 bg-[#9707B5] rounded-full" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // DETAIL MODAL
  const DetailRow = ({ label, value, small }: any) => (
    <View className="mb-3">
      <Text className="text-gray-400 text-xs">{label}</Text>
      <Text
        className={`text-white ${small ? 'text-sm' : 'text-base'}`}
        numberOfLines={2}
      >
        {value ?? '-'}
      </Text>
    </View>
  );

  const renderModal = () => {
    if (!selectedTx) return null;

    const { signature, type, details, formatted, subtype, slot } = selectedTx;

    return (
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-gray-900 rounded-t-3xl p-5 max-h-[85%]">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white text-lg font-bold">
                Transaction Details
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="p-2"
              >
                <Text className="text-gray-400">Close</Text>
              </TouchableOpacity>
            </View>

            {/* Scroll content */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Summary Block */}
              <View className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-4 mb-4 border border-gray-700">
                <View className="flex-row justify-between items-center mb-3">
                  <View>
                    <Text className="text-gray-300 text-xs">
                      Transaction Type
                    </Text>
                    <Text className="text-white font-semibold">
                      {type === 'dapp_interaction' ? 'dApp' : type}
                      {subtype && ` (${subtype})`}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-gray-300 text-xs">SOL Change</Text>
                    <Text
                      className={`font-bold text-lg ${
                        details.solChange > 0
                          ? 'text-green-400'
                          : details.solChange < 0
                          ? 'text-red-400'
                          : 'text-gray-400'
                      }`}
                    >
                      {details.solChange > 0 ? '+' : ''}
                      {details.solChange.toFixed(6)} SOL
                    </Text>
                  </View>
                </View>
              </View>

              {/* Signature */}
              <DetailRow label="Signature" value={signature} small />
              {signature && (
                <View className="flex-row items-center space-x-3 mb-3">
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(
                        `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`,
                      )
                    }
                    className="flex-row items-center"
                  >
                    <OpenLinkIcon width={14} height={14} />
                    <Text className="text-blue-400 text-sm ml-2">
                      Open in Explorer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(signature)}
                    className="flex-row items-center"
                  >
                    <CopyIcon width={14} height={14} />
                    <Text className="text-gray-400 text-sm ml-2">Copy</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Transaction Info */}
              <View className="mb-4">
                <Text className="text-white font-semibold mb-2">
                  Transaction Info
                </Text>
                <DetailRow label="Slot" value={slot.toString()} />
                <DetailRow
                  label="Fee"
                  value={`${details.fee.toFixed(6)} SOL`}
                />
                <DetailRow
                  label="Date & Time"
                  value={`${formatted?.date} ${formatted?.time}`}
                />
              </View>

              {/* Programs */}
              {details.programs && details.programs.length > 0 && (
                <View className="mb-4">
                  <Text className="text-white font-semibold mb-2">
                    Programs Involved
                  </Text>
                  {details.programs.map((prog, idx) => (
                    <View key={idx} className="mb-2">
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(
                            `https://explorer.solana.com/address/${prog}?cluster=mainnet-beta`,
                          )
                        }
                        className="flex-row items-center"
                      >
                        <Text className="text-blue-400 text-xs mr-2 flex-1">
                          {prog}
                        </Text>
                        <OpenLinkIcon width={12} height={12} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Tokens */}
              {details.tokens && details.tokens.length > 0 && (
                <View className="mb-4">
                  <Text className="text-white font-semibold mb-2">
                    Token Changes
                  </Text>
                  {details.tokens.map((token, idx) => (
                    <View
                      key={idx}
                      className="bg-gray-800 rounded-lg p-3 mb-2 border border-gray-700"
                    >
                      <View className="flex-row justify-between items-start mb-2">
                        <View>
                          <Text className="text-gray-300 text-xs">
                            Mint Address
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              Linking.openURL(
                                `https://explorer.solana.com/address/${token.mint}?cluster=mainnet-beta`,
                              )
                            }
                            className="flex-row items-center mt-1"
                          >
                            <Text className="text-blue-400 text-xs mr-1">
                              {truncate(token.mint, 8)}
                            </Text>
                            <OpenLinkIcon width={12} height={12} />
                          </TouchableOpacity>
                        </View>
                        <Text
                          className={`font-bold ${
                            token.direction === 'received'
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {token.direction === 'received' ? '+' : '-'}
                          {token.change.toFixed(6)}
                          {token.isNFT ? ' NFT' : ''}
                        </Text>
                      </View>
                      {token.isNFT && (
                        <View className="bg-yellow-900/20 rounded px-2 py-1 mt-1">
                          <Text className="text-yellow-400 text-xs">NFT</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Footer */}
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="bg-[#9707B5] rounded-xl py-3 items-center mt-4 mb-4"
              >
                <Text className="text-white font-semibold">Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // OFFLINE PAGE
  if (!isConnected) {
    return (
      <View className="flex-1 bg-black">
        <View className="flex-1 justify-center items-center">
          <Offline width={80} height={80} />
          <Text className="text-white text-lg mt-6 font-semibold">
            Please connect to the internet
          </Text>
        </View>
        <BottomNavBar active="History" />
      </View>
    );
  }

  // LOADING SCREEN
  if (loading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#9707B5" />
        <Text className="text-white mt-3">Loading transactions...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header + Filter Row */}
      <View className="px-5 pt-5 pb-3 flex-row bg-gray-900 items-center justify-between">
        {/* LEFT: Header */}
        <View className="flex-row items-center flex-1 space-x-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('Accounts')}
            className="w-10 h-10 rounded-full overflow-hidden justify-center items-center"
          >
            <Image
              source={
                account?.imageUri ? { uri: account.imageUri } : UsernameFrame
              }
              className="w-full h-full"
              resizeMode="cover"
            />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-white font-semibold text-base">
              {account?.name || 'My Wallet'}
            </Text>

            <TouchableOpacity
              onPress={() => Clipboard.setString(account?.publicKey || '')}
              className="flex-row items-center gap-1"
            >
              <Text className="text-gray-400 text-xs">
                {account?.publicKey
                  ? `${account.publicKey.slice(
                      0,
                      6,
                    )} **** ${account.publicKey.slice(-6)}`
                  : 'No Account'}
              </Text>
              <CopyIcon width={14} height={14} />
            </TouchableOpacity>
          </View>
        </View>

        {/* RIGHT: Filter */}
        <TouchableOpacity
          onPress={() => setTypeDropdownOpen(true)}
          className="ml-3 rounded-xl border border-gray-700 px-3 py-2"
        >
          <Text className="text-gray-200 text-sm">
            Type:{' '}
            <Text className="text-white font-semibold">
              {selectedType === TransactionType.All
                ? 'All'
                : selectedType === TransactionType.DappInteraction
                ? 'dApp'
                : selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown modals */}
      {TypeDropdown()}

      {/* List */}
      <View style={{ flex: 1, paddingBottom: 0 }}>
        {!listLoading ? (
          <FlatList
            data={transactions}
            keyExtractor={item => item.signature}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchSolanaTransactions(1, true);
            }}
            ListEmptyComponent={
              <View className="items-center justify-center mt-16">
                <Text className="text-gray-400">
                  {selectedType === TransactionType.All
                    ? 'No transactions found'
                    : `No ${selectedType} transactions found`}
                </Text>
              </View>
            }
            ListFooterComponent={
              pagination.allSignatures.length > 0 ? <PaginationBar /> : null
            }
          />
        ) : (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#9707B5" />
            <Text className="text-gray-300 mt-2">Fetching transactions...</Text>
          </View>
        )}
      </View>

      {/* Detail Modal */}
      {renderModal()}

      <BottomNavBar active="History" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dropdownCardContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 110,
    left: 20,
    right: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
