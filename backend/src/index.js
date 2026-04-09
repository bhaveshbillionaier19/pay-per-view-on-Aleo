import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { discoverRecentPayment, verifyPaymentTransaction } from './aleoVerifier.js';
import { consumeAccessToken } from './accessStore.js';
import { issueVideoAccessToken, verifyAccessToken } from './tokenService.js';
import { getVideoById, videos } from './videos.js';

const app = express();
const thumbnailsPath = fileURLToPath(new URL('../public/thumbnails', import.meta.url));

app.use(
  cors({
    origin: config.frontendOrigin,
  }),
);
app.set('trust proxy', true);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(express.json({ limit: '256kb' }));
app.use('/thumbnails', express.static(thumbnailsPath));

const verifyPaymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment verification requests. Please retry in a minute.' },
});

const videoAccessLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many video access requests. Please retry in a minute.' },
});

const discoverPaymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment discovery requests. Please retry in a minute.' },
});

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/videos', (request, response) => {
  const forwardedProto = request.get('x-forwarded-proto');
  const protocol = forwardedProto || request.protocol;
  const baseUrl = `${protocol}://${request.get('host')}`;

  response.json({
    videos: videos.map((video) => ({
      id: video.id,
      title: video.title,
      price: video.price,
      priceMicrocredits: video.price * 1_000_000,
      duration: video.duration,
      category: video.category,
      summary: video.summary,
      featured: Boolean(video.featured),
      thumbnailUrl: `${baseUrl}/thumbnails/${video.id}.svg`,
      locked: true,
    })),
  });
});

app.get('/payment-config', (_request, response) => {
  response.json({
    merchantAddress: config.merchantAddress,
    chainId: config.aleoChainId,
    networkPath: config.aleoNetworkPath,
    transferFeeMicrocredits: config.transferFeeMicrocredits,
    transferFeeCredits: (config.transferFeeMicrocredits / 1_000_000).toFixed(6),
    explorerTxBaseUrl: config.aleoExplorerTxBaseUrl,
  });
});

app.post('/verify-payment', verifyPaymentLimiter, async (request, response) => {
  try {
    const transactionId = request.body?.transactionId;
    const videoId = request.body?.videoId;
    const walletAddress = request.body?.walletAddress;

    if (!transactionId || !videoId || !walletAddress) {
      return response.status(400).json({ error: 'transactionId, videoId, and walletAddress are required.' });
    }

    const result = await verifyPaymentTransaction({
      transactionId,
      videoId,
      walletAddress,
    });
    const { token, expiresInSeconds } = issueVideoAccessToken(result.video.id);

    return response.json({
      token,
      expiresInSeconds,
      verificationMode: result.verificationMode,
      explorerUrl: result.explorerUrl,
    });
  } catch (error) {
    return response.status(400).json({
      error: error.message || 'Payment verification failed.',
    });
  }
});

app.post('/discover-payment', discoverPaymentLimiter, async (request, response) => {
  try {
    const videoId = request.body?.videoId;
    const walletAddress = request.body?.walletAddress;

    if (!videoId || !walletAddress) {
      return response.status(400).json({ error: 'videoId and walletAddress are required.' });
    }

    const match = await discoverRecentPayment({
      videoId,
      walletAddress,
    });

    return response.json({
      found: Boolean(match),
      payment: match,
    });
  } catch (error) {
    return response.status(400).json({
      error: error.message || 'Unable to discover a matching payment.',
    });
  }
});

app.post('/verify-proof', (_request, response) => {
  return response.status(410).json({
    error: 'The mock proof flow has been replaced. Use POST /verify-payment with an Aleo transaction ID.',
  });
});

app.get('/video/:id', videoAccessLimiter, (request, response) => {
  try {
    const authHeader = request.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return response.status(401).json({ error: 'Missing bearer token.' });
    }

    const decoded = verifyAccessToken(token);
    const targetVideo = getVideoById(request.params.id);

    if (!targetVideo) {
      return response.status(404).json({ error: 'Video not found.' });
    }

    const consumed = consumeAccessToken(decoded.jti, targetVideo.id);
    if (!consumed.ok) {
      return response.status(401).json({ error: consumed.reason });
    }

    return response.json({
      videoId: targetVideo.videoId,
    });
  } catch (error) {
    return response.status(401).json({
      error: error.message || 'Invalid access token.',
    });
  }
});

app.listen(config.port, () => {
  console.log(`PPV backend listening on http://localhost:${config.port}`);
});
