import { config } from './config.js';
import { AleoNetworkClient } from '@provablehq/sdk/testnet.js';
import { hasPaymentTransactionBeenUsed, markPaymentTransactionUsed } from './accessStore.js';
import { getVideoById } from './videos.js';

const TX_ID_PATTERN = /^at1[0-9a-z]+$/i;
const ADDRESS_PATTERN = /aleo1[0-9a-z]+/gi;
const U64_PATTERN = /(\d+)u64/;
const networkClient = new AleoNetworkClient(config.aleoApiUrl);

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildTransactionUrl(transactionId) {
  return `${config.aleoApiUrl.replace(/\/$/, '')}/${config.aleoNetworkPath}/transaction/${transactionId}`;
}

function parseU64(value) {
  const stringValue = String(value || '');
  const match = stringValue.match(U64_PATTERN);
  return match ? Number(match[1]) : NaN;
}

function parseFutureArguments(value) {
  const stringValue = String(value || '');
  const addresses = stringValue.match(ADDRESS_PATTERN) || [];
  const amountMatch = stringValue.match(U64_PATTERN);

  return {
    sender: addresses[0] || '',
    recipient: addresses[1] || '',
    amountMicrocredits: amountMatch ? Number(amountMatch[1]) : NaN,
  };
}

function extractCreditsTransfer(transaction) {
  const transitions = transaction?.execution?.transitions || transaction?.transaction?.execution?.transitions || [];
  return transitions.find(
    (transition) =>
      transition.program === 'credits.aleo' && transition.function === 'transfer_public_as_signer',
  );
}

function parsePaymentTransition(transition) {
  const recipient = String(transition.inputs?.[0]?.value || '');
  const amountMicrocredits = parseU64(transition.inputs?.[1]?.value);
  const futureOutput = transition.outputs?.find((output) => output.type === 'future');
  const futureArguments = parseFutureArguments(futureOutput?.value || '');

  return {
    recipient,
    amountMicrocredits,
    futureArguments,
  };
}

async function fetchTransactionWithRetry(transactionId, attempts = 8, delayMs = 3000) {
  const url = buildTransactionUrl(transactionId);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      return response.json();
    }

    if (response.status !== 404) {
      const errorBody = await response.text();
      throw new Error(`Unable to fetch Aleo transaction: ${errorBody}`);
    }

    if (attempt < attempts) {
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }

  throw new Error('Transaction not found on Aleo testnet yet. Wait a few seconds and verify again.');
}

export async function verifyPaymentTransaction({ transactionId, videoId, walletAddress }) {
  const video = getVideoById(videoId);

  assertCondition(video, 'Unknown video.');
  assertCondition(config.merchantAddress, 'Merchant address is not configured on the backend.');
  assertCondition(typeof walletAddress === 'string' && walletAddress.startsWith('aleo1'), 'Wallet address is required.');
  assertCondition(TX_ID_PATTERN.test(transactionId), 'Transaction ID is invalid.');

  const transaction = await fetchTransactionWithRetry(transactionId);
  assertCondition(transaction?.type === 'execute', 'Transaction is not an execute transaction.');
  assertCondition(transaction?.status !== 'rejected', 'Transaction was rejected on testnet.');

  const paymentTransition = extractCreditsTransfer(transaction);
  assertCondition(paymentTransition, 'No credits.aleo transfer_public_as_signer transition was found.');

  const { recipient, amountMicrocredits, futureArguments } = parsePaymentTransition(paymentTransition);

  assertCondition(recipient === config.merchantAddress, 'Payment recipient does not match the merchant address.');
  assertCondition(Number.isFinite(amountMicrocredits), 'Payment amount could not be parsed.');
  assertCondition(
    amountMicrocredits >= video.price * 1_000_000,
    `Payment amount is below the required price of ${video.price} Aleo credit.`,
  );
  assertCondition(futureArguments.sender === walletAddress, 'Transaction sender does not match the connected wallet.');
  assertCondition(futureArguments.recipient === config.merchantAddress, 'Future output recipient mismatch.');
  assertCondition(futureArguments.amountMicrocredits === amountMicrocredits, 'Future output amount mismatch.');

  const isFreshTransaction = markPaymentTransactionUsed(transactionId, {
    walletAddress,
    videoId,
  });
  assertCondition(isFreshTransaction, 'This transaction has already been used to unlock content.');

  return {
    ok: true,
    video,
    verificationMode: 'credits_transfer',
    explorerUrl: `${config.aleoExplorerTxBaseUrl}/${transactionId}`,
  };
}

export async function discoverRecentPayment({ videoId, walletAddress, maxBlocks = 120 }) {
  const video = getVideoById(videoId);

  assertCondition(video, 'Unknown video.');
  assertCondition(config.merchantAddress, 'Merchant address is not configured on the backend.');
  assertCondition(typeof walletAddress === 'string' && walletAddress.startsWith('aleo1'), 'Wallet address is required.');

  const latestHeight = await networkClient.getLatestHeight();
  const minHeight = Math.max(0, latestHeight - maxBlocks);
  const requiredAmountMicrocredits = video.price * 1_000_000;

  for (let height = latestHeight; height >= minHeight; height -= 1) {
    let transactions;

    try {
      transactions = await networkClient.getTransactions(height);
    } catch (_error) {
      continue;
    }

    for (const entry of transactions) {
      const transaction = entry.transaction || entry;
      const transactionId = transaction.id || entry.id;
      if (!transactionId || hasPaymentTransactionBeenUsed(transactionId)) {
        continue;
      }

      const paymentTransition = extractCreditsTransfer(entry);
      if (!paymentTransition) {
        continue;
      }

      const { recipient, amountMicrocredits, futureArguments } = parsePaymentTransition(paymentTransition);
      if (
        recipient === config.merchantAddress &&
        amountMicrocredits === requiredAmountMicrocredits &&
        futureArguments.sender === walletAddress &&
        futureArguments.recipient === config.merchantAddress
      ) {
        return {
          transactionId,
          blockHeight: height,
          amountMicrocredits,
          explorerUrl: `${config.aleoExplorerTxBaseUrl}/${transactionId}`,
        };
      }
    }
  }

  return null;
}
