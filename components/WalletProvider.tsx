import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { loadWallet, WalletData, WalletAccount } from '../utils/storage';

export interface WalletContextData {
  wallet: Keypair | null;
  connection: Connection;
}

const WalletContext = createContext<WalletContextData>({
  wallet: null,
  connection: new Connection(
    'https://kirstyn-7fsg6s-fast-devnet.helius-rpc.com',
  ),
});

export const useWallet = () => useContext(WalletContext);

export interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [wallet, setWallet] = useState<Keypair | null>(null);
  const [connection, setConnection] = useState<Connection>(
    new Connection('https://kirstyn-7fsg6s-fast-devnet.helius-rpc.com'),
  );

  const initWallet = async () => {
    try {
      const data: WalletData | null = await loadWallet();
      if (!data || !data.currentAccountId) return;

      // Pick current account (derived OR imported)
      const current: WalletAccount | undefined = data.accounts.find(
        a => a.id === data.currentAccountId,
      );
      if (!current) return;

      // Build Keypair from secretKey (works for both imported & derived)
      const secretKeyBytes = bs58.decode(current.secretKey);
      const kp = Keypair.fromSecretKey(secretKeyBytes);
      setWallet(kp);

      // Set connection based on stored network
      const rpcUrl =
        data.network === 'mainnet-beta'
          ? 'https://rosemaria-weqok5-fast-mainnet.helius-rpc.com'
          : 'https://kirstyn-7fsg6s-fast-devnet.helius-rpc.com';
      setConnection(new Connection(rpcUrl, 'confirmed'));
    } catch (e) {
      console.log('Error initializing wallet:', e);
    }
  };

  useEffect(() => {
    initWallet();
    console.log('provider');
  }, []);

  const value: WalletContextData = {
    wallet,
    connection,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
