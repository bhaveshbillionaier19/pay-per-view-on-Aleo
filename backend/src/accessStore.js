const proofReplayStore = new Map();
const accessTokenStore = new Map();
const paymentTransactionStore = new Map();

function isExpired(expiresAt) {
  return Date.now() >= expiresAt;
}

export function markProofReferenceUsed(reference, expiresAtIso) {
  cleanupStores();

  if (proofReplayStore.has(reference)) {
    return false;
  }

  proofReplayStore.set(reference, new Date(expiresAtIso).getTime());
  return true;
}

export function registerAccessToken(jti, videoId, expiresAtMillis) {
  cleanupStores();
  accessTokenStore.set(jti, {
    videoId,
    expiresAtMillis,
    used: false,
  });
}

export function consumeAccessToken(jti, videoId) {
  cleanupStores();

  const tokenState = accessTokenStore.get(jti);
  if (!tokenState) {
    return { ok: false, reason: 'Unknown access token.' };
  }

  if (tokenState.used) {
    return { ok: false, reason: 'Access token has already been used.' };
  }

  if (isExpired(tokenState.expiresAtMillis)) {
    accessTokenStore.delete(jti);
    return { ok: false, reason: 'Access token has expired.' };
  }

  if (tokenState.videoId !== videoId) {
    return { ok: false, reason: 'Access token is not valid for this video.' };
  }

  tokenState.used = true;
  accessTokenStore.set(jti, tokenState);

  return { ok: true };
}

export function markPaymentTransactionUsed(transactionId, metadata = {}) {
  if (paymentTransactionStore.has(transactionId)) {
    return false;
  }

  paymentTransactionStore.set(transactionId, {
    ...metadata,
    usedAtMillis: Date.now(),
  });

  return true;
}

export function hasPaymentTransactionBeenUsed(transactionId) {
  return paymentTransactionStore.has(transactionId);
}

export function cleanupStores() {
  const now = Date.now();

  for (const [reference, expiresAtMillis] of proofReplayStore.entries()) {
    if (isExpired(expiresAtMillis)) {
      proofReplayStore.delete(reference);
    }
  }

  for (const [jti, tokenState] of accessTokenStore.entries()) {
    if (isExpired(tokenState.expiresAtMillis)) {
      accessTokenStore.delete(jti);
    }
  }
}
