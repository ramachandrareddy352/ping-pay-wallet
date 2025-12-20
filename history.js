const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// RPC endpoint (Helius devnet)
const RPC_URL = 'https://kirstyn-7fsg6s-fast-devnet.helius-rpc.com';

// Known dApp/DEX program IDs for categorization (e.g., swaps, interactions)
const DAPP_PROGRAMS = new Set([
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter Aggregator
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', // Orca Whirlpool
  'So11111111111111111111111111111111111111112', // Wrapped SOL (for token checks)
  // Add more as needed: Serum, Pump.fun, etc.
]);

// Sample usage: node script.js <address> <page>
// e.g., node script.js YourSolanaAddressHere 1
async function fetchAndCategorizeTransactions(
  addressStr,
  page = 1,
  limit = 20,
) {
  const connection = new Connection(RPC_URL);
  const address = new PublicKey(addressStr);

  try {
    // Fetch transaction signatures with pagination
    let allSignatures = [];
    let before = undefined;
    let fetchedCount = 0;

    while (fetchedCount < page * limit) {
      const signatures = await connection.getSignaturesForAddress(address, {
        limit: Math.min(limit, page * limit - fetchedCount),
        before,
      });

      if (signatures.length === 0) break;

      allSignatures = allSignatures.concat(signatures);
      before = signatures[signatures.length - 1].signature; // For next page
      fetchedCount += signatures.length;

      // Stop if no more
      if (signatures.length < limit) break;
    }

    // Get the specific page's signatures (newest first, so slice from end for older pages)
    const startIdx = Math.max(0, allSignatures.length - page * limit);
    const endIdx = startIdx + limit;
    const pageSignatures = allSignatures.slice(startIdx, endIdx);

    console.log(
      `Fetched ${pageSignatures.length} transactions for page ${page}`,
    );

    const categorizedTxs = [];

    for (const sigInfo of pageSignatures) {
      const tx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        console.log(`No transaction data for ${sigInfo.signature}`);
        continue;
      }

      // Detailed logging for each transaction
      console.log(`\n--- Transaction Details for ${sigInfo.signature} ---`);
      console.log(
        `Block Time: ${new Date(sigInfo.blockTime * 1000).toISOString()}`,
      );
      console.log(`Slot: ${tx.slot}`);
      console.log(`Fee: ${(tx.meta?.fee || 0) / LAMPORTS_PER_SOL} SOL`);

      const categorization = categorizeTransaction(tx, address.toBase58());
      categorizedTxs.push({
        signature: sigInfo.signature,
        blockTime: sigInfo.blockTime,
        slot: tx.slot,
        ...categorization,
      });

      console.log(
        `Categorized as: ${categorization.type}${
          categorization.subtype ? ` (${categorization.subtype})` : ''
        }`,
      );
      console.log(`SOL Change: ${categorization.details.solChange} SOL`);
      if (
        categorization.details.tokens &&
        categorization.details.tokens.length > 0
      ) {
        console.log(
          `Token Changes: ${JSON.stringify(
            categorization.details.tokens,
            null,
            2,
          )}`,
        );
      }
      if (
        categorization.details.programs &&
        categorization.details.programs.length > 0
      ) {
        console.log(
          `Programs Involved: ${categorization.details.programs.join(', ')}`,
        );
      }
      console.log('--- End Transaction ---');
    }

    console.log('\nFinal Categorized Transactions Summary:');
    console.log(JSON.stringify(categorizedTxs, null, 2));
  } catch (error) {
    console.error('Error fetching transactions:', error);
  }
}

