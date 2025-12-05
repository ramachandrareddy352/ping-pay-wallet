import { PublicKey } from '@solana/web3.js';

export const formatBalance = (num: number): string => {
  if (num >= 1e12) {
    return (num / 1e12).toFixed(2) + 'T';
  }
  if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + 'K';
  }
  return num.toFixed(4);
};

// Function to validate amount input
export const isValidAmount = (value: string): boolean => {
  if (value === '') {
    return false;
  }
  const regex = /^\d*\.?\d*$/;
  return (
    regex.test(value) && !isNaN(parseFloat(value)) && parseFloat(value) > 0
  );
};

// Validate Solana address (44 characters for base58 public key)
export const validateSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/** Helpers for formatting BigInt token amounts into strings without precision loss */
export function formatBigIntAmount(amount: bigint, decimals: number) {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const s = abs.toString();
  if (decimals <= 0) {
    return (neg ? '-' : '') + s;
  }
  if (s.length <= decimals) {
    const zeros = '0'.repeat(decimals - s.length);
    const frac = zeros + s;
    // trim trailing zeros in fractional part (but keep single 0 if all zeros)
    const trimmedFrac = frac.replace(/0+$/, '');
    return (neg ? '-' : '') + '0.' + (trimmedFrac === '' ? '0' : trimmedFrac);
  } else {
    const intPart = s.slice(0, s.length - decimals);
    let fracPart = s.slice(s.length - decimals);
    fracPart = fracPart.replace(/0+$/, '');
    return (neg ? '-' : '') + intPart + (fracPart ? '.' + fracPart : '');
  }
}

/** Safely get array of pubkey strings out of message.accountKeys (handles parsed vs raw) */
export function normalizeAccountKeys(accountKeys: any[]): string[] {
  if (!Array.isArray(accountKeys)) return [];
  return accountKeys.map(k => {
    if (!k) return '';
    if (typeof k === 'string') return k;
    // parsed form: {pubkey: 'xxx', signer: boolean, writable: boolean}
    if (k.pubkey) return k.pubkey;
    // fallback stringify
    return String(k);
  });
}
