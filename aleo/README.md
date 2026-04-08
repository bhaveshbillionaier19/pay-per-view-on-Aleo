# Aleo / Leo program

This folder contains a minimal Leo program that models the PPV payment rule:

```leo
transition pay_and_verify(public amount: u32, public minimum_amount: u32) -> bool
```

If `amount >= minimum_amount`, the transition returns `true`.

## Files

- `program.json`: Leo manifest
- `src/main.leo`: the payment verification circuit
- `src/main.aleo`: deployment-ready Aleo Instructions used by the SDK deploy script
- `examples/example_proof.json`: example app-shaped proof payload for the mocked backend verifier
- `scripts/deploy-testnet.js`: estimates the fee and deploys the program to Aleo testnet

## Install Leo

Official Aleo docs currently recommend installing Leo from source:

```bash
git clone --recurse-submodules https://github.com/ProvableHQ/leo
cd leo
cargo install --path .
leo --version
```

## Install snarkOS

Official Aleo docs currently recommend:

```bash
git clone --branch mainnet --single-branch https://github.com/ProvableHQ/snarkOS.git
cd snarkOS

# Ubuntu helper, optional but recommended on Ubuntu
./build_ubuntu.sh

cargo install --locked --path .
snarkos --version
```

## Run the Leo program locally

From this folder:

```bash
cd /path/to/project/aleo
leo run pay_and_verify 1u32 1u32
```

Expected result:

```text
true
```

Try a failing payment:

```bash
leo run pay_and_verify 0u32 1u32
```

Expected result:

```text
false
```

## Generate an execution proof locally

To produce a local execution proof using Aleo tooling, you can execute the transition:

```bash
snarkvm execute pay_and_verify 1u32 1u32 --offline
```

Or, if you want to point at a local node:

```bash
snarkvm execute pay_and_verify 1u32 1u32 --endpoint http://localhost:3030
```

## Run a local Aleo client node

After installing snarkOS:

```bash
snarkos start --client
```

If you are iterating fully offline, the frontend/backend demo in this repository does not require a running node because proof verification is mocked. The Leo package is included so you can replace the mock verifier with real Aleo execution and proof checks when you are ready.

## Deploy to testnet with the SDK

This repository includes a Node-based deploy helper that reads `aleo/.env` first and falls back to `backend/.env`.

Because current Aleo testnet deployments require a non-empty `constructor`, the deploy script uses `src/main.aleo` as the canonical deployment artifact. The Leo source remains in `src/main.leo`, but the constructor is currently defined in Aleo Instructions.

Estimate the deploy fee:

```bash
npm run aleo:estimate:testnet
```

Broadcast the deployment:

```bash
npm run aleo:deploy:testnet
```