function categorizeTransaction(tx, ownerAddress) {
  const meta = tx.meta;
  if (!meta)
    return {
      type: 'unknown',
      details: { solChange: 0, tokens: [], programs: [] },
    };

  const accountKeys = tx.transaction.message.accountKeys;
  const accountIndex = accountKeys.findIndex(
    key => key.toBase58() === ownerAddress,
  );
  if (accountIndex === -1)
    return {
      type: 'unknown',
      details: { solChange: 0, tokens: [], programs: [] },
    };

  // SOL balance change
  const preSol = meta.preBalances[accountIndex] || 0;
  const postSol = meta.postBalances[accountIndex] || 0;
  const solChange = (postSol - preSol) / LAMPORTS_PER_SOL;
  const fee = (meta.fee || 0) / LAMPORTS_PER_SOL;
  const netSolChange = solChange + fee; // Adjust for fee (fee is deducted from signer)

  // Extract program IDs from instructions
  const instructions = tx.transaction.message.instructions;
  const programIds = instructions
    .map(ix => {
      if ('programIdIndex' in ix) {
        const progIdx = ix.programIdIndex;
        return accountKeys[progIdx]?.toBase58() || null;
      }
      return null;
    })
    .filter(Boolean);
  const uniquePrograms = [...new Set(programIds)];
  console.log(`Programs called: ${uniquePrograms.join(', ')}`);

  const hasDappProgram = uniquePrograms.some(pid => DAPP_PROGRAMS.has(pid));
  console.log(`Has dApp program: ${hasDappProgram}`);

  // Token balances
  const preTokens = meta.preTokenBalances || [];
  const postTokens = meta.postTokenBalances || [];
  const ownerPreTokens = preTokens.filter(t => t.owner === ownerAddress);
  const ownerPostTokens = postTokens.filter(t => t.owner === ownerAddress);

  let sentTokens = [];
  let receivedTokens = [];
  for (const preToken of ownerPreTokens) {
    const postToken = ownerPostTokens.find(
      t => t.mint === preToken.mint && t.accountIndex === preToken.accountIndex,
    );
    if (postToken) {
      const preAmount = parseFloat(
        preToken.uiTokenAmount.uiAmountString || '0',
      );
      const postAmount = parseFloat(
        postToken.uiTokenAmount.uiAmountString || '0',
      );
      const change = postAmount - preAmount;
      if (change < 0) {
        const isNFT =
          (preToken.uiTokenAmount.decimals || 0) === 0 &&
          Math.abs(change) === 1;
        sentTokens.push({
          mint: preToken.mint,
          change: Math.abs(change),
          isNFT,
        });
      } else if (change > 0) {
        const isNFT =
          (postToken.uiTokenAmount.decimals || 0) === 0 && change === 1;
        receivedTokens.push({
          mint: postToken.mint,
          change,
          isNFT,
        });
      }
    }
  }

  // New tokens received (not in pre)
  for (const postToken of ownerPostTokens) {
    if (
      !ownerPreTokens.find(
        t =>
          t.mint === postToken.mint &&
          t.accountIndex === postToken.accountIndex,
      )
    ) {
      const amount = parseFloat(postToken.uiTokenAmount.uiAmountString || '0');
      const isNFT =
        (postToken.uiTokenAmount.decimals || 0) === 0 && amount === 1;
      receivedTokens.push({
        mint: postToken.mint,
        change: amount,
        isNFT,
      });
    }
  }

  console.log(`Sent tokens: ${JSON.stringify(sentTokens)}`);
  console.log(`Received tokens: ${JSON.stringify(receivedTokens)}`);

  // Categorization logic (inspired by Phantom: prioritize dapp if programs involved and net changes suggest interaction)
  const hasTokenActivity = sentTokens.length > 0 || receivedTokens.length > 0;
  const netTokenChange =
    receivedTokens.reduce((sum, t) => sum + t.change, 0) -
    sentTokens.reduce((sum, t) => sum + t.change, 0);
  const isSwapLike =
    (hasTokenActivity && sentTokens.length > 0 && receivedTokens.length > 0) ||
    hasDappProgram;
  const isFeeOnly = Math.abs(netSolChange) < 0.0001 && !hasTokenActivity; // Tiny change, no tokens

  let type = 'unknown';
  let subtype = null;
  let details = {
    solChange: solChange,
    fee,
    programs: uniquePrograms,
    tokens: [],
  };

  if (hasDappProgram || isSwapLike || isFeeOnly) {
    type = 'dapp_interaction';
    subtype = isSwapLike ? 'swap' : isFeeOnly ? 'contract_call' : 'interaction';
    details.tokens = [
      ...receivedTokens.map(t => ({ ...t, direction: 'received' })),
      ...sentTokens.map(t => ({ ...t, direction: 'sent' })),
    ];
  } else if (netSolChange > 0 || receivedTokens.length > 0) {
    type = 'received';
    details.tokens = receivedTokens.map(t => ({
      ...t,
      type: t.isNFT
        ? 'nft'
        : t.mint === 'So11111111111111111111111111111111111111112'
        ? 'native_sol'
        : 'spl',
    }));
  } else if (netSolChange < 0 || sentTokens.length > 0) {
    type = 'sent';
    details.tokens = sentTokens.map(t => ({
      ...t,
      type: t.isNFT
        ? 'nft'
        : t.mint === 'So11111111111111111111111111111111111111112'
        ? 'native_sol'
        : 'spl',
    }));
  }

  console.log(`Net SOL change (incl fee): ${netSolChange}`);
  console.log(`Net Token change: ${netTokenChange}`);
  console.log(`Classification: ${type}${subtype ? ` (${subtype})` : ''}`);

  return { type, subtype, details };
}

// Run the script
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node script.js <address> [page]');
  process.exit(1);
}

const address = args[0];
const page = 1;

fetchAndCategorizeTransactions(address, page);
