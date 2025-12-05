import 'react-native-get-random-values';
import * as bip39 from 'bip39';
import {HDKey} from 'micro-ed25519-hdkey';
import nacl from 'tweetnacl';
import {
  Connection,
  Keypair,
  Transaction,
  PublicKey,
  SendTransactionError,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  SolanaSignAndSendTransaction,
  SolanaSignInInput,
  SolanaSignInOutput,
  SolanaSignMessage,
  SolanaSignTransaction,
} from '@solana/wallet-standard-features';

export interface SignInEncodedOuput {
  account: {
    address: string;
    publicKey: string;
    chains: readonly string[];
    features: readonly string[];
  };
  signedMessage: string;
  signature: string;
}
export class Wallet {
  private keypair!: Keypair;
  walletLoaded = false;
  private rpcUrl: string;
  public connection!: Connection;
  public balance = 0;

  constructor(keypair: Keypair, rpcUrl: string) {
    this.rpcUrl = rpcUrl;
    this.keypair = keypair;
    this.loadWallet();
  }

  /** Generate a 12-word seed phrase */
  static generateSeedPhrase() {
    return bip39.generateMnemonic().split(' ');
  }

  /** Derive Solana Keypair from mnemonic */
  static getKeypairFromMnemonic(mnemonic: string, index = 0): Keypair {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hd = HDKey.fromMasterSeed(seed.toString('hex'));
    const path = `m/44'/501'/${index}'/0'`;
    const child = hd.derive(path);
    return Keypair.fromSeed(new Uint8Array(child.privateKey));
  }

  /** ✅ Check if a mnemonic is valid */
  static isValidMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic.trim());
  }

  private loadWallet() {
    // this.keypair = Wallet.getKeypairFromMnemonic(this.mnemonic);
    this.connection = new Connection(this.rpcUrl, 'confirmed');
    this.walletLoaded = true;
  }

  private async requireLoaded() {
    await this.waitTillInit();
    if (!this.walletLoaded) {
      throw new Error('Wallet not initialized');
    }
  }

  async waitTillInit(timeout = 10000): Promise<void> {
    const start = Date.now();

    while (!this.walletLoaded) {
      // wait a bit before rechecking
      await new Promise(resolve => setTimeout(resolve, 100));

      if (Date.now() - start > timeout) {
        throw new Error('Wallet initialization timeout');
      }
    }
  }

  /** Public address of the wallet */
  get publicKey(): PublicKey {
    this.requireLoaded();
    return this.keypair.publicKey;
  }

  /** ✍️ Sign a transaction (legacy or versioned) without sending */
  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<T> {
    await this.requireLoaded();

    if (transaction instanceof Transaction) {
      // 🔹 Legacy Transaction
      if (!transaction.recentBlockhash) {
        const {blockhash} = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }

      if (!transaction.feePayer) {
        transaction.feePayer = this.keypair.publicKey;
      }

      transaction.partialSign(this.keypair);
    } else {
      // 🔹 Versioned Transaction (v0)
      transaction.sign([this.keypair]);
    }

    return transaction;
  }

  /** 🚀 Send a signed transaction (supports legacy and versioned) */
  async sendSignedTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<string> {
    await this.requireLoaded();

    let rawTx: Buffer | Uint8Array<ArrayBufferLike>;
    if (transaction instanceof Transaction) {
      rawTx = transaction.serialize();
    } else {
      // VersionedTransaction
      rawTx = transaction.serialize();
    }

    const signature = await this.connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await this.connection.confirmTransaction(signature, 'confirmed');
    return signature;
  }

  /** ✅ Sign and send (generic for both transaction types) */
  async signAndSendTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<string> {
    const signedTx = await this.signTransaction(transaction);
    try {
      const signature = await this.sendSignedTransaction(signedTx);
      return signature;
    } catch (error) {
      if (error instanceof SendTransactionError) {
        const logs = await error.getLogs(this.connection);
        console.log('Transaction failed logs:', logs);
      }
      throw error;
    }
  }
  /** Sign arbitrary message (not a transaction) */
  async signMessage(message: string): Promise<Uint8Array> {
    await this.requireLoaded();
    console.log('origincal sign called');
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    return signature;
  }

  prepareSignInMessage(input: SolanaSignInInput): string {
    const lines: string[] = [];

    // Domain and address are required in message header
    let domain = input.domain;
    let address = input.address;
    if (!input.domain) {
      domain = 'test.com';
    }
    if (!input.address) {
      address = this.keypair.publicKey.toString();
    }

    lines.push(`${domain} wants you to sign in with your Solana account:`);
    lines.push(address!);

    // Optional statement
    if (input.statement) {
      lines.push('');
      lines.push(input.statement);
    }

    // Optional fields
    if (input.uri) lines.push(`URI: ${input.uri}`);
    if (input.version) lines.push(`Version: ${input.version}`);
    if (input.chainId) lines.push(`Chain ID: ${input.chainId}`);
    if (input.nonce) lines.push(`Nonce: ${input.nonce}`);
    if (input.issuedAt) lines.push(`Issued At: ${input.issuedAt}`);
    if (input.expirationTime)
      lines.push(`Expiration Time: ${input.expirationTime}`);
    if (input.notBefore) lines.push(`Not Before: ${input.notBefore}`);
    if (input.requestId) lines.push(`Request ID: ${input.requestId}`);

    // Resources
    if (input.resources && input.resources.length > 0) {
      lines.push('Resources:');
      input.resources.forEach(resource => {
        lines.push(`- ${resource}`);
      });
    }

    // Join all lines with newlines
    return lines.join('\n');
  }

  /** Sign arbitrary message (not a transaction) */
  //return encoded ouput
  async signIn(input: SolanaSignInInput): Promise<SignInEncodedOuput> {
    await this.requireLoaded();
    let message = this.prepareSignInMessage(input);

    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    const features = [
      SolanaSignAndSendTransaction,
      SolanaSignTransaction,
      SolanaSignMessage,
    ] as const;
    let result = {
      account: {
        address: this.keypair.publicKey.toString(),
        publicKey: this.keypair.publicKey.toBuffer().toString('base64'),
        chains: [
          'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
          'solana:mainnet',
          'solana:devnet',
        ] as const,
        features,
      },
      signedMessage: Buffer.from(message).toString('base64'),
      signature: Buffer.from(signature).toString('base64'),
    };
    return result;
  }

  /**
   * Sync and return latest balance
   */
  async syncBalance() {
    this.balance = (await this.connection.getBalance(this.publicKey)) / 10 ** 9;
    console.log(this.publicKey);
    return this.balance;
  }
}
