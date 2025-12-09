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

import nacl from 'tweetnacl';
import bs58 from 'bs58';

import { RootStackParamList } from '../../types/navigation';
import { loadWallet, WalletAccount, WalletData } from '../../utils/storage';
import BottomNavBar from '../../components/BottomNavBar';

import UsernameFrame from '../../assets/images/user-logo.png';
import Offline from '../../assets/icons/offline.svg';
import OpenLinkIcon from '../../assets/icons/open-link.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import QRCode from 'react-native-qrcode-svg';
import { useIsFocused } from '@react-navigation/native';

const BASE_URL = 'https://api-platform.pingpay.info';
const LIMIT = 10;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionHistory'>;

export enum PaymentStatus {
  All = 'All',
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Refunded = 'refunded',
}

export enum PaymentType {
  All = 'All',
  DirectTransfer = 'direct_transfer',
  PaymentLink = 'payment_link',
  UserInitiated = 'user_initiated',
}

export default function TransactionHistoryScreen({ navigation }: Props) {
  const [isConnected, setIsConnected] = useState(true);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [bearerToken, setBearerToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Refund QR modal
  const [refundQrVisible, setRefundQrVisible] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);

  // FILTER STATE
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatus>(
    PaymentStatus.All,
  );
  const [selectedType, setSelectedType] = useState<PaymentType>(
    PaymentType.All,
  );

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const isFocused = useIsFocused();

  const mountedRef = useRef(true);

  useEffect(() => {
    if (isFocused) loadUserWallet();
  }, [isFocused]);

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
        setBearerToken(null);
        setTransactions([]);
        setPage(1);
        setTotal(0);
      }
    } catch (err) {
      console.log('Wallet load error:', err);
    }
  };

  useEffect(() => {
    loadUserWallet();
  }, []);

  const authenticateAndFetch = async (showLoading = false) => {
    if (!account) return;
    try {
      if (showLoading) setLoading(true);

      const PUBLIC_KEY = account.publicKey;
      const PRIVATE_KEY_B58 = account.secretKey;
      const secretKey = bs58.decode(PRIVATE_KEY_B58);

      const initRes = await fetch(`${BASE_URL}/user/a/initiate-sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: PUBLIC_KEY }),
      });
      const initJson = await initRes.json();
      const challenge = initJson?.body?.message;
      if (!challenge) throw new Error('Challenge missing');

      const msgBytes = new TextEncoder().encode(challenge);
      const signature = nacl.sign.detached(msgBytes, secretKey);
      const sig58 = bs58.encode(signature);

      const authRes = await fetch(`${BASE_URL}/user/a/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: PUBLIC_KEY, signature: sig58 }),
      });
      const authJson = await authRes.json();
      const token = authJson?.body?.token;
      if (!token) throw new Error('Token missing');

      setBearerToken(token);

      await fetchTransactions(1, token);
    } catch (err: any) {
      console.log('Auth error:', err);
      Toast.show({ type: 'error', text1: 'Authentication failed' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account && isConnected) authenticateAndFetch(true);
  }, [account?.id, isConnected]);

  const safeParse = (text: string) => {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  };

  const buildFilterBody = (
    pg: number,
    status: PaymentStatus,
    type: PaymentType,
  ) => {
    const body: any = { page: pg, limit: LIMIT };
    if (status !== PaymentStatus.All) body.status = status;
    if (type !== PaymentType.All) body.type = type;
    return JSON.stringify(body);
  };

  const fetchTransactions = async (pg = 1, tokenParam?: string) => {
    if (!isConnected) {
      Toast.show({ type: 'error', text1: 'No internet connection' });
      return;
    }
    try {
      setListLoading(true);
      const token = tokenParam || bearerToken;
      if (!token) throw new Error('Missing token');

      const body = buildFilterBody(pg, selectedStatus, selectedType);

      const res = await fetch(`${BASE_URL}/user/p/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      const text = await res.text();
      const json = safeParse(text);

      if (!json || !json.body) {
        console.log('Invalid response for tx list:', text);
        throw new Error('Invalid server response');
      }

      const payments = json.body.payments || [];
      const pagination = json.body.pagination || {};
      if (!mountedRef.current) return;
      setTransactions(payments);
      setTotal(pagination.total || 0);
      setPage(pg);
    } catch (err) {
      console.log('Fetch tx error:', err);
      Toast.show({ type: 'error', text1: 'Failed to fetch history' });
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!bearerToken) return;
    fetchTransactions(1, bearerToken);
  }, [selectedStatus, selectedType]);

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString() : '-';

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

  const statusColor = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('completed') || s.includes('success')) return '#10B981';
    if (s.includes('pending') || s.includes('processing')) return '#F59E0B';
    if (s.includes('failed')) return '#EF4444';
    return '#7C88FF';
  };

  // ===========================================
  // RENDER ITEM WITH REFUND BUTTON
  // ===========================================
  const renderItem = ({ item }: any) => {
    const tx = item.transaction?.tx || {};
    const processed = item.transaction?.processed || {};
    const hash = tx.hash || '';
    const depositAddr = tx.deposit_address || '';
    const meaAmount = processed.mea_amount ?? item.params?.mea_amount ?? 0;
    const status = item.status || 'unknown';
    const type = item.type || '';
    const createdAt = item.createdAt;

    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedTx(item);
          setModalVisible(true);
        }}
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl mx-4 my-1 p-3 shadow-md border border-gray-700"
        activeOpacity={0.92}
      >
        {/* Top row */}
        <View className="flex-row items-start">
          <View style={{ flex: 1 }}>
            <View className="flex-row justify-between items-start">
              {/* Left side */}
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View className="flex-row items-center mt-1">
                  <Text className="text-gray-300 text-xs mr-2">{type}</Text>

                  {hash ? (
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(
                          `https://explorer.solana.com/tx/${hash}?cluster=mainnet-beta`,
                        )
                      }
                      className="flex-row items-center"
                      activeOpacity={0.7}
                    >
                      <Text className="text-blue-400 text-xs mr-1">
                        {truncate(hash, 8)}
                      </Text>
                      <OpenLinkIcon width={12} height={12} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text className="text-gray-400 text-xs mt-2">
                  Deposit: {truncate(depositAddr, 8)}
                </Text>

                <Text className="text-gray-500 text-xs mt-1">
                  {tx.time ? formatDate(tx.time) : formatDate(createdAt)}
                </Text>
              </View>

              {/* Amount + Status */}
              <View className="items-end">
                <View
                  className="rounded-lg px-3 py-1 mb-2"
                  style={{
                    backgroundColor: 'rgba(151,7,181,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(151,7,181,0.16)',
                  }}
                >
                  <Text className="text-[#9707B5] font-semibold text-sm">
                    {meaAmount} MEA
                  </Text>
                </View>

                <View
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: `${statusColor(status)}22` }}
                >
                  <Text
                    style={{
                      color: statusColor(status),
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {status}
                  </Text>
                </View>
              </View>
            </View>

            {/* Payment ID + Refund button */}
            <View className="flex-row items-center justify-between mt-3">
              <TouchableOpacity
                onPress={() => copyToClipboard(item._id)}
                className="flex-row items-center"
              >
                <Text
                  className="text-white font-normal text-sm"
                  numberOfLines={1}
                >
                  Payment ID: {item._id}{' '}
                </Text>
                <CopyIcon width={14} height={14} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ===============================================
  // PAGINATION BAR
  // ===============================================
  const PaginationBar = () => {
    const canPrev = page > 1;
    const canNext = page * LIMIT < total;

    return (
      <View className="bg-black p-4">
        <View className="flex-row justify-between items-center px-4">
          <TouchableOpacity
            disabled={!canPrev}
            onPress={() => {
              const np = Math.max(1, page - 1);
              setPage(np);
              fetchTransactions(np);
            }}
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
            <Text className="text-gray-300 text-sm">Page {page}</Text>
            <Text className="text-gray-400 text-sm">·</Text>
            <Text className="text-gray-300 text-sm">{total} total</Text>
          </View>

          <TouchableOpacity
            disabled={!canNext}
            onPress={() => {
              const np = page + 1;
              setPage(np);
              fetchTransactions(np);
            }}
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

  // =======================================================
  // REFUND QR POPUP
  // =======================================================
  const RefundQRModal = () => (
    <Modal visible={refundQrVisible} transparent animationType="fade">
      <View className="flex-1 bg-black/70 justify-center items-center">
        <View className="bg-gray-900 p-6 rounded-2xl items-center w-80">
          <Text className="text-white text-lg font-semibold mb-4">
            Refund Request
          </Text>

          <View className="bg-white p-4 rounded-xl">
            <QRCode
              value={`${refundPaymentId}`}
              size={220}
              color="black"
              backgroundColor="white"
            />
          </View>

          <Text className="text-gray-400 text-sm mt-4 text-center">
            Scan to refund payment ID:
          </Text>

          <Text className="text-white mt-1 font-medium">{refundPaymentId}</Text>

          <TouchableOpacity
            onPress={() => setRefundQrVisible(false)}
            className="bg-[#9707B5] rounded-xl py-3 px-6 mt-6"
          >
            <Text className="text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // =======================================================
  // STATUS & TYPE DROPDOWNS (sliding modal style)
  // =======================================================
  const StatusDropdown = () => {
    return (
      <Modal visible={statusDropdownOpen} transparent animationType="slide">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setStatusDropdownOpen(false)}
        >
          <View style={styles.dropdownCardContainer}>
            <View className="bg-gray-900 border border-gray-700 shadow-2xl">
              <View className="px-4 py-3 bg-gray-800 border-b border-gray-700">
                <Text className="text-white font-semibold text-base">
                  Filter by Status
                </Text>
              </View>
              <View className="p-1 max-h-[320]">
                {Object.values(PaymentStatus).map((s: any) => {
                  // display capitalization for 'All' and enums
                  const label =
                    typeof s === 'string'
                      ? s === 'All'
                        ? 'All'
                        : s.charAt(0).toUpperCase() + s.slice(1)
                      : String(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        setSelectedStatus(s);
                        setStatusDropdownOpen(false);
                      }}
                      className={`px-4 py-4 border-b border-gray-800 last:border-b-0`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text
                          className={`text-sm font-medium ${
                            s === selectedStatus
                              ? 'text-[#9707B5] font-semibold'
                              : 'text-gray-300'
                          }`}
                        >
                          {label}
                        </Text>
                        {s === selectedStatus && (
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
                {Object.values(PaymentType).map((t: any) => {
                  const label =
                    typeof t === 'string'
                      ? t === 'All'
                        ? 'All'
                        : // show more readable label for snake_case
                          t
                            .split('_')
                            .map(
                              (part: string) =>
                                part.charAt(0).toUpperCase() + part.slice(1),
                            )
                            .join(' ')
                      : String(t);
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        setSelectedType(t);
                        setTypeDropdownOpen(false);
                      }}
                      className={`px-4 py-4 border-b border-gray-800 last:border-b-0`}
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

  // =======================================================
  // DETAIL MODAL (WITH REFUND BUTTON)
  // =======================================================
  const DetailRow = ({ label, value, small }: any) => (
    <View className="mb-3">
      <Text className="text-gray-400 text-xs">{label}</Text>
      <Text className={`text-white ${small ? 'text-sm' : 'text-base'}`}>
        {value ?? '-'}
      </Text>
    </View>
  );

  const renderModal = () => {
    if (!selectedTx) return null;
    const tx = selectedTx.transaction?.tx || {};
    const processed = selectedTx.transaction?.processed || {};
    const reward = selectedTx.transaction?.reward || {};
    const params = selectedTx.params || {};

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
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ paddingBottom: 40 }}
            >
              {/* Summary Block */}
              <View className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-4 mb-4 border border-gray-700">
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-gray-300 text-xs">Payment ID</Text>
                    <Text className="text-white font-semibold">
                      {selectedTx._id}
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text className="text-gray-300 text-xs">Status</Text>
                    <View
                      className="rounded-full px-3 py-1 mt-1"
                      style={{
                        backgroundColor: `${statusColor(selectedTx.status)}22`,
                      }}
                    >
                      <Text
                        style={{
                          color: statusColor(selectedTx.status),
                          fontWeight: '700',
                        }}
                      >
                        {selectedTx.status}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="flex-row justify-between items-end mt-3">
                  <View>
                    <Text className="text-gray-300 text-xs">Processed MEA</Text>
                    <Text className="text-yellow-300 font-semibold text-lg">
                      {processed.mea_amount ?? params.mea_amount ?? 0} MEA
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-gray-300 text-xs">Reward (USDT)</Text>
                    <Text className="text-green-400 font-semibold">
                      {reward.usdt_amount ?? 0} USDT
                    </Text>
                  </View>
                </View>
              </View>

              {/* HASH */}
              <DetailRow label="Hash" value={tx.hash} small />

              {tx.hash ? (
                <View className="flex-row items-center space-x-3 mb-3">
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(
                        `https://explorer.solana.com/tx/${tx.hash}?cluster=mainnet-beta`,
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
                    onPress={() => copyToClipboard(tx.hash)}
                    className="flex-row items-center"
                  >
                    <CopyIcon width={14} height={14} />
                    <Text className="text-gray-400 text-sm ml-2">
                      Copy hash
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <DetailRow
                label="Deposit Address"
                value={tx.deposit_address}
                small
              />

              <DetailRow label="User Address" value={tx.user_address} small />

              <View className="mb-4">
                <Text className="text-gray-400 text-sm mb-2">Amounts</Text>

                <DetailRow
                  label="MEA (processed)"
                  value={`${processed.mea_amount ?? 0} MEA`}
                />
                <DetailRow
                  label="MEA Price"
                  value={processed.mea_price ?? '-'}
                />
                <DetailRow
                  label="Params: MEA amount"
                  value={params.mea_amount ?? '-'}
                />
                <DetailRow
                  label="Params: USDT amount"
                  value={params.usdt_amount ?? '-'}
                />
              </View>

              {/* Reward Block */}
              <View
                className="mb-4 p-3 rounded-xl"
                style={{ backgroundColor: '#041014' }}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-white font-semibold">Reward</Text>
                  <Text className="text-green-400 font-bold">
                    {reward.usdt_amount ?? 0} USDT
                  </Text>
                </View>

                <DetailRow
                  label="Reward Ratio"
                  value={reward.reward_ratio ?? '-'}
                />

                <DetailRow
                  label="Instant Swap"
                  value={params.instant_swap ? 'Yes' : 'No'}
                />
              </View>

              {/* Timestamps */}
              <View className="mb-6">
                <DetailRow
                  label="Created at"
                  value={formatDate(selectedTx.createdAt)}
                />
                <DetailRow
                  label="Updated at"
                  value={formatDate(selectedTx.updatedAt)}
                />
                <DetailRow
                  label="Tx time"
                  value={tx.time ? formatDate(tx.time) : '-'}
                />
              </View>

              {/* Footer Buttons: Close + Refund */}
              <View className="flex-row justify-between mt-4">
                {/* Close */}
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="flex-1 bg-gray-700 rounded-xl py-3 items-center mr-3"
                >
                  <Text className="text-white font-semibold">Close</Text>
                </TouchableOpacity>

                {/* Refund (only if completed) */}
                {selectedTx.status === 'completed' && (
                  <TouchableOpacity
                    onPress={() => {
                      setRefundPaymentId(selectedTx._id);
                      setRefundQrVisible(true);
                    }}
                    className="flex-1 bg-[#9707B5] rounded-xl py-3 items-center ml-3"
                  >
                    <Text className="text-white font-semibold">Refund</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // OFFLINE page
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

  // LOADING screen
  if (loading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#9707B5" />
        <Text className="text-white mt-3">Loading history...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="px-5 pt-5 flex-row bg-gray-900 items-center space-x-3">
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

      {/* Filters */}
      <View className="flex-row px-4 py-3 bg-gray-900 items-center space-x-3">
        <TouchableOpacity
          onPress={() => setStatusDropdownOpen(true)}
          className="flex-1 rounded-xl border border-gray-700 px-3 py-2"
        >
          <Text className="text-gray-200 text-sm">
            Status:{' '}
            <Text className="text-white font-semibold">{selectedStatus}</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTypeDropdownOpen(true)}
          className="flex-1 rounded-xl border border-gray-700 px-3 py-2"
        >
          <Text className="text-gray-200 text-sm">
            Type:{' '}
            <Text className="text-white font-semibold">{selectedType}</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown modals */}
      {StatusDropdown()}
      {TypeDropdown()}

      {/* List */}
      <View style={{ flex: 1, paddingBottom: 0 }}>
        {!listLoading ? (
          <FlatList
            data={transactions}
            keyExtractor={item => item._id}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTransactions(1);
            }}
            ListEmptyComponent={
              <View className="items-center justify-center mt-16">
                <Text className="text-gray-400">No transactions found</Text>
              </View>
            }
            ListFooterComponent={total > 0 ? <PaginationBar /> : null}
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

      {/* Refund QR Modal */}
      {RefundQRModal()}

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
