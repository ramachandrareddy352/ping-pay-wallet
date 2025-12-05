export enum RpcMethod {
  Connect = 'connect',
  Disconnect = 'disconnect',
  SignAndSendTransaction = 'signAndSendTransaction',
  SignTransaction = 'signTransaction',
  SignAllTransactions = 'signAllTransactions',
  SignMessage = 'signMessage',
  SignIn = 'signIn',
}
export interface DappRequest {
  id: string;
  method: RpcMethod;
  params: any;
  transactionType?: 'legacy' | 'versioned';
  transactionTypes?: ('legacy' | 'versioned')[];
}
