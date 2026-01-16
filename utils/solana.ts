import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const RPC_MAINNET = 'https://rosemaria-weqok5-fast-mainnet.helius-rpc.com';
const RPC_DEVNET = 'https://kirstyn-7fsg6s-fast-devnet.helius-rpc.com';

export function getConnection(network: 'mainnet' | 'devnet') {
  return new Connection(network === 'mainnet' ? RPC_MAINNET : RPC_DEVNET);
}

export async function getSolBalance(
  pubkey: string,
  network: 'mainnet' | 'devnet',
) {
  const conn = getConnection(network);
  const balance = await conn.getBalance(new PublicKey(pubkey));
  return Math.floor(balance / LAMPORTS_PER_SOL);
}

export async function requestAirdrop(pubkey: string) {
  const conn = getConnection('devnet');
  return conn.requestAirdrop(new PublicKey(pubkey), 2 * LAMPORTS_PER_SOL);
}
