import { useEffect, useMemo, useState } from 'react';
import { WalletMultiButton } from '@demox-labs/aleo-wallet-adapter-reactui';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { discoverPayment, fetchPaymentConfig, fetchVideoAccess, fetchVideos, verifyPayment } from './api';

const initialNotice = 'Connect an Aleo wallet, pay the merchant in credits.aleo, and unlock the secure embed.';
const TX_ID_PATTERN = /at1[0-9a-z]+/i;
const DISCOVERY_ATTEMPTS = 12;
const DISCOVERY_DELAY_MS = 3000;

function buildEmbedUrl(videoId) {
  const origin = encodeURIComponent(window.location.origin);
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&origin=${origin}`;
}

function normalizeWalletAddress(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.to_string === 'function') {
    return value.to_string();
  }

  return String(value);
}

function extractTransactionId(result) {
  if (!result) {
    return '';
  }

  if (typeof result === 'string') {
    return result.match(TX_ID_PATTERN)?.[0] || '';
  }

  const serialized = JSON.stringify(result);
  return serialized.match(TX_ID_PATTERN)?.[0] || '';
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function App() {
  const { connected, publicKey, requestTransaction, wallet } = useWallet();
  const [videos, setVideos] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice);
  const [playerState, setPlayerState] = useState(null);
  const [transactionInputs, setTransactionInputs] = useState({});

  useEffect(() => {
    async function loadBootstrap() {
      try {
        const [items, config] = await Promise.all([fetchVideos(), fetchPaymentConfig()]);
        setVideos(items);
        setPaymentConfig(config);
      } catch (loadError) {
        setError(loadError.response?.data?.error || 'Unable to load videos.');
      } finally {
        setLoading(false);
      }
    }

    loadBootstrap();
  }, []);

  const walletAddress = useMemo(() => normalizeWalletAddress(publicKey), [publicKey]);

  function updateTransactionInput(videoId, value) {
    setTransactionInputs((current) => ({
      ...current,
      [videoId]: value,
    }));
  }

  async function completeUnlock(video, transactionId) {
    setNotice('Payment broadcast detected. Verifying the transaction on Aleo testnet...');

    const { token } = await verifyPayment({
      videoId: video.id,
      transactionId,
      walletAddress,
    });

    setNotice('Payment confirmed. Fetching one-time secure video access...');
    const { videoId } = await fetchVideoAccess(video.id, token);

    setPlayerState({
      id: video.id,
      title: video.title,
      videoId,
      embedUrl: buildEmbedUrl(videoId),
    });

    setTransactionInputs((current) => ({
      ...current,
      [video.id]: transactionId,
    }));
    setNotice('Payment verified. Video unlocked successfully.');
  }

  async function autoDiscoverTransaction(video) {
    for (let attempt = 1; attempt <= DISCOVERY_ATTEMPTS; attempt += 1) {
      setNotice(`Waiting for Aleo testnet to index your payment... (${attempt}/${DISCOVERY_ATTEMPTS})`);

      const result = await discoverPayment({
        videoId: video.id,
        walletAddress,
      });

      if (result.found && result.payment?.transactionId) {
        return result.payment.transactionId;
      }

      if (attempt < DISCOVERY_ATTEMPTS) {
        await sleep(DISCOVERY_DELAY_MS);
      }
    }

    throw new Error(
      'The wallet approved the payment, but the transaction ID was not discoverable yet. Wait a few seconds, then click Verify Payment or try again.',
    );
  }

  async function handleUnlock(video) {
    setProcessingId(video.id);
    setError('');
    setPlayerState(null);

    try {
      if (!connected || !walletAddress || !requestTransaction) {
        throw new Error('Connect a supported Aleo wallet before trying to pay.');
      }

      if (!paymentConfig?.merchantAddress) {
        throw new Error('Payment configuration is unavailable.');
      }

      setNotice(`Requesting wallet approval to pay ${video.price} Aleo credit for ${video.title}...`);

      const walletResult = await requestTransaction({
        address: walletAddress,
        chainId: paymentConfig.chainId,
        transitions: [
          {
            program: 'credits.aleo',
            functionName: 'transfer_public_as_signer',
            inputs: [paymentConfig.merchantAddress, `${video.priceMicrocredits}u64`],
          },
        ],
        fee: paymentConfig.transferFeeMicrocredits,
        feePrivate: false,
      });

      const transactionId = extractTransactionId(walletResult);
      const resolvedTransactionId = transactionId || (await autoDiscoverTransaction(video));

      await completeUnlock(video, resolvedTransactionId);
    } catch (unlockError) {
      setError(unlockError.response?.data?.error || unlockError.message || 'Payment verification failed.');
      setNotice(initialNotice);
    } finally {
      setProcessingId('');
    }
  }

  async function handleManualVerification(video) {
    const transactionId = (transactionInputs[video.id] || '').trim();
    setProcessingId(video.id);
    setError('');

    try {
      if (!connected || !walletAddress) {
        throw new Error('Connect the same wallet that sent the Aleo payment.');
      }

      if (!transactionId) {
        throw new Error('Paste a transaction ID first.');
      }

      await completeUnlock(video, transactionId);
    } catch (verificationError) {
      setError(verificationError.response?.data?.error || verificationError.message || 'Unable to verify payment.');
      setNotice(initialNotice);
    } finally {
      setProcessingId('');
    }
  }

  const activeVideo = useMemo(() => {
    if (!playerState) {
      return null;
    }

    return videos.find((video) => video.id === playerState.id) || null;
  }, [playerState, videos]);

  const featuredVideo = useMemo(
    () => videos.find((video) => video.featured) || videos[0] || null,
    [videos],
  );

  const statItems = useMemo(
    () => [
      {
        label: 'Network',
        value: paymentConfig?.chainId || 'testnetbeta',
        detail: 'Aleo wallet payment flow',
      },
      {
        label: 'Unlock Window',
        value: '5 mins',
        detail: 'One-time JWT access token',
      },
      {
        label: 'Catalog',
        value: `${videos.length}`,
        detail: 'Premium videos ready to unlock',
      },
    ],
    [paymentConfig, videos.length],
  );

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-topbar">
          <div className="wallet-state">
            <span>{connected ? `Connected: ${walletAddress}` : 'Wallet not connected'}</span>
            {wallet?.adapter?.name ? <span>Using {wallet.adapter.name}</span> : null}
          </div>
          <WalletMultiButton />
        </div>
        <p className="eyebrow">Aleo Pay-Per-View</p>
        <div className="hero-grid">
          <div className="hero-copy-block">
            <h1>Wallet payment. Verified access. Embedded playback.</h1>
            <p className="hero-copy">
              A polished PPV demo built for product showcases: users connect an Aleo wallet, approve a testnet
              payment, and unlock premium YouTube playback without exposing raw watch links.
            </p>

            <div className="hero-pill-row">
              <span className="hero-pill">Aleo Testnet Payments</span>
              <span className="hero-pill">One-Time Access Tokens</span>
              <span className="hero-pill">Hidden YouTube Delivery</span>
            </div>
          </div>

          <aside className="hero-feature-card">
            <span className="hero-feature-label">Featured Sample</span>
            <h2>{featuredVideo?.title || 'Loading featured content...'}</h2>
            <p>{featuredVideo?.summary || 'Preparing the featured implementation walkthrough for this demo.'}</p>
            <div className="hero-feature-meta">
              <span>{featuredVideo?.category || 'Wallet Demo'}</span>
              <span>{featuredVideo?.duration || 'Pending'}</span>
              <span>{featuredVideo ? `${featuredVideo.price} Aleo credit` : '1 Aleo credit'}</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="stat-grid">
        {statItems.map((item) => (
          <article className="stat-card" key={item.label}>
            <span className="stat-label">{item.label}</span>
            <strong className="stat-value">{item.value}</strong>
            <p className="stat-detail">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="status-panel">
        <strong>Status:</strong> {notice}
        {error ? <p className="error-text">{error}</p> : null}
        {paymentConfig ? (
          <p className="helper-text">
            Merchant: {paymentConfig.merchantAddress} | Network fee: {paymentConfig.transferFeeCredits} Aleo credit
          </p>
        ) : null}
      </section>

      <section className="layout-grid">
        <div className="catalog-panel">
          <div className="section-heading">
            <h2>Locked videos</h2>
            <span>{loading ? 'Loading...' : `${videos.length} premium demos`}</span>
          </div>

          {loading ? <div className="empty-card">Loading catalog...</div> : null}

          {!loading && videos.length === 0 ? <div className="empty-card">No videos available.</div> : null}

          <div className="video-grid">
            {videos.map((video) => (
              <article className={`video-card${video.featured ? ' featured-video-card' : ''}`} key={video.id}>
                <img className="thumbnail" src={video.thumbnailUrl} alt={`${video.title} thumbnail`} />
                <div className="video-card-body">
                  <div className="video-copy">
                    <div className="video-heading-row">
                      <span className="video-badge">{video.category}</span>
                      {video.featured ? <span className="featured-badge">Featured</span> : null}
                    </div>
                    <h3>{video.title}</h3>
                    <p>{video.summary}</p>
                    <div className="video-meta-row">
                      <span>{video.duration}</span>
                      <span>{video.price} Aleo credit</span>
                      <span>Wallet fee applies</span>
                    </div>
                  </div>
                  <div className="video-actions">
                    <button
                      className="pay-button"
                      type="button"
                      onClick={() => handleUnlock(video)}
                      disabled={processingId === video.id || !connected}
                    >
                      {processingId === video.id ? 'Processing...' : 'Pay With Wallet'}
                    </button>
                    <input
                      className="tx-input"
                      type="text"
                      value={transactionInputs[video.id] || ''}
                      onChange={(event) => updateTransactionInput(video.id, event.target.value)}
                      placeholder="Paste transaction ID if needed"
                    />
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => handleManualVerification(video)}
                      disabled={processingId === video.id}
                    >
                      Verify Payment
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="player-panel">
          <div className="section-heading">
            <h2>Secure player</h2>
            <span>{playerState ? 'Unlocked' : 'Locked'}</span>
          </div>

          {!playerState ? (
            <div className="player-placeholder">
              <div className="player-placeholder-copy">
                <strong>Presentation-ready playback</strong>
                <p>The YouTube embed appears only after the wallet payment is verified and the short-lived token is consumed.</p>
              </div>
            </div>
          ) : (
            <div className="player-wrapper">
              <div className="player-frame">
                <iframe
                  src={playerState.embedUrl}
                  title={playerState.title}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="player-meta">
                <h3>{playerState.title}</h3>
                <p>Access delivered through backend payment verification and a one-time JWT gate.</p>
                {activeVideo ? (
                  <>
                    <p>{activeVideo.summary}</p>
                    <div className="video-meta-row">
                      <span>{activeVideo.category}</span>
                      <span>{activeVideo.duration}</span>
                      <span>Price paid: {activeVideo.price} Aleo credit</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
