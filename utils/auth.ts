import * as Keychain from 'react-native-keychain';
import EncryptedStorage from 'react-native-encrypted-storage';

const PASSWORD_KEY = 'WALLET_PASSWORD';
const ATTEMPTS_KEY = 'FAILED_ATTEMPTS';
const LOCK_KEY = 'LOCK_UNTIL';

/* ----------------- Lock Management ----------------- */
export async function getAttempts() {
  const raw = await EncryptedStorage.getItem(ATTEMPTS_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

export async function setAttempts(val: number) {
  await EncryptedStorage.setItem(ATTEMPTS_KEY, val.toString());
}

export async function resetAttempts() {
  await EncryptedStorage.removeItem(ATTEMPTS_KEY);
}

export async function getLockUntil() {
  const raw = await EncryptedStorage.getItem(LOCK_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

export async function setLockUntil(timestamp: number) {
  await EncryptedStorage.setItem(LOCK_KEY, timestamp.toString());
}

export async function resetLockUntil() {
  await EncryptedStorage.removeItem(LOCK_KEY);
}

/* ----------------- Passcode management ----------------- */
export async function savePassword(password: string) {
  await Keychain.setGenericPassword(PASSWORD_KEY, password, {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  });
}

export async function loadPassword(): Promise<string | null> {
  const creds = await Keychain.getGenericPassword();
  if (creds && creds.username === PASSWORD_KEY) {
    return creds.password;
  }
  return null;
}

export async function verifyPassword(input: string): Promise<boolean> {
  const stored = await loadPassword();
  return stored === input;
}

/** ----------------- Delete stored password (reset credentials) ----------------- */
export async function deletePassword(): Promise<void> {
  try {
    await Keychain.resetGenericPassword();
  } catch (err) {
    console.log('Keychain reset failed', err);
  }
}
