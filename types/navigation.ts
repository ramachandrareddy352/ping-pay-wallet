export type RootStackParamList = {
  Onboarding: undefined;
  RecoveryPhrase: { mnemonic: string };
  ConfirmRecovery: { mnemonic: string };
  Passcode: undefined;
  ConfirmPasscode: { password: string };
  ImportPhrase: undefined;

  Home: undefined;
  Unlock: undefined;
  BiometricUnlock: undefined;
  Explore: undefined;
  TransactionHistory: {
    accountId: string;
  };
  TokenData: {
    mintAddress: string;
  };
  NFTDataScreen: {
    mintAddress: string;
  };
  ScanQr: { mintAddress: string; isNFT: boolean };

  Accounts: undefined;
  ImportAccount: undefined;
  EditAccount: { accountId: string };
  AccountName: {
    accountId: string;
    currentName: string;
  };

  MerchantPayment: {
    merchantAddress: string;
    merchantDetails: any;
  };
  Rewards: undefined;

  SendRecipient: {
    mintAddress: string;
    isNFT: boolean;
  };
  SendInputAmount: {
    recipient: string;
    mintAddress: string;
    label?: string;
    reference?: string;
    message?: string;
    memo?: string;
  };
  Swap: undefined;

  ConfirmSend: {
    fromAddress: string;
    toAddress: string;
    amount: number;
    tokenSymbol: string;
    tokenMint: string;
    network: 'devnet' | 'mainnet-beta';
    label?: string;
    reference?: string;
    message?: string;
    memo?: string;
  };
  ConfirmNFTSend: {
    toAddress: string;
    NFTMint: string;
  };
  ConfirmSwap: {
    sellToken: string;
    buyToken: string;
    sellAmount: string;
    buyAmount: string;
    isSellNativeSol: boolean;
    isBuyNativeSol: boolean;
    inputType: 'sell' | 'buy';
    slippage: number;
    network: 'devnet' | 'mainnet-beta';
  };
  ConfirmTransaction: {
    transactionBase64: string;
    requestUrl: string;
  };

  PrivateKey: { accountId: string };
  PrivateKeyShow: { accountId: string };
  QRCode: { accountId: string };
  Receive: undefined;

  TermsAndConditions: undefined;
  Settings: undefined;
  NetworkPreference: undefined;
  RequireAuth: undefined;
  SelectLanguage: undefined;
  SelectCurrency: undefined;
  ResetPassword: undefined;
  ShowMnemonic: undefined;
  AddressBook: undefined;
  ResetApp: undefined;
};
