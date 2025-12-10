/* eslint-disable react/no-unstable-nested-components */
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useIsFocused } from '@react-navigation/native';
import BottomNavBar from '../../components/BottomNavBar';
import OpenLinkIcon from '../../assets/icons/open-link.svg';
import Offline from '../../assets/icons/offline.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import UsernameFrame from '../../assets/images/user-logo.png';
import { loadWallet, WalletAccount, WalletData } from '../../utils/storage';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Connection, Transaction, Keypair } from '@solana/web3.js';
import { RootStackParamList } from '../../types/navigation';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { getRpcUrl } from '../../utils/common';

type Props = NativeStackScreenProps<RootStackParamList, 'Rewards'>;
const BASE_URL = 'https://api-platform.pingpay.info';

// utility: convert seconds (global) to structured time (kept as-is)
const convertSeconds = (sec: number) => {
  let seconds = sec;
  const months = Math.floor(seconds / (30 * 24 * 60 * 60)); // 30-day month approx
  seconds %= 30 * 24 * 60 * 60;
  const days = Math.floor(seconds / (24 * 60 * 60));
  seconds %= 24 * 60 * 60;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  return { months, days, hours, minutes, seconds };
};

// utility: convert milliseconds remaining to DD HH MM SS object
const msToDhms = (ms: number) => {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  let seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / (24 * 3600));
  seconds %= 24 * 3600;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  return { days, hours, minutes, seconds };
};

