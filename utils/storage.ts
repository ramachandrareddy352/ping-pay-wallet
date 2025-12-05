import EncryptedStorage from 'react-native-encrypted-storage';
import * as Keychain from 'react-native-keychain';
export type AccountType = 'derived' | 'imported';

export interface WalletAccount {
  id: string;
  name: string;
  publicKey: string;
  secretKey: string;
  imageUri?: string;
  type: AccountType;
  index?: number; // For derived accounts
}

export interface WalletData {
  accounts: WalletAccount[];
  currentAccountId: string | null;
  network: 'devnet' | 'mainnet-beta';
  lastRevealedIndex?: number; // Optional, defaults to 0 if undefined
  nextDerivedIndex?: number; // Next index for new derived accounts; increments on creation
  bookmarks?: string[]; // Array of mintAddress strings for bookmarked tokens
}

export interface AddressEntry {
  name: string;
  address: string;
}

const WALLET_STORAGE_KEY = 'SOLANA_WALLET_DATA';
const LANGUAGE_STORAGE_KEY = 'SELECTED_LANGUAGE';
const CURRENCY_STORAGE_KEY = 'SELECTED_CURRENCY';
const AUTH_STORAGE_KEY = 'APP_AUTH_REQUIREMENT';
const LAST_UNLOCK_TIME_KEY = 'LAST_UNLOCK_TIME';
const LAST_ROUTE_KEY = 'LAST_ROUTE';
const ADDRESS_BOOK_KEY = 'ADDRESS_BOOK';
const ADDRESS_BOOK_SERVICE = 'ADDRESS_BOOK_SERVICE'; // <-- namespace for keychain

export async function saveWallet(data: WalletData) {
  await EncryptedStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(data));
}

export async function loadWallet(): Promise<WalletData | null> {
  const raw = await EncryptedStorage.getItem(WALLET_STORAGE_KEY);
  if (!raw) return null;
  const data = JSON.parse(raw);
  // Ensure defaults
  return {
    ...data,
    lastRevealedIndex: data.lastRevealedIndex ?? 0,
    nextDerivedIndex: data.nextDerivedIndex ?? 0,
    bookmarks: data.bookmarks ?? [], // Default to empty array if undefined
  };
}

export async function clearWallet() {
  await EncryptedStorage.removeItem(WALLET_STORAGE_KEY);
}

export async function removeAccount(accountId: string) {
  const wallet = await loadWallet();
  if (!wallet) return;
  const updatedAccounts = wallet.accounts.filter(a => a.id !== accountId);
  const updatedWallet: WalletData = {
    ...wallet,
    accounts: updatedAccounts,
    currentAccountId:
      wallet.currentAccountId === accountId ? null : wallet.currentAccountId,
  };
  await saveWallet(updatedWallet);
}

export async function saveLanguage(languageCode: string) {
  await EncryptedStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
}

export async function loadLanguage(): Promise<string | null> {
  const language = await EncryptedStorage.getItem(LANGUAGE_STORAGE_KEY);
  return language || null;
}

export async function clearLanguage() {
  await EncryptedStorage.removeItem(LANGUAGE_STORAGE_KEY);
}

export async function saveCurrency(currencyCode: string) {
  await EncryptedStorage.setItem(CURRENCY_STORAGE_KEY, currencyCode);
}

export async function loadCurrency(): Promise<string | null> {
  return await EncryptedStorage.getItem(CURRENCY_STORAGE_KEY);
}

export async function clearCurrency() {
  await EncryptedStorage.removeItem(CURRENCY_STORAGE_KEY);
}

export async function saveAuthRequirement(authValue: string) {
  await EncryptedStorage.setItem(AUTH_STORAGE_KEY, authValue);
}

export async function loadAuthRequirement(): Promise<string | null> {
  return await EncryptedStorage.getItem(AUTH_STORAGE_KEY);
}

export async function clearAuthRequirement() {
  await EncryptedStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function saveLastUnlockTime(timestamp: string) {
  await EncryptedStorage.setItem(LAST_UNLOCK_TIME_KEY, timestamp);
}

export async function loadLastUnlockTime(): Promise<string | null> {
  return await EncryptedStorage.getItem(LAST_UNLOCK_TIME_KEY);
}

export async function saveLastRoute(payload: string) {
  await EncryptedStorage.setItem(LAST_ROUTE_KEY, payload);
}

export async function loadLastRoute(): Promise<string | null> {
  return await EncryptedStorage.getItem(LAST_ROUTE_KEY);
}

export async function clearLastRoute() {
  await EncryptedStorage.removeItem(LAST_ROUTE_KEY);
}

// Save the entire address book (array) to Keychain under a named service
export async function saveAddressBook(
  addresses: AddressEntry[],
): Promise<void> {
  try {
    const payload = JSON.stringify(addresses || []);
    await Keychain.setGenericPassword(ADDRESS_BOOK_KEY, payload, {
      service: ADDRESS_BOOK_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (err) {
    console.error('saveAddressBook failed', err);
    throw err;
  }
}

// Load the address book; return empty array when none saved
export async function loadAddressBook(): Promise<AddressEntry[]> {
  try {
    const creds = await Keychain.getGenericPassword({
      service: ADDRESS_BOOK_SERVICE,
    });
    if (creds && creds.username === ADDRESS_BOOK_KEY && creds.password) {
      try {
        const parsed = JSON.parse(creds.password);
        if (Array.isArray(parsed)) return parsed as AddressEntry[];
      } catch (parseErr) {
        console.warn('Address book JSON parse failed', parseErr);
      }
    }
    return [];
  } catch (err) {
    console.error('loadAddressBook failed', err);
    return [];
  }
}

export async function clearAddressBook(): Promise<void> {
  try {
    // resetGenericPassword without service resets default credential only.
    // Keychain library supports resetGenericPassword({service})
    await Keychain.resetGenericPassword({ service: ADDRESS_BOOK_SERVICE });
  } catch (err) {
    console.log('Keychain reset failed', err);
    throw err;
  }
}

export async function addAddress(entry: AddressEntry): Promise<void> {
  try {
    const addresses = (await loadAddressBook()) || [];
    // avoid duplicates by name or address
    if (
      addresses.some(e => e.name === entry.name || e.address === entry.address)
    ) {
      // silently ignore duplicate or throw depending on desired behaviour
      throw new Error('Duplicate address or name');
    }
    addresses.push(entry);
    await saveAddressBook(addresses);
  } catch (err) {
    console.error('addAddress failed', err);
    throw err;
  }
}

export async function deleteAddress(address: string): Promise<void> {
  try {
    const addresses = (await loadAddressBook()) || [];
    const updated = addresses.filter(e => e.address !== address);
    await saveAddressBook(updated);
  } catch (err) {
    console.error('deleteAddress failed', err);
    throw err;
  }
}
