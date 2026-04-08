import React from 'react';
import ReactDOM from 'react-dom/client';
import { useMemo } from 'react';
import { DecryptPermission, WalletAdapterNetwork } from '@demox-labs/aleo-wallet-adapter-base';
import { WalletProvider } from '@demox-labs/aleo-wallet-adapter-react';
import { WalletModalProvider } from '@demox-labs/aleo-wallet-adapter-reactui';
import { FoxWalletAdapter, LeoWalletAdapter, PuzzleWalletAdapter, SoterWalletAdapter } from 'aleo-adapters';
import '@demox-labs/aleo-wallet-adapter-reactui/dist/styles.css';
import App from './App';
import './styles.css';

function Root() {
  const wallets = useMemo(
    () => [
      new LeoWalletAdapter({
        appName: 'Aleo Pay-Per-View',
      }),
      new PuzzleWalletAdapter({
        appName: 'Aleo Pay-Per-View',
        appDescription: 'Pay-per-view video unlocks using Aleo testnet credits.',
        appIconUrl: '',
        programIdPermissions: {
          [WalletAdapterNetwork.TestnetBeta]: ['credits.aleo'],
        },
      }),
      new FoxWalletAdapter({
        appName: 'Aleo Pay-Per-View',
      }),
      new SoterWalletAdapter({
        appName: 'Aleo Pay-Per-View',
      }),
    ],
    [],
  );

  return (
    <React.StrictMode>
      <WalletProvider
        wallets={wallets}
        network={WalletAdapterNetwork.TestnetBeta}
        decryptPermission={DecryptPermission.UponRequest}
        autoConnect
      >
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
