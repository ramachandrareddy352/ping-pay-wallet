import * as bip39 from 'bip39';
import * as web3 from '@solana/web3.js';
import { WalletAccount, removeAccount } from './storage';
import { derivePath } from 'ed25519-hd-key';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import EncryptedStorage from 'react-native-encrypted-storage';
import { loadWallet } from './storage';

const MNEMONIC_KEY = 'WALLET_MNEMONIC';
const IMPORTED_ACCOUNTS_KEY = 'WALLET_IMPORTED_ACCOUNTS';
const DERIVED_ACCOUNTS_KEY = 'WALLET_DERIVED_ACCOUNTS';

/** ---------------- Mnemonic ---------------- */
export async function generateMnemonic(): Promise<string> {
  return bip39.generateMnemonic(128); // 12 words
}

export async function saveMnemonic(mnemonic: string) {
  await EncryptedStorage.setItem(MNEMONIC_KEY, mnemonic);
}

export async function loadMnemonic(): Promise<string | null> {
  return await EncryptedStorage.getItem(MNEMONIC_KEY);
}

export async function clearMnemonic() {
  await EncryptedStorage.removeItem(MNEMONIC_KEY);
}

/** ---------------- Derived Accounts ---------------- */
export function deriveKeypair(mnemonic: string, index: number = 0) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const path = `m/44'/501'/${index}'/0'`; // Solana derivation path
  const { key } = derivePath(path, seed.toString('hex'));

  const seedBytes = Uint8Array.from(key);
  const kp = nacl.sign.keyPair.fromSeed(seedBytes);

  return {
    publicKey: bs58.encode(kp.publicKey),
    secretKey: bs58.encode(kp.secretKey),
    index,
  };
}

/** Save derived accounts (only public keys + index) */
export async function saveDerivedAccounts(accounts: any[]) {
  await EncryptedStorage.setItem(
    DERIVED_ACCOUNTS_KEY,
    JSON.stringify(accounts),
  );
}

/** Load derived accounts */
export async function loadDerivedAccounts(): Promise<any[]> {
  const data = await EncryptedStorage.getItem(DERIVED_ACCOUNTS_KEY);
  return data ? JSON.parse(data) : [];
}

/** Add next derived account */
export async function addDerivedAccount(mnemonic: string, index: number) {
  const acc = deriveKeypair(mnemonic, index);

  // Save minimal info (do not store secretKey for safety)
  const minimal = {
    publicKey: acc.publicKey,
    index: acc.index,
    secretKey: acc.secretKey,
  };

  const existing = await loadDerivedAccounts();
  const updated = [...existing, minimal];
  await saveDerivedAccounts(updated);

  return minimal;
}

/** ---------------- Imported Accounts ---------------- */
export async function saveImportedAccounts(accounts: any[]) {
  await EncryptedStorage.setItem(
    IMPORTED_ACCOUNTS_KEY,
    JSON.stringify(accounts),
  );
}

export async function loadImportedAccounts(): Promise<any[]> {
  const data = await EncryptedStorage.getItem(IMPORTED_ACCOUNTS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function clearImportedAccounts() {
  await EncryptedStorage.removeItem(IMPORTED_ACCOUNTS_KEY);
}

/** Check if account already exists in wallet (imported OR derived OR unified storage) */
export async function isDuplicateAccount(pubkey: string): Promise<boolean> {
  // Check unified wallet storage
  const wallet = await loadWallet();
  if (
    wallet &&
    wallet.accounts.some((a: WalletAccount) => a.publicKey === pubkey)
  ) {
    return true;
  }

  // Check separate imported storage (legacy/backup)
  const imported = await loadImportedAccounts();
  if (imported.some((a: any) => a.publicKey === pubkey)) {
    return true;
  }

  // Check separate derived storage (legacy/backup)
  // const derived = await loadDerivedAccounts();
  // if (derived.some((a: any) => a.publicKey === pubkey)) {
  //   return true;
  // }

  return false;
}

/** Check if public key is derivable from current mnemonic (existing or future indices) */
// export async function isDerivableFromMnemonic(
//   pubkey: string,
// ): Promise<boolean> {
//   const mnemonic = await loadMnemonic();
//   if (!mnemonic) {
//     return false;
//   }

//   // Check existing derived accounts
//   const derived = await loadDerivedAccounts();
//   if (derived.some((a: any) => a.publicKey === pubkey)) {
//     return true;
//   }

//   // Brute-force check next potential indices (e.g., up to 20 more)
//   const maxCheck = 20;
//   for (let i = derived.length; i < maxCheck; i++) {
//     const {publicKey: derivedPub} = deriveKeypair(mnemonic, i);
//     if (derivedPub === pubkey) {
//       return true;
//     }
//   }

//   return false;
// }

/** ---------------- Clear All ---------------- */
export async function clearAllWalletData() {
  await clearMnemonic();
  await clearImportedAccounts();
  await EncryptedStorage.removeItem(DERIVED_ACCOUNTS_KEY);
}

/** Import account from bs58 secret (32 or 64 bytes) */
export function importAccount(secretKey: string, name: string): WalletAccount {
  const trimmed = secretKey.trim();

  let decoded: Uint8Array;
  try {
    decoded = bs58.decode(trimmed);
  } catch (e) {
    throw new Error('Invalid base58 encoding');
  }

  let keypair: web3.Keypair;
  if (decoded.length === 64) {
    // user passed the full secretKey (64 bytes)
    keypair = web3.Keypair.fromSecretKey(decoded);
  } else if (decoded.length === 32) {
    // user passed only the 32-byte seed; derive full keypair using nacl
    const kp = nacl.sign.keyPair.fromSeed(decoded);
    keypair = web3.Keypair.fromSecretKey(kp.secretKey);
  } else {
    throw new Error('Invalid key length. Expected 32 or 64 bytes (decoded).');
  }

  const account: WalletAccount = {
    // keep id identical to publicKey for consistency with createAccount
    id: keypair.publicKey.toBase58(),
    name,
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey),
    type: 'imported',
  };

  return account;
}

/** Connection + helpers */
export function getConnection(network: 'devnet' | 'mainnet-beta') {
  return new web3.Connection(web3.clusterApiUrl(network), 'confirmed');
}

/** Delete a specific account */
export async function deleteAccount(accountId: string) {
  const wallet = await loadWallet();
  if (!wallet) return;

  // Remove from WalletData
  await removeAccount(accountId);

  // Update derived accounts if applicable
  const derived = await loadDerivedAccounts();
  const updatedDerived = derived.filter((a: any) => a.publicKey !== accountId);
  await saveDerivedAccounts(updatedDerived);

  // Update imported accounts if applicable
  const imported = await loadImportedAccounts();
  const updatedImported = imported.filter(
    (a: any) => a.publicKey !== accountId,
  );
  await saveImportedAccounts(updatedImported);
}
