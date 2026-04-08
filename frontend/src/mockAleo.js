const PROGRAM_ID = 'ppv_access.aleo';
const FUNCTION_NAME = 'pay_and_verify';

async function sha256Hex(value) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function generateMockAleoProof(video) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const paymentReference = crypto.randomUUID();

  const proofCore = {
    programId: PROGRAM_ID,
    functionName: FUNCTION_NAME,
    publicInputs: {
      videoId: video.id,
      amount: video.price,
      minimumAmount: video.price,
    },
    result: true,
    paymentReference,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  return {
    ...proofCore,
    proofHash: await sha256Hex(JSON.stringify(proofCore)),
  };
}

