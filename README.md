# Aleo Pay-Per-View

This project is a simple full-stack Pay-Per-View app that uses:

- `frontend/`: React + Vite client
- `backend/`: Express API for proof verification and secure video access
- `aleo/`: Leo program that models the payment check circuit

The app now uses a simpler production-friendly flow:

- users connect an Aleo wallet in the frontend
- the wallet sends a public `credits.aleo` payment to the merchant address
- the backend verifies the Aleo transaction ID and amount on testnet
- if valid, it returns a short-lived one-time access token

## Project structure

```text
.
├── aleo
├── backend
└── frontend
```

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create backend env file:

```bash
cp backend/.env.example backend/.env
```

Set these values in `backend/.env`:

- `MERCHANT_ADDRESS`: the Aleo address that should receive payments
- `ALEO_API_URL`: defaults to `https://api.explorer.provable.com/v2`
- `ALEO_NETWORK_PATH`: defaults to `testnet`
- `ALEO_CHAIN_ID`: defaults to `testnetbeta`

3. Start both frontend and backend:

```bash
npm run dev
```

4. Open:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## How the PPV flow works

1. The frontend fetches the locked video catalog from the backend.
2. The user connects an Aleo wallet and approves a `credits.aleo/transfer_public_as_signer` payment to the merchant address.
3. The frontend sends the transaction ID, video ID, and wallet address to `POST /verify-payment`.
4. The backend fetches the transaction from Aleo testnet, verifies sender, recipient, amount, and replay status, then returns a short-lived JWT.
5. The frontend uses that JWT once against `GET /video/:id`.
6. If valid, the backend returns only `{ videoId }`.
7. The frontend builds the YouTube embed URL locally.

## Security notes

- The backend never returns a full YouTube URL, only the `videoId`.
- Access tokens expire after 5 minutes by default.
- Tokens are one-time use.
- Payment transactions are replay-protected in memory.
- Rate limiting is enabled on verification and access endpoints.
- Wallet payments are public in this simplified model because they use `credits.aleo` public transfer flow.

## Local development

### Frontend

```bash
npm run dev -w frontend
```

### Backend

```bash
cp backend/.env.example backend/.env
npm run dev -w backend
```

### Production frontend build

```bash
npm run build -w frontend
```

## Aleo / Leo setup

See [`aleo/README.md`](./aleo/README.md) for Leo and snarkOS installation plus local execution commands.

## Wallets

The frontend is wired for the official Universal Wallet Adapter packages and supports wallets such as Leo, Puzzle, Fox, and Soter on Aleo testnet. Users need one of those wallets installed and funded on testnet before they can pay to unlock a video.