export default function RewardsScreen({ navigation }: Props) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [bearerToken, setBearerToken] = useState<string | null>(null);
  const [freeUSDT, setFreeUSDT] = useState<number>(0);
  const [lockedUSDT, setLockedUSDT] = useState<number>(0);
  const [rewardsList, setRewardsList] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [claimModal, setClaimModal] = useState(false);
  const [claimAmount, setClaimAmount] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [activeTab, setActiveTab] = useState<'rewards' | 'withdrawals'>(
    'rewards',
  );
  const [rewardPage, setRewardPage] = useState(1);
  const [withdrawPage, setWithdrawPage] = useState(1);
  const [rewardTotal, setRewardTotal] = useState(0);
  const [withdrawTotal, setWithdrawTotal] = useState(0);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const isFocused = useIsFocused();

  // NEW: map of reward id -> remaining ms (for per-reward countdown)
  const [rewardRemainingMs, setRewardRemainingMs] = useState<
    Record<string, number>
  >({});

  // keep interval ref so we can clear it
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

  /** -----------------------
   * Utilities for safe parsing
   * ----------------------- */
  const safeFetchJson = async (input: RequestInfo, init?: RequestInit) => {
    const res = await fetch(input, init);
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (!res.ok) {
        const message =
          parsed?.message ||
          parsed?.error ||
          `HTTP ${res.status} ${res.statusText}`;
        throw new Error(message);
      }
      return parsed;
    } catch (err) {
      const snippet = text?.slice?.(0, 100) ?? String(text);
      const statusText = (res && `${res.status} ${res.statusText}`) || 'non-OK';
      console.log(
        `safeFetchJson - non-json response (${statusText}):`,
        snippet,
      );
      throw new Error(
        `Invalid JSON response from server (${statusText}): ${snippet}`,
      );
    }
  };

  /** ========================
   * Load Wallet & Account
   * ======================== */
  const loadUserWallet = async () => {
    try {
      const data = await loadWallet();
      if (!data) return;
      setWallet(data);
      const acc = data.accounts.find(a => a.id === data.currentAccountId);
      if (acc) {
        // switching account -> clear previous token + lists
        setAccount(acc);
        setBearerToken(null);
        setRewardsList([]);
        setWithdrawals([]);
        setFreeUSDT(0);
        setLockedUSDT(0);
        setRewardRemainingMs({});
      }
    } catch (e) {
      console.log('Wallet load error:', e);
    }
  };

  /** ========================
   * Authenticate + initial fetch
   * ======================== */
  const authenticateAndFetch = async (showMainLoading = false) => {
    if (!account) return;
    try {
      if (showMainLoading) setLoading(true);
      const PUBLIC_KEY = account.publicKey;
      const PRIVATE_KEY_B58 = account.secretKey;
      const secretKey = bs58.decode(PRIVATE_KEY_B58);
      // initiate sign-in

      const init = await safeFetchJson(`${BASE_URL}/user/a/initiate-sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: PUBLIC_KEY }),
      });

      if (!init?.body?.message) throw new Error('No challenge message');
      const msgBytes = new TextEncoder().encode(init.body.message);
      const signature = nacl.sign.detached(msgBytes, secretKey);
      const sig58 = bs58.encode(signature);

      // complete sign-in
      const auth = await safeFetchJson(`${BASE_URL}/user/a/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: PUBLIC_KEY, signature: sig58 }),
      });

      const token = auth?.body?.token;
      if (!token) throw new Error('Auth token missing');
      setBearerToken(token);

      // fetch balances
      const bal = await safeFetchJson(`${BASE_URL}/user/d/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFreeUSDT(parseFloat(bal.body?.balance?.free || 0));
      setLockedUSDT(parseFloat(bal.body?.balance?.locked || 0));
      // fetch first page
      await fetchPaginatedData(token);
    } catch (e: any) {
      console.log('Auth error:', e);
      Toast.show({ type: 'error', text1: 'Failed to authenticate wallet' });
    } finally {
      setLoading(false);
    }
  };

  /** ========================
   * Fetch paginated rewards & withdrawals
   * ======================== */
  const fetchPaginatedData = async (tokenParam?: string) => {
    try {
      setListLoading(true);
      const token = tokenParam || bearerToken;
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      // Rewards endpoint
      try {
        const rewardData = await safeFetchJson(
          `${BASE_URL}/user/d/payments?page=${rewardPage}&limit=10`,
          { headers },
        );
        const payments = rewardData.body?.payments || [];

        setRewardsList(payments);
        setRewardTotal(rewardData.body?.pagination?.total || 0);
        // build per-item remaining ms map
        buildRemainingMap(payments);
      } catch (err) {
        console.log('Rewards fetch error:', err);
        setRewardsList([]);
        setRewardTotal(0);
        setRewardRemainingMs({});
      }
      // Withdrawals endpoint
      try {
        const wdData = await safeFetchJson(`${BASE_URL}/user/d/withdrawls`, {
          headers,
        });
        setWithdrawals(wdData.body?.withdrawals || []);
        setWithdrawTotal(wdData.body?.pagination?.total || 0);
      } catch (err) {
        console.log('Withdrawals fetch error:', err);
        setWithdrawals([]);
        setWithdrawTotal(0);
      }
    } catch (err) {
      console.log('Pagination fetch error:', err);
    } finally {
      setListLoading(false);
    }
  };

  // builds the rewardRemainingMs map based on rewards array
  const buildRemainingMap = (payments: any[]) => {
    const map: Record<string, number> = {};
    const now = Date.now();
    payments.forEach(item => {
      // tx.time is ISO string per your confirmation
      const txTimeIso = item.transaction?.tx?.time;
      // fallback: if txTimeIso missing, use createdAt or 0
      const baseTime = txTimeIso ? new Date(txTimeIso).getTime() : 0;
      // 30 days lock in ms
      const unlockTime = baseTime + 30 * 24 * 60 * 60 * 1000;
      const remaining = unlockTime - now;
      // choose unique id for mapping - prefer payment_uid, else fallback to index/_id
      const id =
        item.transaction?.params?.payment_uid ||
        item.transaction?.tx?.hash ||
        item._id ||
        `${baseTime}_${Math.random()}`;
      map[id] = remaining > 0 ? remaining : 0;
    });
    setRewardRemainingMs(map);
  };

  /** ========================
   * Claim flow
   * ======================== */
  const handleClaim = async () => {
    const numAmount = Number(claimAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Please enter a valid number amount',
      });
      return;
    }
    if (numAmount > freeUSDT) {
      Toast.show({ type: 'error', text1: 'Insufficient Reward Balance' });
      return;
    }
    try {
      setIsClaiming(true);
      const res = await safeFetchJson(`${BASE_URL}/user/d/withdraw`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: numAmount }),
      });
      if (res.success && res.body?.encodedTx) {
        await signAndSendTransaction(res.body.encodedTx);
        Toast.show({ type: 'success', text1: 'Claim completed successfully!' });
        setClaimModal(false);
        // refresh lists after claim
        await fetchPaginatedData(bearerToken || undefined);
      } else {
        throw new Error(res.message || 'Claim failed');
      }
    } catch (e: any) {
      console.log('Claim error:', e);
      Toast.show({ type: 'error', text1: 'Claim request failed' });
    } finally {
      setIsClaiming(false);
    }
  };

  const signAndSendTransaction = async (encodedTx: string) => {
    try {
      if (wallet) {
        const PRIVATE_KEY_B58 = account?.secretKey!;
        const secretKey = bs58.decode(PRIVATE_KEY_B58);
        const keypair = Keypair.fromSecretKey(secretKey);
        const connection = new Connection(getRpcUrl(wallet?.network));
        const txBuffer = Buffer.from(encodedTx, 'base64');
        const transaction = Transaction.from(txBuffer);
        transaction.sign(keypair);
        await connection.sendRawTransaction(transaction.serialize());
      } else {
        throw new Error('Wallet not found');
      }
    } catch (e) {
      console.log('Transaction signing error:', e);
      throw e;
    }
  };

  /** ========================
   * Helpers & small components
   * ======================== */
  const openExplorer = (hash: string) => {
    if (!hash) return;
    const url = `https://explorer.solana.com/tx/${hash}?cluster=mainnet-beta`;
    Linking.openURL(url);
  };

  const formatDate = (iso: string) =>
    iso ? new Date(iso).toLocaleString('en-IN', { hour12: true }) : '';

  const getStatusDotColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '#FFD700';
      case 'success':
      case 'completed':
        return '#00FF7F';
      case 'failed':
        return '#FF4500';
      default:
        return '#999';
    }
  };

  const Pagination = ({
    page,
    setPage,
    total,
  }: {
    page: number;
    setPage: (p: number) => void;
    total: number;
  }) => {
    const canPrev = page > 1;
    const canNext = page * 10 < total;
    return (
      <View className="flex-row justify-center items-center mt-2 space-x-3">
        <TouchableOpacity
          disabled={!canPrev}
          onPress={() => setPage(page - 1)}
          className={`px-4 py-2 rounded-lg border ${
            canPrev ? 'border-[#9707B5]' : 'border-gray-600'
          }`}
        >
          <Text className="text-white text-sm">{'<<'}</Text>
        </TouchableOpacity>
        <View className="px-4 py-2 rounded-lg border border-gray-700">
          <Text className="text-white text-sm">Page {page}</Text>
        </View>
        <TouchableOpacity
          disabled={!canNext}
          onPress={() => setPage(page + 1)}
          className={`px-4 py-2 rounded-lg border ${
            canNext ? 'border-[#9707B5]' : 'border-gray-600'
          }`}
        >
          <Text className="text-white text-sm">{'>>'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /** ========================
   * Per-reward countdown interval
   * - builds map when rewardsList changes
   * - single interval updates remaining ms for all rewards each second
   * ======================== */
  useEffect(() => {
    // If there is an existing interval, clear it before starting new
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Ensure rewardRemainingMs is populated if rewardsList already set
    buildRemainingMap(rewardsList);

    // Start interval only if there are rewards
    if (
      Object.keys(rewardRemainingMs).length === 0 &&
      rewardsList.length === 0
    ) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setRewardRemainingMs(prev => {
        const updated: Record<string, number> = {};
        const now = Date.now();
        // iterate current rewardsList for stable keys (rebuild map each tick based on rewardsList to avoid stale keys)
        rewardsList.forEach(item => {
          const txTimeIso = item.transaction?.tx?.time;
          const baseTime = txTimeIso ? new Date(txTimeIso).getTime() : 0;
          const unlockTime = baseTime + 30 * 24 * 60 * 60 * 1000;
          const remaining = Math.max(unlockTime - now, 0);
          const id =
            item.transaction?.params?.payment_uid ||
            item.transaction?.tx?.hash ||
            item._id ||
            `${baseTime}_${Math.random()}`;
          updated[id] = remaining;
        });
        return updated;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // we rely on rewardsList so re-run whenever it changes
  }, [rewardsList]);

  /** ========================
   * Hooks: focus / account changes / pages
   * ======================== */
  useEffect(() => {
    if (isFocused) loadUserWallet();
  }, [isFocused]);

  useEffect(() => {
    if (account) authenticateAndFetch(true);
  }, [account?.id, isConnected]);

  useEffect(() => {
    if (bearerToken && account) fetchPaginatedData(bearerToken);
  }, [bearerToken, rewardPage, withdrawPage]);

  /** ========================
   * Render
   * ======================== */
  if (!isConnected) {
    return (
      <View className="flex-1 bg-black">
        <View className="flex-1 justify-center items-center">
          <Offline width={80} height={80} />
          <Text className="text-white text-lg mt-6 font-semibold">
            Please connect to the internet
          </Text>
        </View>
        <BottomNavBar active="Rewards" />
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator color="#9707B5" size="large" />
        <Text className="text-white mt-3">Loading rewards...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="px-5 pt-5 flex-row items-center space-x-3 mb-4">
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

      {/* Content */}
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Balances */}
        <View className="flex-row justify-between mb-2">
          <View className="flex-1 bg-blue-600 rounded-2xl p-4 mr-2 shadow-lg">
            <Text className="text-white text-sm font-semibold">
              Available USDT
            </Text>
            <Text className="text-white text-base font-bold">
              {freeUSDT.toFixed(4)} USDT
            </Text>
          </View>
          <View className="flex-1 bg-yellow-600 rounded-2xl p-4 ml-2 shadow-lg">
            <Text className="text-black text-sm font-semibold">
              Locked Rewards
            </Text>
            <Text className="text-black text-base font-bold">
              {lockedUSDT.toFixed(4)} USDT
            </Text>
          </View>
        </View>

        {/* Claim */}
        <TouchableOpacity
          disabled={isClaiming}
          onPress={() => {
            setClaimModal(true);
          }}
          className={`rounded-2xl py-2 mb-2 items-center shadow-lg ${
            isClaiming ? 'bg-gray-600' : 'bg-[#9707B5]'
          }`}
        >
          <Text className="text-white text-xl font-bold">
            {isClaiming ? 'Claiming...' : 'Claim'}
          </Text>
        </TouchableOpacity>
        <Text className="text-yellow-300 text-center text-xs">
          NOTE: User can't able to claim rewards when any pending is available
        </Text>

        {/* Tabs */}
        <View className="flex-row mb-2">
          <TouchableOpacity
            className={`flex-1 p-3 border-b-2 ${
              activeTab === 'rewards'
                ? 'border-[#9707B5]'
                : 'border-transparent'
            }`}
            onPress={() => setActiveTab('rewards')}
          >
            <Text
              className={`text-center text-white ${
                activeTab === 'rewards' ? 'font-bold' : 'font-normal'
              }`}
            >
              Rewards
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 p-3 border-b-2 ${
              activeTab === 'withdrawals'
                ? 'border-[#9707B5]'
                : 'border-transparent'
            }`}
            onPress={() => setActiveTab('withdrawals')}
          >
            <Text
              className={`text-center text-white ${
                activeTab === 'withdrawals' ? 'font-bold' : 'font-normal'
              }`}
            >
              Withdrawals
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lists */}
        {activeTab === 'rewards' ? (
          listLoading ? (
            <ActivityIndicator color="#9707B5" size="small" />
          ) : rewardsList.length === 0 ? (
            <Text className="text-gray-400 text-center mt-4">
              No transactions available
            </Text>
          ) : (
            rewardsList.map((item, i) => {
              const tx = item.transaction?.tx || {};
              const hash = tx.hash || '';
              const shortHash = hash
                ? `${hash.slice(0, 4)}...${hash.slice(-4)}`
                : '';

              // Unique ID for countdown mapping
              const id =
                item.transaction?.params?.payment_uid ||
                item.transaction?.tx?.hash ||
                item._id ||
                `${i}`;

              const remainingMs = rewardRemainingMs[id] ?? 0;
              const { days, hours, minutes, seconds } = msToDhms(remainingMs);

              const pad = (n: number) => n.toString().padStart(2, '0');
              const unlocked = remainingMs <= 0;

              return (
                <View
                  key={i}
                  className="bg-gray-800 rounded-xl px-4 py-2 mb-3 shadow-md"
                >
                  {/* TOP SECTION */}
                  <View className="flex-row justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-white text-xs font-semibold">
                        ID: {item.transaction?.params?.payment_uid || '-'}
                      </Text>

                      {hash ? (
                        <TouchableOpacity
                          onPress={() => openExplorer(hash)}
                          className="flex-row items-center mt-1 space-x-1"
                        >
                          <Text className="text-blue-400 text-xs">
                            Explorer :{shortHash}
                          </Text>
                          <OpenLinkIcon width={12} height={12} fill="#38bdf8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View className="items-end">
                      <Text className="text-green-400 text-xs font-semibold">
                        +{item.transaction?.reward?.usdt_amount || 0} USDT
                      </Text>
                      <Text className="text-yellow-400 text-xs font-semibold">
                        {item.transaction?.processed?.mea_amount || 0} MEA
                      </Text>
                    </View>
                  </View>

                  {/* SEPARATOR */}
                  <View
                    style={{
                      height: 1,
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      marginVertical: 5,
                    }}
                  />

                  {/* COUNTDOWN SECTION */}
                  {/* COUNTDOWN / REFUND SECTION */}
                  <View style={{ width: '100%', marginTop: 1 }}>
                    {item.rewardStatus === 'cancelled' ? (
                      <Text
                        style={{
                          color: '#EF4444',
                          fontSize: 14,
                          fontWeight: '700',
                          textAlign: 'center',
                        }}
                      >
                        ⛔ Reward Refunded
                      </Text>
                    ) : unlocked ? (
                      <Text
                        style={{
                          color: '#9AE6B4',
                          fontSize: 14,
                          fontWeight: '700',
                          textAlign: 'center',
                        }}
                      >
                        ⭐ Rewards Unlocked
                      </Text>
                    ) : (
                      <>
                        <Text
                          style={{
                            color: '#d1d5db',
                            fontSize: 12,
                            fontWeight: '600',
                            textAlign: 'center',
                            marginBottom: 6,
                          }}
                        >
                          Rewards will Unlock In
                        </Text>

                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            gap: 6,
                          }}
                        >
                          {[
                            { label: 'Days', value: days },
                            { label: 'Hrs', value: hours },
                            { label: 'Min', value: minutes },
                            { label: 'Sec', value: seconds },
                          ].map((box, idx) => (
                            <View
                              key={idx}
                              style={{
                                flex: 1,
                                backgroundColor: 'rgba(0,0,0,0.35)',
                                paddingVertical: 5,
                                borderRadius: 10,
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.1)',
                              }}
                            >
                              <Text
                                style={{
                                  color: '#FDE047',
                                  fontSize: 12,
                                  fontWeight: '800',
                                }}
                              >
                                {pad(box.value)}
                              </Text>
                              <Text
                                style={{
                                  color: '#d1d5db',
                                  marginTop: 2,
                                  fontSize: 8,
                                  fontWeight: '500',
                                }}
                              >
                                {box.label}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )
        ) : listLoading ? (
          <ActivityIndicator color="#9707B5" size="small" />
        ) : withdrawals.length === 0 ? (
          <Text className="text-gray-400 text-center mt-4">
            No transactions available
          </Text>
        ) : (
          withdrawals.map((item, i) => (
            <View
              key={i}
              className="bg-gray-800 rounded-xl p-4 mb-3 shadow-md flex-row justify-between"
            >
              <View>
                <Text className="text-white text-xs font-semibold">
                  ID: {item._id}
                </Text>
                <Text className="text-gray-400 text-xs mt-1">
                  Time: {formatDate(item.createdAt)}
                </Text>
              </View>
              <View className="items-end -mt-1">
                <Text className="text-green-400 text-sm">
                  +{item.amount} USDT
                </Text>
                <View className="flex-row items-center space-x-2 mt-1">
                  <Text className="text-white text-xs capitalize">
                    {item.status}
                  </Text>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: getStatusDotColor(item.status),
                    }}
                  />
                </View>
              </View>
            </View>
          ))
        )}

        {/* Pagination */}
        {((activeTab === 'rewards' && rewardsList.length > 0) ||
          (activeTab === 'withdrawals' && withdrawals.length > 0)) &&
          (activeTab === 'rewards' ? (
            <Pagination
              page={rewardPage}
              setPage={setRewardPage}
              total={rewardTotal}
            />
          ) : (
            <Pagination
              page={withdrawPage}
              setPage={setWithdrawPage}
              total={withdrawTotal}
            />
          ))}
      </ScrollView>

      {/* Claim Modal */}
      <Modal transparent visible={claimModal} animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View className="bg-gray-900 rounded-2xl p-6 w-4/5">
            <Text className="text-white text-lg font-semibold mb-3 text-center">
              Enter Claim Amount
            </Text>
            <TextInput
              value={claimAmount}
              onChangeText={t => setClaimAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="Amount (USDT)"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              className="bg-gray-800 text-white rounded-lg px-4 py-3 mb-3 text-center text-base"
            />
            <Text className="text-yellow-400 text-xs text-center mb-4">
              The received amount is deposited into your wallet in terms of MEA
              tokens
            </Text>
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => setClaimModal(false)}
                className="flex-1 bg-gray-700 rounded-lg py-3 mx-1 items-center"
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={
                  !claimAmount || Number(claimAmount) > freeUSDT || isClaiming
                }
                onPress={handleClaim}
                className={`flex-1 rounded-lg py-3 mx-1 items-center ${
                  !claimAmount || Number(claimAmount) > freeUSDT
                    ? 'bg-gray-600'
                    : 'bg-[#9707B5]'
                }`}
              >
                <Text className="text-white font-semibold">
                  {isClaiming ? 'Claiming...' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavBar active="Rewards" />
    </SafeAreaView>
  );
}
