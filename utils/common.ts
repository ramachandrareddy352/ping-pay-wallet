export const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
export const NATIVE_SOL_MINT = 'native-sol';

export const getRpcUrl = (network: 'devnet' | 'mainnet-beta') =>
  network === 'mainnet-beta'
    ? 'https://rosemaria-weqok5-fast-mainnet.helius-rpc.com'
    : 'https://kirstyn-7fsg6s-fast-devnet.helius-rpc.com';

export const getSwapInfo = async () => {
  try {
    const response = await fetch(
      'https://api-platform.pingpay.info/public/open/swap-settings',
    );
    const data = await response.json();

    if (data?.success && data?.body) {
      return {
        feePercentage: Number(data.body.fee) || 0, // ensure number
        receiver: data.body.feeReceiver || '', // ensure string
      };
    }

    // fallback when API returns success = false or invalid data
    return {
      feePercentage: 0,
      receiver: '',
    };
  } catch (error) {
    console.log('getSwapInfo error:', error);
    return {
      feePercentage: 0,
      receiver: '',
    };
  }
};

export const normalizeUri = (uri: string | undefined): string => {
  if (!uri) {
    return '';
  }
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  if (uri.includes('/ipfs/')) {
    return uri.replace(/.*\/ipfs\//, 'https://ipfs.io/ipfs/');
  }
  return uri;
};

export const fetchSolPrice = async (
  network: 'devnet' | 'mainnet-beta',
): Promise<number> => {
  const rpcUrl = getRpcUrl(network);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'getSolPrice',
        method: 'getAsset',
        params: {
          id: SOL_MINT_ADDRESS,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Helius API error: ${data.error.message}`);
    }

    return data.result.token_info.price_info.price_per_token || 0;
  } catch (error) {
    console.log('Error fetching SOL price:', error);
    return 0;
  }
};

// Fetch SOL balance directly
export const fetchSolBalance = async (pubkey: string, rpcUrl: string) => {
  try {
    const options = {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [pubkey], // MUST be inside array
      }),
    };
    const response = await fetch(rpcUrl, options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Helius API error: ${data.error.message}`);
    }

    return data.result.value / Math.pow(10, 9);
  } catch (error) {
    console.log('Error fetching Balance:', error);
    return 0;
  }
};
