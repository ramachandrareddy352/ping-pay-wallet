import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ActivityIndicator,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageSourcePropType } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { LAMPORTS_PER_SOL, Connection, PublicKey } from '@solana/web3.js';
import NetInfo from '@react-native-community/netinfo';
import Offline from '../../assets/icons/offline.svg';
import SwapIcon from '../../assets/icons/swap-icon.svg';
import CloseIcon from '../../assets/icons/close-icon.svg';
import SearchIcon from '../../assets/icons/search-icon.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import DropDownArrow from '../../assets/icons/drop-down-arrow.svg';
import FeeOption from '../../assets/icons/fee-option.svg';
import UsernameFrame from '../../assets/images/user-logo.png';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { loadWallet, WalletData, WalletAccount } from '../../utils/storage';
import {
  getRpcUrl,
  SOL_MINT_ADDRESS,
  NATIVE_SOL_MINT,
  fetchSolBalance,
  fetchSolPrice,
} from '../../utils/common';
import Toast from 'react-native-toast-message';
import { formatBalance } from '../../utils/helper';
import {
  Raydium,
  JupTokenType,
  PoolFetchType,
} from '@raydium-io/raydium-sdk-v2';
import BottomNavBar from '../../components/BottomNavBar';

export type Token = {
  name: string;
  symbol: string;
  mint: string;
  image?: string | ImageSourcePropType | null;
  price?: number;
  balance?: number;
  decimals?: number;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Swap'>;

const POPULAR_TOKENS_JSON: Token[] = [
  {
    name: 'Native SOL',
    symbol: 'SOL',
    mint: NATIVE_SOL_MINT,
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: 9,
    price: 0,
  },
  {
    name: 'Wrapped SOL',
    symbol: 'WSOL',
    mint: SOL_MINT_ADDRESS,
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: 9,
    price: 0,
  },
  {
    name: 'MECCA',
    symbol: 'MECCA',
    mint: 'mecySk7eSawDNfAXvW3CquhLyxyKaXExFXgUUbEZE1T',
    image:
      'https://img-v1.raydium.io/icon/mecySk7eSawDNfAXvW3CquhLyxyKaXExFXgUUbEZE1T.png',
    decimals: 6,
    price: 0,
  },
  {
    name: 'USD Coin',
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    decimals: 6,
    price: 0,
  },
  {
    name: 'Tether USD',
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    image:
      'https://img-v1.raydium.io/icon/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB.png',
    decimals: 6,
    price: 0,
  },
];

const solImageSource: ImageSourcePropType = require('../../assets/images/sol-img.png');

export default function SwapTokenScreen({ navigation }: Props) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(
    null,
  );
  const [solPrice, setSolPrice] = useState(0);
  // Raydium token list & pagination
  const [allTokens, setAllTokens] = useState<Token[]>([]);
  const [displayedTokens, setDisplayedTokens] = useState<Token[]>([]);
  const [tokensPage, setTokensPage] = useState(1);
  const PAGE_SIZE = 25;
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [loadingMoreTokens, setLoadingMoreTokens] = useState(false);
  // selected tokens / amounts
  const [sellToken, setSellToken] = useState<Token | null>(
    POPULAR_TOKENS_JSON[0],
  );
  const [buyToken, setBuyToken] = useState<Token | null>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  // input type tracking
  const [inputType, setInputType] = useState<'sell' | 'buy'>('sell');
  // modals & queries
  const [sellModal, setSellModal] = useState(false);
  const [buyModal, setBuyModal] = useState(false);
  const [querySell, setQuerySell] = useState('');
  const [queryBuy, setQueryBuy] = useState('');
  const [network, setNetwork] = useState<'devnet' | 'mainnet-beta'>('devnet');
  // input focus
  const [sellInputFocused, setSellInputFocused] = useState(false);
  const [buyInputFocused, setBuyInputFocused] = useState(false);
  // Raydium instance cache
  const raydiumRef = useRef<any | null>(null);
  const connectionRef = useRef<Connection | null>(null);
  // Pool metadata for currently selected pair
  const [bestPool, setBestPool] = useState<any | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  // balances map mint->balance
  const [ownedBalances, setOwnedBalances] = useState<Record<string, number>>(
    {},
  );
  // Fee modal state
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [selectedFee, setSelectedFee] = useState<number | null>(0.5);
  const [customFee, setCustomFee] = useState<string>('');
  const [tempSelectedFee, setTempSelectedFee] = useState<number | null>(null);
  const [tempCustomFee, setTempCustomFee] = useState<string>('');
  const [tempWarning, setTempWarning] = useState('');
  // Swap flag
  const [isSwapping, setIsSwapping] = useState(false);
  // debounce for swap button
  const lastSwapTsRef = useRef<number>(0);
  const ignoreSwapTriggerRef = useRef(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // track pool fetch requests to avoid race conditions
  const poolRequestIdRef = useRef<number>(0);

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

  // --------------------- Helpers ---------------------
  const isNativeSol = (mint: string) => mint === NATIVE_SOL_MINT;

  // --------------------- Wallet / account helpers ---------------------
  const handleCurrentAccount = async () => {
    setSellAmount('');
    setBuyAmount('');
    setOwnedBalances({});
    const w = await loadWallet();
    if (!w) {
      setWallet(null);
      setCurrentAccount(null);
      return;
    }
    setWallet(w);
    setNetwork(w.network);
    if (!w?.currentAccountId) {
      setCurrentAccount(null);
      return;
    }
    const acc = w.accounts.find(
      a => a.id === w.currentAccountId,
    ) as WalletAccount;
    if (acc) setCurrentAccount(acc);
  };

  useFocusEffect(
    useCallback(() => {
      handleCurrentAccount();
    }, []),
  );

  // --------------------- Raydium token list ---------------------
  const getRaydium = async (owner?: PublicKey) => {
    if (!isConnected) {
      return null;
    }

    if (!wallet?.currentAccountId && !owner) return null;
    if (raydiumRef.current && !owner) return raydiumRef.current;
    try {
      connectionRef.current = new Connection(getRpcUrl(network), 'confirmed');
      const raydiumOwner =
        owner ||
        (wallet?.currentAccountId
          ? new PublicKey(wallet.currentAccountId)
          : undefined);
      const raydium = await Raydium.load({
        connection: connectionRef.current,
        owner: raydiumOwner,
        cluster: network === 'devnet' ? 'devnet' : 'mainnet',
        apiRequestInterval: 10_000,
        jupTokenType: JupTokenType.ALL,
      });
      if (!owner) raydiumRef.current = raydium;
      return raydium;
    } catch (e) {
      console.log('Raydium load failed', e);
      return null;
    }
  };

  const loadRaydiumTokenList = async () => {
    if (!isConnected) {
      return;
    }

    setLoadingTokens(true);
    try {
      const raydium = await getRaydium();
      if (!raydium) return;
      const raw = raydium.apiData?.tokenList || raydium.apiData || null;
      const mintList = raw?.data?.mintList || raw?.mintList || [];
      const mapped: Token[] = (mintList || []).map((t: any) => ({
        name: t.name || t.tokenName || t.symbol || 'Unknown',
        symbol: t.symbol || 'UKN',
        mint: t.address || t.mint || '',
        image: t.logoURI || (t.extensions && t.extensions.logoURI) || null,
        price: 0,
        decimals: t.decimals ?? 0,
      }));
      const popularMints = POPULAR_TOKENS_JSON.map(p => p.mint);
      const rest = mapped.filter(m => !popularMints.includes(m.mint));
      setAllTokens(rest as Token[]);
      setDisplayedTokens(rest.slice(0, PAGE_SIZE));
      setTokensPage(1);
    } catch (e) {
      console.log('loadRaydiumTokenList error', e);
    } finally {
      setLoadingTokens(false);
    }
  };

  useEffect(() => {
    if (!buyToken && wallet) {
      const defaultBuy =
        network === 'devnet' ? POPULAR_TOKENS_JSON[1] : POPULAR_TOKENS_JSON[2];
      setBuyToken(defaultBuy);
    }
  }, [buyToken, wallet, network]);

  useEffect(() => {
    if (wallet) {
      const defaultBuy =
        network === 'devnet' ? POPULAR_TOKENS_JSON[1] : POPULAR_TOKENS_JSON[2];
      setBuyToken(defaultBuy);
      loadRaydiumTokenList();
    }
  }, [wallet, network]);

  const loadMoreTokens = () => {
    if (!isConnected) {
      return;
    }

    if (loadingMoreTokens) return;
    if (displayedTokens.length >= allTokens.length) return;
    setLoadingMoreTokens(true);
    setTimeout(() => {
      const nextPage = tokensPage + 1;
      const start = (nextPage - 1) * PAGE_SIZE;
      const nextSlice = allTokens.slice(start, start + PAGE_SIZE);
      setDisplayedTokens(prev => [...prev, ...nextSlice]);
      setTokensPage(nextPage);
      setLoadingMoreTokens(false);
    }, 300);
  };

  // --------------------- Pool fetching (fixed with request-id) ---------------------
  const fetchBestPoolForPair = async (mintA: string, mintB: string) => {
    if (!isConnected) {
      return null;
    }

    if (!mintA || !mintB) {
      // ensure we only clear if no mints are provided
      setBestPool(null);
      return null;
    }

    // Normalize native SOL to SOL mint for Raydium queries
    const effectiveMintA = mintA === NATIVE_SOL_MINT ? SOL_MINT_ADDRESS : mintA;
    const effectiveMintB = mintB === NATIVE_SOL_MINT ? SOL_MINT_ADDRESS : mintB;

    // increment request id
    const reqId = ++poolRequestIdRef.current;

    try {
      setPoolLoading(true);
      const raydium = await getRaydium();
      if (!raydium) {
        // if raydium not ready, don't overwrite existing bestPool here; return null
        return null;
      }

      const res = await raydium.api.fetchPoolByMints({
        mint1: effectiveMintA,
        mint2: effectiveMintB,
        type: PoolFetchType.All,
        sort: 'liquidity',
        order: 'desc',
        page: 1,
        pageSize: 1,
      });

      // only allow this response to update state if it's the latest request
      if (reqId !== poolRequestIdRef.current) {
        // stale response
        return null;
      }

      if (res && res.count && res.data && res.data.length > 0) {
        setBestPool(res.data[0]);
        return res.data[0];
      } else {
        setBestPool(null);
        return null;
      }
    } catch (e) {
      console.log('fetchBestPoolForPair error', e);
      // only clear if still latest request
      if (reqId === poolRequestIdRef.current) setBestPool(null);
      return null;
    } finally {
      // only clear loading if this is latest request
      if (reqId === poolRequestIdRef.current) setPoolLoading(false);
    }
  };

  const triggerPostSwapFetch = useCallback(
    async (newSellMint: string, newBuyMint: string) => {
      if (!isConnected) {
        return;
      }

      const effectiveSellMint =
        newSellMint === NATIVE_SOL_MINT ? SOL_MINT_ADDRESS : newSellMint;
      const effectiveBuyMint =
        newBuyMint === NATIVE_SOL_MINT ? SOL_MINT_ADDRESS : newBuyMint;
      await fetchBestPoolForPair(effectiveSellMint, effectiveBuyMint);
      await fetchBalanceForMint(newSellMint);
      await fetchBalanceForMint(newBuyMint);
    },
    [network, currentAccount],
  );

  useEffect(() => {
    if (isSwapping || ignoreSwapTriggerRef.current) return;
    const a = sellToken?.mint || '';
    const b = buyToken?.mint || '';
    if (!a || !b) return;

    (async () => {
      if (!isConnected) {
        return;
      }

      const effectiveA = isNativeSol(a) ? SOL_MINT_ADDRESS : a;
      const effectiveB = isNativeSol(b) ? SOL_MINT_ADDRESS : b;

      await fetchBestPoolForPair(effectiveA, effectiveB);
      await fetchBalanceForMint(a);
      await fetchBalanceForMint(b);
    })();
  }, [sellToken?.mint, buyToken?.mint, network, currentAccount]);

  // --------------------- Price & amount calculations ---------------------
  const normalizeFee = (pool: any) => {
    const raw = pool?.feeRate ?? pool?.fee ?? 0;
    if (raw === undefined || raw === null) return 0;
    if (raw > 0 && raw < 1) return raw;
    if (raw >= 1 && raw <= 100) return raw / 100;
    return 0;
  };

  const readReserves = (pool: any) => {
    try {
      const mintA = pool?.mintA?.address || pool?.mintA?.address;
      const mintB = pool?.mintB?.address || pool?.mintB?.address;

      const ra =
        pool?.mintAmountA ??
        pool?.reserveA?.amount ??
        pool?.reserveA ??
        pool?.tokenA?.amount ??
        null;
      const rb =
        pool?.mintAmountB ??
        pool?.reserveB?.amount ??
        pool?.reserveB ??
        pool?.tokenB?.amount ??
        null;

      const reserveA = ra !== null && ra !== undefined ? Number(ra) : null;
      const reserveB = rb !== null && rb !== undefined ? Number(rb) : null;
      if (
        reserveA !== null &&
        !Number.isNaN(reserveA) &&
        reserveB !== null &&
        !Number.isNaN(reserveB)
      ) {
        return { reserveA, reserveB, mintA, mintB };
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  const computePriceFromPool = (pool: any, forSellMint: string) => {
    const effectiveSellMint =
      forSellMint === NATIVE_SOL_MINT ? SOL_MINT_ADDRESS : forSellMint;
    if (!pool) return null;
    try {
      if (pool.price !== undefined && pool.price !== null) {
        const mintA = pool.mintA?.address;
        const mintB = pool.mintB?.address;
        if (effectiveSellMint === mintA) return pool.price;
        if (effectiveSellMint === mintB) return 1 / pool.price;
        return null;
      }
      const r = readReserves(pool);
      if (r) {
        const { reserveA, reserveB, mintA, mintB } = r;
        if (!reserveA || !reserveB) return null;
        if (effectiveSellMint === mintA) return reserveB / reserveA;
        if (effectiveSellMint === mintB) return reserveA / reserveB;
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  const constantProductOut = (
    amountIn: number,
    reserveIn: number,
    reserveOut: number,
    feeDecimal = 0,
  ) => {
    if (amountIn <= 0) return 0;
    const amountInWithFee = amountIn * (1 - feeDecimal);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    return numerator / denominator;
  };

  const constantProductIn = (
    amountOut: number,
    reserveIn: number,
    reserveOut: number,
    feeDecimal = 0,
  ) => {
    if (amountOut <= 0) return 0;
    if (amountOut >= reserveOut) return NaN;
    const numerator = reserveIn * amountOut;
    const denominator = reserveOut - amountOut;
    const rawIn = numerator / denominator;
    const beforeFee = rawIn / (1 - feeDecimal);
    return beforeFee;
  };

  const fmt = (n: number, maxDecimals = 4) => {
    if (!isFinite(n) || Number.isNaN(n)) return '';
    const fixed = n.toFixed(Math.min(maxDecimals, 4));
    return parseFloat(fixed).toString();
  };

  const formatNumberWithCommas = (val: any) => {
    const num = Number(val);
    if (!isFinite(num)) return String(val);
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const sanitizeDecimalInput = (value: string, maxDecimals = 25) => {
    if (value === undefined || value === null) return '';
    if (value === '') return '';
    let cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.indexOf('.') === -1) {
      return cleaned;
    }
    const firstDot = cleaned.indexOf('.');
    const before = cleaned.slice(0, firstDot);
    let after = cleaned.slice(firstDot + 1).replace(/\./g, '');
    after = after.slice(0, maxDecimals);
    const endsWithDot = value.endsWith('.');
    if (endsWithDot && after.length === 0) {
      return (before === '' ? '0' : before) + '.';
    }
    const intPart = before === '' ? '0' : before;
    if (after.length > 0) return intPart + '.' + after;
    return intPart;
  };

  const computeOutputFromSell = (
    pool: any,
    sellAmountNum: number,
    sellMint: string,
  ) => {
    if (!isConnected) {
      return;
    }

    const effectiveSellMint =
      sellMint === NATIVE_SOL_MINT ? SOL_MINT_ADDRESS : sellMint;
    if (!pool) return null;
    const fee = normalizeFee(pool);
    const poolType = pool.type || 'Standard';
    const r = readReserves(pool);
    const mintA = pool?.mintA?.address;
    const mintB = pool?.mintB?.address;
    if (r && mintA && mintB && poolType === 'Standard') {
      let reserveIn = 0;
      let reserveOut = 0;
      if (effectiveSellMint === mintA) {
        reserveIn = r.reserveA;
        reserveOut = r.reserveB;
      } else if (effectiveSellMint === mintB) {
        reserveIn = r.reserveB;
        reserveOut = r.reserveA;
      } else {
        const price = computePriceFromPool(pool, sellMint);
        if (price === null) return null;
        return sellAmountNum * price;
      }
      const out = constantProductOut(sellAmountNum, reserveIn, reserveOut, fee);
      if (!isFinite(out) || out <= 0.000000001) {
        const price = computePriceFromPool(pool, sellMint);
        if (price === null) return null;
        return sellAmountNum * price;
      }
      return out;
    } else {
      const price = computePriceFromPool(pool, sellMint);
      if (price === null) return null;
      return sellAmountNum * price * (1 - fee);
    }
  };

  const computeSellFromBuy = (
    pool: any,
    desiredBuyNum: number,
    sellMint: string,
  ) => {
    if (!isConnected) {
      return;
    }

    const effectiveSellMint =
      sellMint === NATIVE_SOL_MINT ? SOL_MINT_ADDRESS : sellMint;
    if (!pool) return null;
    const fee = normalizeFee(pool);
    const poolType = pool.type || 'Standard';
    const r = readReserves(pool);
    const mintA = pool?.mintA?.address;
    const mintB = pool?.mintB?.address;
    if (r && mintA && mintB && poolType === 'Standard') {
      let reserveIn = 0;
      let reserveOut = 0;
      if (effectiveSellMint === mintA) {
        reserveIn = r.reserveA;
        reserveOut = r.reserveB;
      } else if (effectiveSellMint === mintB) {
        reserveIn = r.reserveB;
        reserveOut = r.reserveA;
      } else {
        const price = computePriceFromPool(pool, sellMint);
        if (price === null) return null;
        return desiredBuyNum / price;
      }
      if (desiredBuyNum >= reserveOut) return NaN;
      const amountIn = constantProductIn(
        desiredBuyNum,
        reserveIn,
        reserveOut,
        fee,
      );
      if (!isFinite(amountIn) || amountIn <= 0) {
        const price = computePriceFromPool(pool, sellMint);
        if (price === null || price === 0) return null;
        return desiredBuyNum / price;
      }
      return amountIn;
    } else {
      const price = computePriceFromPool(pool, sellMint);
      if (price === null || price === 0) return null;
      return desiredBuyNum / (price * (1 - fee));
    }
  };

  const onSellAmountChange = (val: string) => {
    setInputType('sell');
    const sanitized = sanitizeDecimalInput(val, 25);
    setSellAmount(sanitized);
    const numeric = parseFloat(sanitized);
    if (!bestPool || isNaN(numeric)) {
      setBuyAmount('');
      return;
    }
    const sellMint = sellToken?.mint || '';
    const out = computeOutputFromSell(bestPool, numeric, sellMint);
    setBuyAmount(out ? fmt(out, 4) : '');
  };

  const onBuyAmountChange = (val: string) => {
    setInputType('buy');
    const sanitized = sanitizeDecimalInput(val, 25);
    setBuyAmount(sanitized);
    const numeric = parseFloat(sanitized);
    if (!bestPool || isNaN(numeric)) {
      setSellAmount('');
      return;
    }
    const sellMint = sellToken?.mint || '';
    const inAmt = computeSellFromBuy(bestPool, numeric, sellMint);
    setSellAmount(inAmt ? fmt(inAmt, 4) : '');
  };

  // --------------------- Balance fetching (FIXED) ---------------------
  const fetchBalanceForMint = async (mint: string) => {
    if (!isConnected) {
      return;
    }

    if (!currentAccount || !currentAccount.publicKey) return;
    try {
      let balance = 0;

      // NATIVE SOL
      if (isNativeSol(mint)) {
        balance = await fetchSolBalance(
          currentAccount.publicKey,
          getRpcUrl(network),
        );
      }
      // OTHER SPL TOKENS
      else {
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
              limit: 100,
              options: { showFungible: true, showZeroBalance: false },
            },
          }),
        });
        if (!response.ok) return;
        const { result } = await response.json();

        const item = (result.items || []).find(
          (it: any) =>
            it.id === mint || (it.token_info && it.token_info.mint === mint),
        );
        if (item) {
          const decimals = item.token_info?.decimals ?? 0;
          balance = item.token_info?.balance
            ? item.token_info.balance / Math.pow(10, decimals)
            : 0;
        }
      }

      setOwnedBalances(prev => ({ ...prev, [mint]: balance }));
    } catch (e) {
      console.log('fetchBalanceForMint error', e);
    }
  };

  // Fetch SOL price and update tokens
  useEffect(() => {
    (async () => {
      if (!isConnected) {
        return;
      }

      const price = await fetchSolPrice(network);
      setSolPrice(price);
      setAllTokens(prev =>
        prev.map(t =>
          t.mint === NATIVE_SOL_MINT || t.mint === SOL_MINT_ADDRESS
            ? { ...t, price }
            : t,
        ),
      );
      setDisplayedTokens(prev =>
        prev.map(t =>
          t.mint === NATIVE_SOL_MINT || t.mint === SOL_MINT_ADDRESS
            ? { ...t, price }
            : t,
        ),
      );
    })();
  }, [network]);

  // --------------------- Token selection handlers ---------------------
  const handleSellTokenSelect = (token: Token) => {
    setSellToken(token);
    setSellModal(false);
    setQuerySell('');
  };
  const handleBuyTokenSelect = (token: Token) => {
    setBuyToken(token);
    setBuyModal(false);
    setQueryBuy('');
  };

  const swapTokens = async () => {
    if (!isConnected) {
      return;
    }

    const now = Date.now();
    if (now - lastSwapTsRef.current < 1000) return;
    lastSwapTsRef.current = now;

    if (
      isSwapping ||
      !sellToken ||
      !buyToken ||
      sellToken.mint === buyToken.mint
    )
      return;

    setIsSwapping(true);
    ignoreSwapTriggerRef.current = true;

    const SAFETY_CLEAR_MS = 2000; // Increased slightly for safety
    const safetyTimer = setTimeout(() => {
      ignoreSwapTriggerRef.current = false;
    }, SAFETY_CLEAR_MS);

    try {
      const prevSell = sellToken;
      const prevBuy = buyToken;

      const newSellMint = prevBuy.mint;
      const newBuyMint = prevSell.mint;

      setSellToken(prevBuy);
      setBuyToken(prevSell);
      setSellAmount('');
      setBuyAmount('');
      setInputType('sell');

      await triggerPostSwapFetch(newSellMint, newBuyMint);
    } catch (e) {
      console.log('swapTokens error', e);
    } finally {
      clearTimeout(safetyTimer);
      ignoreSwapTriggerRef.current = false;
      setIsSwapping(false);
    }
  };

  const disableSwap =
    !sellToken ||
    !buyToken ||
    sellToken.mint === buyToken.mint ||
    !sellAmount ||
    parseFloat(sellAmount) >
      (sellToken.balance || ownedBalances[sellToken.mint || ''] || 0);

  const tryAddTokenFromMintAndPool = async (
    searchMint: string,
    isSellSide = true,
  ) => {
    try {
      new PublicKey(searchMint);
    } catch (e) {
      return null;
    }
    const otherMint = isSellSide ? buyToken?.mint || '' : sellToken?.mint || '';
    if (!otherMint) return null;
    try {
      const raydium = await getRaydium();
      if (!raydium) return null;
      const effectiveOtherMint =
        otherMint === NATIVE_SOL_MINT ? SOL_MINT_ADDRESS : otherMint;
      const res = await raydium.api.fetchPoolByMints({
        mint1: effectiveOtherMint,
        mint2: searchMint,
        type: PoolFetchType.All,
        sort: 'liquidity',
        order: 'desc',
        page: 1,
        pageSize: 1,
      });
      if (res && res.data && res.data.length > 0) {
        const pool = res.data[0];
        const meta =
          pool.mintA.address === searchMint ? pool.mintA : pool.mintB;
        const tokenObj: Token = {
          name: meta.name || meta.symbol || 'Unknown',
          symbol: meta.symbol || 'UKN',
          mint: meta.address,
          image: meta.logoURI || null,
          decimals: meta.decimals,
          price: pool.price ?? 0,
        };
        setAllTokens(prev => {
          if (prev.find(p => p.mint === tokenObj.mint)) return prev;
          return [tokenObj, ...prev];
        });
        setDisplayedTokens(prev => {
          if (prev.find(p => p.mint === tokenObj.mint)) return prev;
          return [tokenObj, ...prev];
        });
        return tokenObj;
      }
    } catch (e) {
      console.log('tryAddTokenFromMintAndPool error', e);
    }
    return null;
  };

  // --------------------- Fee modal logic ---------------------
  const handlePresetSelect = (value: number) => {
    setTempSelectedFee(value);
    setTempCustomFee('');
  };

  useEffect(() => {
    const feeVal = parseFloat(tempCustomFee);
    if (isNaN(feeVal)) {
      setTempWarning('');
      return;
    }
    if (feeVal > 50) {
      setTempWarning(
        'Warning: Your transaction may be frontrun and result in an unfavorable trade',
      );
    } else if (feeVal > 10) {
      setTempWarning(
        'Warning: Your transaction may be frontrun and result in an unfavorable trade',
      );
    } else {
      setTempWarning('');
    }
  }, [tempCustomFee]);

  const isSaveDisabled = useMemo(() => {
    const customVal = parseFloat(tempCustomFee);
    return (
      (tempSelectedFee === null && (isNaN(customVal) || customVal <= 0)) ||
      (tempSelectedFee === null && customVal > 100)
    );
  }, [tempSelectedFee, tempCustomFee]);

  const handleSaveFee = () => {
    if (tempSelectedFee !== null) {
      setSelectedFee(tempSelectedFee);
      setCustomFee('');
    } else {
      setSelectedFee(null);
      setCustomFee(tempCustomFee);
    }
    setFeeModalVisible(false);
  };

  // --------------------- UI helpers ---------------------
  const safeImageSource = (img?: string | ImageSourcePropType | null) => {
    if (!img) return solImageSource;
    if (typeof img === 'string') {
      if (img.trim() === '') return solImageSource;
      return { uri: img };
    }
    return img as ImageSourcePropType;
  };

  const filteredPopularTokens = useMemo(() => {
    return network === 'devnet'
      ? POPULAR_TOKENS_JSON.filter(
          t => t.mint === NATIVE_SOL_MINT || t.mint === SOL_MINT_ADDRESS,
        )
      : POPULAR_TOKENS_JSON;
  }, [network]);

  const renderTokenSelector = (
    label: string,
    token: Token | null,
    value: string,
    onChange: (v: string) => void,
    onPress: () => void,
    isFocused: boolean,
    onFocus: () => void,
    onBlur: () => void,
  ) => (
    <View className="my-3">
      <View className="flex-row justify-between mb-1 px-2">
        <Text className="text-gray-400 text-xs font-medium">{label}</Text>
        {token && (
          <Text className="text-gray-400 text-xs font-medium">
            Balance:{' '}
            {formatBalance(token.balance ?? ownedBalances[token.mint] ?? 0)}{' '}
            {token.symbol}
          </Text>
        )}
      </View>
      <View
        className={`flex-row items-center justify-between bg-[#18181f]/50 rounded-2xl px-3 py-2 ${
          isFocused ? 'border-2 border-[#9707B5]/70' : ''
        }`}
      >
        <TouchableOpacity
          onPress={onPress}
          disabled={isSwapping}
          className="flex-row items-center bg-[#1f1f29] px-3 py-3 rounded-2xl"
        >
          {token ? (
            <>
              <Image
                source={safeImageSource(token.image)}
                className="w-6 h-6 rounded-full mr-2"
              />
              <Text className="text-white text-lg font-extrabold mr-1">
                {token.symbol}
              </Text>
            </>
          ) : (
            <Text className="text-gray-400 text-lg">Select Token</Text>
          )}
          <DropDownArrow width={30} height={30} />
        </TouchableOpacity>
        <View className="gap-0">
          <TextInput
            placeholder="0"
            placeholderTextColor="#fff"
            keyboardType="numeric"
            value={value}
            onChangeText={onChange}
            onFocus={onFocus}
            onBlur={onBlur}
            className="flex-1 text-right text-white text-lg"
          />
        </View>
      </View>
    </View>
  );

  const onTokenListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 20;
    if (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom
    ) {
      loadMoreTokens();
    }
  };

  const handleCopyAddress = () => {
    if (currentAccount?.publicKey) {
      Clipboard.setString(currentAccount.publicKey);
      Toast.show({
        type: 'success',
        text1: 'Address copied to clipboard',
      });
    }
  };

  const getSlippage = useMemo(() => {
    return selectedFee ?? (customFee ? parseFloat(customFee) : 0.5);
  }, [selectedFee, customFee]);

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

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="w-full flex-row items-center justify-between px-4 pt-4 pb-2 relative">
        <TouchableOpacity
          onPress={() => navigation.navigate('Accounts')}
          className="flex-row items-center gap-2"
        >
          <View className="w-10 h-10 rounded-full relative items-center justify-center overflow-hidden">
            {currentAccount?.imageUri ? (
              <Image
                source={{ uri: currentAccount.imageUri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Image
                source={UsernameFrame}
                className="w-full h-full absolute"
                resizeMode="contain"
              />
            )}
          </View>

          <View>
            <Text className="text-base font-medium text-white">
              {currentAccount?.name}
            </Text>
            <TouchableOpacity
              onPress={handleCopyAddress}
              className="flex-row items-center gap-1"
            >
              <Text className="text-medium text-gray-400">
                {currentAccount?.publicKey
                  ? `${currentAccount.publicKey.slice(
                      0,
                      6,
                    )} **** ${currentAccount.publicKey.slice(-6)}`
                  : 'No Account'}
              </Text>
              <CopyIcon width={14} height={14} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setTempSelectedFee(selectedFee);
            setTempCustomFee(customFee);
            setFeeModalVisible(true);
          }}
          className="w-auto h-auto px-2 py-1 items-center bg-[#9707B5] rounded-full flex-row justify-end gap-1"
        >
          <FeeOption width={16} height={16} fill="#D1D5DB" />
          <Text className="text-white">
            {selectedFee !== null
              ? `${selectedFee}%`
              : `${customFee ? customFee + '%' : 'Custom'}`}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="px-5 pt-5"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {renderTokenSelector(
            'SELL',
            sellToken,
            sellAmount,
            onSellAmountChange,
            () => setSellModal(true),
            sellInputFocused,
            () => setSellInputFocused(true),
            () => setSellInputFocused(false),
          )}
          <TouchableOpacity
            onPress={swapTokens}
            disabled={isSwapping}
            className={`self-center p-3 rounded-full my-2 ${
              isSwapping ? 'bg-gray-700' : 'bg-[#18181f]'
            }`}
          >
            <SwapIcon width={20} height={20} />
          </TouchableOpacity>
          {renderTokenSelector(
            'BUY',
            buyToken,
            buyAmount,
            onBuyAmountChange,
            () => setBuyModal(true),
            buyInputFocused,
            () => setBuyInputFocused(true),
            () => setBuyInputFocused(false),
          )}

          {bestPool ? (
            <Text className="text-gray-400 text-center text-sm font-normal">
              {sellToken?.mint && buyToken?.mint
                ? (() => {
                    const price = computePriceFromPool(
                      bestPool,
                      sellToken?.mint,
                    );
                    if (price === null) return 'Price: N/A';

                    let otherSymbol = buyToken?.symbol;
                    return `1 ${sellToken.symbol} ≈ ${parseFloat(
                      price.toFixed(6),
                    )} ${otherSymbol}`;
                  })()
                : 'Price: N/A'}
            </Text>
          ) : (
            <Text className="text-gray-400 text-center text-sm font-normal">
              Price: —
            </Text>
          )}

          <View className="my-2 p-3 rounded-lg bg-[#0f0f14]">
            {poolLoading ? (
              <Text className="text-gray-400">Checking pool...</Text>
            ) : bestPool ? (
              <View>
                <Text className="text-yellow-300 font-medium text-base mb-3">
                  Best pool
                </Text>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-300 text-sm">Address</Text>
                  <View className="flex-row items-center">
                    <Text className="text-white text-sm font-semibold mr-2">
                      {bestPool.id
                        ? `${bestPool.id.slice(0, 4)} **** ${bestPool.id.slice(
                            -4,
                          )}`
                        : 'N/A'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (bestPool?.id) {
                          Clipboard.setString(bestPool.id);
                          Toast.show({
                            type: 'success',
                            text1: 'Pool ID copied to Clipboard',
                          });
                        } else {
                          Toast.show({
                            type: 'info',
                            text1: 'No Pool ID to copy',
                          });
                        }
                      }}
                      className="p-1"
                      accessibilityLabel="Copy pool id"
                    >
                      <CopyIcon width={16} height={16} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-300 text-sm">Fees</Text>
                  <Text className="text-gray-300 text-xs font-semibold">
                    {typeof bestPool.feeRate === 'number'
                      ? `${(bestPool.feeRate * 100).toFixed(2)}%`
                      : bestPool.fee ?? 'N/A'}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-300 text-sm">Total liquidity</Text>
                  <Text className="text-gray-300 text-xs font-semibold">
                    {bestPool.tvl
                      ? `$${formatNumberWithCommas(bestPool.tvl)}`
                      : 'N/A'}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-300 text-sm">Pool price</Text>
                  <Text className="text-gray-300 text-xs font-semibold">
                    {bestPool.price !== undefined && bestPool.price !== null
                      ? bestPool.price.toFixed(4)
                      : 'N/A'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-gray-400">No pool found for this pair</Text>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (!currentAccount) {
                Toast.show({
                  type: 'error',
                  text1: 'No account selected',
                });
                return;
              }
              const effectiveSellMint =
                sellToken!.mint === NATIVE_SOL_MINT
                  ? SOL_MINT_ADDRESS
                  : sellToken!.mint;
              const effectiveBuyMint =
                buyToken!.mint === NATIVE_SOL_MINT
                  ? SOL_MINT_ADDRESS
                  : buyToken!.mint;
              navigation.navigate('ConfirmSwap', {
                sellToken: effectiveSellMint,
                buyToken: effectiveBuyMint,
                sellAmount,
                isSellNativeSol: sellToken?.mint === NATIVE_SOL_MINT,
                isBuyNativeSol: buyToken?.mint === NATIVE_SOL_MINT,
                buyAmount,
                inputType,
                slippage: getSlippage,
                network,
              });
            }}
            disabled={
              disableSwap ||
              !bestPool ||
              Number(sellAmount) === 0 ||
              Number(buyAmount) === 0
            }
            className={`items-center justify-center py-4 rounded-2xl mt-2 mb-6 ${
              disableSwap ||
              !bestPool ||
              Number(sellAmount) === 0 ||
              Number(buyAmount) === 0
                ? 'bg-[#18181f]'
                : 'bg-[#9707B5]'
            }`}
          >
            <Text
              className={`font-semibold ${
                disableSwap ||
                !bestPool ||
                Number(sellAmount) === 0 ||
                Number(buyAmount) === 0
                  ? 'text-gray-500'
                  : 'text-white'
              }`}
            >
              Swap
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Token Selection Modals */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sellModal}
        onRequestClose={() => setSellModal(false)}
      >
        <View className="flex-1 justify-end">
          <View className="bg-gray-900 h-[80%] rounded-t-2xl mx-3 px-3 pt-6">
            <View className="flex-row items-center justify-between mb-4">
              <View />
              <Text className="text-base text-center text-white font-semibold">
                Select token to SELL
              </Text>
              <TouchableOpacity
                onPress={() => setSellModal(false)}
                className="mr-3"
              >
                <CloseIcon width={16} height={16} />
              </TouchableOpacity>
            </View>
            <View className="relative items-center justify-center mb-4">
              <TextInput
                placeholder="Search token or mint address"
                placeholderTextColor="#6B7280"
                className="border border-gray-800 pr-12 rounded-[40px] h-10 w-full pl-4 text-white font-normal text-xs"
                value={querySell}
                onChangeText={async text => {
                  setQuerySell(text);
                  if (text && text.length >= 32) {
                    await tryAddTokenFromMintAndPool(text, true);
                  }
                }}
                keyboardType="default"
              />
              <SearchIcon
                width={12}
                height={12}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  marginTop: -6,
                }}
              />
            </View>

            <Text className="text-gray-300 text-xs mb-2 ml-1">Popular</Text>
            <View className="flex-row flex-wrap justify-start gap-2 mb-4 w-full">
              {filteredPopularTokens.map((token, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.8}
                  onPress={() => handleSellTokenSelect(token)}
                  className={`flex-row items-center bg-slate-800 rounded-lg px-1 py-1 mb-2 ${
                    sellToken?.mint === token.mint
                      ? 'border border-white'
                      : 'border border-transparent'
                  }`}
                >
                  <Image
                    source={safeImageSource(token.image)}
                    className="w-8 h-8 rounded-full mr-1"
                    resizeMode="cover"
                  />
                  <Text
                    className="text-white text-sm font-medium"
                    numberOfLines={1}
                  >
                    {token.symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-gray-300 text-xs mb-2 ml-1">Token List</Text>
            <ScrollView
              className="w-full"
              onScroll={onTokenListScroll}
              scrollEventThrottle={400}
            >
              <View className="w-full gap-2 mb-4">
                {displayedTokens
                  .filter(t =>
                    querySell
                      ? t.name
                          .toLowerCase()
                          .includes(querySell.toLowerCase()) ||
                        t.symbol
                          .toLowerCase()
                          .includes(querySell.toLowerCase()) ||
                        t.mint.toLowerCase().includes(querySell.toLowerCase())
                      : true,
                  )
                  .map((token, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.8}
                      className={`flex-row items-center gap-3 pb-3 bg-slate-800 rounded-lg ${
                        sellToken?.mint === token.mint
                          ? 'border border-white'
                          : ''
                      }`}
                      onPress={() => handleSellTokenSelect(token)}
                    >
                      <Image
                        source={safeImageSource(token.image)}
                        className="w-10 h-10 rounded-full"
                      />
                      <View className="flex-1">
                        <Text className="text-white text-sm font-medium">
                          {token.symbol}
                        </Text>
                        <Text className="text-gray-300 text-xs font-normal">
                          {token.name}
                        </Text>
                      </View>
                      <View className="mr-3 items-end">
                        <View className="flex-row items-center gap-1">
                          <Text className="text-gray-300 text-xs font-normal">
                            {token.mint === NATIVE_SOL_MINT
                              ? 'Native SOL'
                              : `${token.mint.slice(
                                  0,
                                  4,
                                )} **** ${token.mint.slice(-4)}`}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              Clipboard.setString(token.mint);
                              Toast.show({
                                type: 'success',
                                text1: 'Mint address copied',
                              });
                            }}
                          >
                            <CopyIcon width={14} height={14} />
                          </TouchableOpacity>
                        </View>
                        <Text className="text-gray-400 text-xs">
                          Decimals: {token.decimals ?? 'N/A'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                {loadingMoreTokens && (
                  <View className="items-center py-3">
                    <ActivityIndicator size="small" color="#9707B5" />
                    <Text className="text-center text-gray-400 mt-2">
                      Loading more...
                    </Text>
                  </View>
                )}
                {displayedTokens.length === 0 && !loadingTokens && (
                  <Text className="text-gray-400 text-center mt-4">
                    No tokens found
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Buy Modal (same as Sell, only diff: handleBuyTokenSelect) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={buyModal}
        onRequestClose={() => setBuyModal(false)}
      >
        <View className="flex-1 justify-end">
          <View className="bg-gray-900 h-[80%] rounded-t-2xl mx-3 px-3 pt-6">
            <View className="flex-row items-center justify-between mb-4">
              <View />
              <Text className="text-base text-center text-white font-semibold">
                Select token to BUY
              </Text>
              <TouchableOpacity
                onPress={() => setBuyModal(false)}
                className="mr-3"
              >
                <CloseIcon width={16} height={16} />
              </TouchableOpacity>
            </View>

            <View className="relative items-center justify-center mb-4">
              <TextInput
                placeholder="Search token or mint address"
                placeholderTextColor="#6B7280"
                className="border border-gray-800 pr-12 rounded-[40px] h-10 w-full pl-4 text-white font-normal text-xs"
                value={queryBuy}
                onChangeText={async text => {
                  setQueryBuy(text);
                  if (text && text.length >= 32) {
                    await tryAddTokenFromMintAndPool(text, false);
                  }
                }}
                keyboardType="default"
              />
              <SearchIcon
                width={12}
                height={12}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  marginTop: -6,
                }}
              />
            </View>

            <Text className="text-gray-300 text-xs mb-2">Popular</Text>
            <View className="flex-row flex-wrap justify-start gap-2 mb-4 w-full">
              {filteredPopularTokens.map((token, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.8}
                  onPress={() => handleBuyTokenSelect(token)}
                  className={`flex-row items-center bg-slate-800 rounded-lg px-1 py-1 mb-2 ${
                    buyToken?.mint === token.mint
                      ? 'border border-white'
                      : 'border border-transparent'
                  }`}
                >
                  <Image
                    source={safeImageSource(token.image)}
                    className="w-8 h-8 rounded-full mr-1"
                    resizeMode="cover"
                  />
                  <Text
                    className="text-white text-sm font-medium"
                    numberOfLines={1}
                  >
                    {token.symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-gray-300 text-xs mb-2">Token List</Text>
            <ScrollView
              className="w-full"
              onScroll={onTokenListScroll}
              scrollEventThrottle={400}
            >
              <View className="w-full gap-2 mb-4">
                {displayedTokens
                  .filter(t =>
                    queryBuy
                      ? t.name.toLowerCase().includes(queryBuy.toLowerCase()) ||
                        t.symbol
                          .toLowerCase()
                          .includes(queryBuy.toLowerCase()) ||
                        t.mint.toLowerCase().includes(queryBuy.toLowerCase())
                      : true,
                  )
                  .map((token, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.8}
                      className={`flex-row items-center gap-3 pb-3 bg-slate-800 rounded-lg ${
                        buyToken?.mint === token.mint
                          ? 'border border-white'
                          : ''
                      }`}
                      onPress={() => handleBuyTokenSelect(token)}
                    >
                      <Image
                        source={safeImageSource(token.image)}
                        className="w-10 h-10 rounded-full"
                      />
                      <View className="flex-1">
                        <Text className="text-white text-sm font-medium">
                          {token.symbol}
                        </Text>
                        <Text className="text-gray-300 text-xs font-normal">
                          {token.name}
                        </Text>
                      </View>
                      <View className="mr-3 items-end">
                        <View className="flex-row items-center gap-1">
                          <Text className="text-gray-300 text-xs font-normal">
                            {token.mint === NATIVE_SOL_MINT
                              ? 'Native SOL'
                              : `${token.mint.slice(
                                  0,
                                  4,
                                )} **** ${token.mint.slice(-4)}`}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              Clipboard.setString(token.mint);
                              Toast.show({
                                type: 'success',
                                text1: 'Mint address copied',
                              });
                            }}
                          >
                            <CopyIcon width={14} height={14} />
                          </TouchableOpacity>
                        </View>
                        <Text className="text-gray-400 text-xs">
                          Decimals: {token.decimals ?? 'N/A'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                {loadingMoreTokens && (
                  <Text className="text-center text-gray-400 mt-2">
                    Loading more...
                  </Text>
                )}
                {displayedTokens.length === 0 && !loadingTokens && (
                  <Text className="text-gray-400 text-center mt-4">
                    No tokens found
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Fee Modal */}
      <Modal visible={feeModalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/70 justify-center items-center px-5">
          <View className="bg-[#101018] w-full rounded-2xl p-5">
            <View className="flex-row justify-between mb-8">
              <Text className="text-white text-lg font-semibold text-center -mt-2">
                Swap slippage tolerance
              </Text>
              <TouchableOpacity onPress={() => setFeeModalVisible(false)}>
                <CloseIcon width={14} height={14} />
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-center mb-4">
              {[0.1, 0.5, 1].map((val, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handlePresetSelect(val)}
                  className={`px-4 py-2 rounded-full mx-1 bg-[#1f1f29] ${
                    tempSelectedFee === val
                      ? 'border-2 border-[#9707B5]'
                      : 'bg-[#1f1f29] text-gray-300'
                  }`}
                >
                  <Text className="text-white">{val}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row items-center justify-center mb-3">
              <Text className="text-white mr-4">Custom : </Text>
              <TextInput
                value={tempCustomFee}
                onChangeText={val => {
                  setTempSelectedFee(null);
                  setTempCustomFee(val);
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#6B7280"
                className={`w-20 text-center text-white border rounded-lg px-2 py-1 ${
                  parseFloat(tempCustomFee) > 50
                    ? 'border-red-500'
                    : 'border-gray-600'
                }`}
              />
              <Text className="text-white ml-1">%</Text>
            </View>
            {tempWarning ? (
              <View className="bg-yellow-900/40 p-2 rounded-lg mb-3">
                <Text className="text-yellow-400 text-xs text-center">
                  {tempWarning}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              disabled={isSaveDisabled}
              onPress={handleSaveFee}
              className={`py-3 rounded-xl mt-2 ${
                isSaveDisabled ? 'bg-gray-700' : 'bg-[#9707B5]'
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  isSaveDisabled ? 'text-gray-400' : 'text-white'
                }`}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNavBar active="Swap" />
    </SafeAreaView>
  );
}
