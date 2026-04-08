import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
});

export const config = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-me',
  tokenTtlSeconds: Number(process.env.TOKEN_TTL_SECONDS || 300),
  aleoProgramId: process.env.ALEO_PROGRAM_ID || 'ppv_access.aleo',
  aleoApiUrl: process.env.ALEO_API_URL || 'https://api.explorer.provable.com/v2',
  aleoNetworkPath: process.env.ALEO_NETWORK_PATH || 'testnet',
  aleoChainId: process.env.ALEO_CHAIN_ID || 'testnetbeta',
  aleoExplorerTxBaseUrl:
    process.env.ALEO_EXPLORER_TX_BASE_URL || 'https://testnet.explorer.provable.com/transaction',
  merchantAddress: process.env.MERCHANT_ADDRESS || process.env.WALLET_ADDRESS || '',
  transferFeeMicrocredits: Number(process.env.ALEO_TRANSFER_FEE_MICROCREDITS || 100000),
  aleoFunctionName: 'pay_and_verify',
};
