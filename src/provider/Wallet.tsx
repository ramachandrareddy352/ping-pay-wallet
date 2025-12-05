import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import { View, Text } from 'react-native';
import { SignInEncodedOuput, Wallet } from '../wallet';
import { useSignPopup } from './SignMessagePopup';
import { useDispatch, useSelector } from 'react-redux';
import { rpcUrl } from '../../lib/utils/constants';
import {
  setMessage,
  SignPopUpState,
  TransactionPopUpParams,
} from '../store/features/wallet_sign';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { loadWallet, WalletData } from '../../utils/storage';
import { setWalletData } from '../store/features/wallet';
import { RootState } from '../store/store';
import bs58 from 'bs58';
import {
  SolanaSignAndSendAllTransactionsMethod,
  SolanaSignInInput,
} from '@solana/wallet-standard-features';

interface WalletContextType {
  wallet: Wallet | null;
  getAddress: () => Promise<PublicKey | undefined>;
  walletLoaded: boolean;
  reload: () => Promise<void>;
  signMessage: (message: string) => Promise<Uint8Array | undefined>;
  signIn: (input: SolanaSignInInput) => Promise<SignInEncodedOuput | undefined>;
  syncBalance: () => Promise<number | undefined>;
  signAndSendTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T,
    params: TransactionPopUpParams,
  ) => Promise<string | undefined>;
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T,
    params: TransactionPopUpParams,
  ) => Promise<T | undefined>;
  waitForWalletLoaded: () => Promise<void>;
  getConnection: () => Connection | undefined;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const dispatch = useDispatch();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const walletRef = useRef<Wallet | null>(null);
  const { showMessage, showTransaction, setSuccess, setFailed, setReady } =
    useSignPopup(); // <-- use popup hooks
  const walletDetails = useSelector((state: RootState) => state.wallet.data);

  const queueRef = useRef<
    {
      task: () => Promise<any>;
      resolve: (v: any) => void;
      reject: (e: any) => void;
      message?: string;
      tx?: TransactionPopUpParams;
    }[]
  >([]);
  const processingRef = useRef(false);

  /** Process queued wallet actions one at a time */
  const processQueue = async () => {
    console.log('processing queue ');
    if (processingRef.current) {
      return;
    }
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const { task, resolve, reject, message, tx } = queueRef.current.shift()!;
      try {
        // Show confirmation popup
        if (message) {
          console.log('message here', message);
          await new Promise<void>((confirmResolve, confirmReject) => {
            if (tx) {
              showTransaction(tx, {
                onConfirm: confirmResolve,
                onCancel: () => confirmReject(new Error('User cancelled')),
              });
            } else {
              dispatch(
                setMessage({
                  message: {
                    label: 'Sign Transaction',
                    content: message,
                  },
                  status: SignPopUpState.PREVIEW,
                }),
              );
              showMessage('Sign Message', message, {
                onConfirm: confirmResolve,
                onCancel: () => confirmReject(new Error('User cancelled')),
              });
            }
          });
        }

        setLoading(true);
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        setLoading(false);
      }
    }

    processingRef.current = false;
  };

  /** Add a new async task to the queue */
  const enqueue = <T,>(
    task: () => Promise<T>,
    message?: string,
    tx?: TransactionPopUpParams,
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      queueRef.current.push({ task, resolve, reject, message, tx });
      console.log('enqueue called');
      processQueue();
    });
  };

  const initializeWalletInstance = async (
    details: WalletData = walletDetails,
  ) => {
    let selectedAccount = details.accounts.find(
      acc => acc.id === details.currentAccountId,
    );
    if (!selectedAccount) {
      return;
    }
    const secretKeyUint8 = bs58.decode(selectedAccount.secretKey); // decode base58 to Uint8Array
    const instance = new Wallet(Keypair.fromSecretKey(secretKeyUint8), rpcUrl);
    setWallet(instance);
  };

  useEffect(() => {
    if (walletDetails) {
      initializeWalletInstance(walletDetails);
    }
  }, [walletDetails]);
  /** Initialize wallet from SecureStore */
  const init = async () => {
    try {
      let w = await loadWallet();
      if (!w) {
        console.log('user wallet is not setup returning');
        return;
      }
      dispatch(setWalletData(w));
    } catch (err) {
      console.log('Wallet init error:', err);
    }
  };

  const getConnection = () => {
    let w = walletRef.current;
    if (!w) {
      throw new Error('Wallet not loaded');
    }
    return walletRef.current?.connection;
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);

  const walletLoaded = wallet?.walletLoaded ?? false;

  /** Sign message through queue + confirmation popup */
  const signMessage = async (
    message: string,
  ): Promise<Uint8Array | undefined> => {
    try {
      let w = walletRef.current;
      if (!w) {
        throw new Error('Wallet not loaded');
      }
      let result = await enqueue(() => {
        return w.signMessage(message);
      }, message);
      setReady();
      return result;
    } catch (error) {
      console.log('error at sign message wallet', error);
    }
  };

  /** Sign message through queue + confirmation popup */
  const signIn = async (
    input: SolanaSignInInput,
  ): Promise<SignInEncodedOuput | undefined> => {
    try {
      let w = walletRef.current;
      if (!w) {
        throw new Error('Wallet not loaded');
      }
      let result = await enqueue(() => {
        return w.signIn(input);
      }, 'Sign in into dapp');
      setReady();
      return result;
    } catch (error) {
      console.log('error at sign message wallet', error);
    }
  };

  /** Sign + send transaction through queue + confirmation popup */
  const signAndSendTransaction = async <
    T extends Transaction | VersionedTransaction,
  >(
    tx: T,
    params: TransactionPopUpParams,
  ): Promise<string | undefined> => {
    try {
      let w = walletRef.current;
      if (!w) {
        throw new Error('Wallet not loaded');
      }
      let result = await enqueue(
        () => {
          return w.signAndSendTransaction(tx);
        },
        'Transaction signing requested',
        params,
      );
      setSuccess();
      return result;
    } catch (error) {
      console.log('Error at sign and send wallet', error);
      setFailed();
    } finally {
      setTimeout(() => {
        setReady();
      }, 1000);
    }
  };

  const signTransaction = async <T extends Transaction | VersionedTransaction>(
    tx: T,
    params: TransactionPopUpParams,
  ): Promise<T | undefined> => {
    try {
      let w = walletRef.current;
      if (!w) {
        throw new Error('Wallet not loaded');
      }
      let result = await enqueue(
        () => {
          return w.signTransaction(tx);
        },
        'Transaction signing requested',
        params,
      );
      setSuccess();
      return result;
    } catch (error) {
      console.log('Error at sign and send wallet', error);
      setFailed();
    } finally {
      setTimeout(() => {
        setReady();
      }, 1000);
    }
  };

  /** Wait until the wallet is initialized and ready */
  const waitForWalletLoaded = async (): Promise<void> => {
    if (walletRef.current?.walletLoaded) {
      return;
    }

    const timeout = 10_000; // 10 seconds max
    const interval = 200;
    let elapsed = 0;

    while (!walletRef.current?.walletLoaded && elapsed < timeout) {
      await new Promise(res => setTimeout(res, interval));
      elapsed += interval;
    }

    if (!walletRef.current?.walletLoaded) {
      throw new Error('Wallet not initialized in time');
    }
  };

  const getAddress = async (): Promise<PublicKey | undefined> => {
    try {
      let w = walletRef.current;
      if (!w) {
        throw new Error('Wallet not loaded');
      }
      return walletRef.current?.publicKey;
    } catch (error) {
      console.log('get address error');
    }
  };

  const syncBalance = async () => {
    try {
      let w = walletRef.current;
      if (!w) {
        throw new Error('Wallet not loaded');
      }
      return await w.syncBalance();
    } catch (error) {
      console.log('sync error');
    }
  };

  return (
    <WalletContext.Provider
      value={{
        wallet: walletRef.current,
        getAddress: getAddress,
        walletLoaded,
        reload: init,
        signMessage,
        signIn,
        signAndSendTransaction,
        signTransaction,
        syncBalance,
        waitForWalletLoaded,
        getConnection,
      }}
    >
      {children}
      {loading && (
        <View className="absolute inset-0 justify-center items-center bg-black bg-opacity-40">
          <Text className="text-white text-lg">Processing...</Text>
        </View>
      )}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
