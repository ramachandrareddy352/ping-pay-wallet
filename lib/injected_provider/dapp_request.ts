import {DappRequest, RpcMethod} from './index'; // adjust path if needed

export class DappRequestUtils {
  /**
   * Check if an object is a valid DappRequest
   */
  public static isDappRequest(obj: any): obj is DappRequest {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.id === 'string' &&
      typeof obj.method === 'string'
    );
  }
}
