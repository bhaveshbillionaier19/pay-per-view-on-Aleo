import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  Account,
  AleoKeyProvider,
  AleoNetworkClient,
  initThreadPool,
  NetworkRecordProvider,
  ProgramManager,
  ProgramManagerBase,
} from '@provablehq/sdk/testnet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const aleoDir = path.resolve(projectRoot, 'aleo');

for (const envPath of [path.join(aleoDir, '.env'), path.join(projectRoot, 'backend', '.env')]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const estimateOnly = process.argv.includes('--estimate-only');
const apiUrl = process.env.ALEO_API_URL || process.env.ENDPOINT || 'https://api.explorer.provable.com/v2';
const priorityFee = Number(process.env.ALEO_PRIORITY_FEE || '0');
const privateFee = process.env.ALEO_PRIVATE_FEE === 'true';
const privateKey = process.env.PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
const expectedAddress = stripQuotes(process.env.ADDRESS || process.env.WALLET_ADDRESS || '');
const explorerBaseUrl = process.env.ALEO_EXPLORER_URL || 'https://testnet.explorer.provable.com';

if (!privateKey) {
  throw new Error('Missing PRIVATE_KEY or WALLET_PRIVATE_KEY in aleo/.env or backend/.env.');
}

if (privateFee) {
  throw new Error('This script currently supports public-balance deployment only. Set ALEO_PRIVATE_FEE=false or remove it.');
}

const programManifestPath = path.join(aleoDir, 'program.json');
const programSourcePath = path.join(aleoDir, 'src', 'main.aleo');

const programManifest = JSON.parse(fs.readFileSync(programManifestPath, 'utf8'));
const programSource = fs.readFileSync(programSourcePath, 'utf8');

const declaredProgramId = programManifest.program;
const sourceProgramId = parseProgramId(programSource);

if (!sourceProgramId) {
  throw new Error(`Unable to parse the program ID from ${programSourcePath}.`);
}

if (declaredProgramId !== sourceProgramId) {
  throw new Error(`Program ID mismatch: program.json has "${declaredProgramId}" but main.aleo has "${sourceProgramId}".`);
}

await initThreadPool();

const account = new Account({ privateKey: stripQuotes(privateKey) });
const networkClient = new AleoNetworkClient(apiUrl);
networkClient.setVerboseErrors(true);

const derivedAddress = normalizeAddress(account.address());
if (expectedAddress && derivedAddress !== expectedAddress) {
  throw new Error('The configured wallet address does not match the configured private key.');
}

const alreadyDeployed = await checkProgramExists(apiUrl, declaredProgramId);
if (alreadyDeployed) {
  throw new Error(`Program ${declaredProgramId} is already deployed on testnet. Use an upgrade flow or choose a new program ID.`);
}

const imports = await networkClient.getProgramImports(programSource);
const estimatedFeeMicrocredits = normalizeIntegerValue(await ProgramManagerBase.estimateDeploymentFee(programSource, imports));
const publicBalanceMicrocredits = normalizeIntegerValue(await networkClient.getPublicBalance(derivedAddress));
const priorityFeeMicrocredits = Math.round(priorityFee * 1_000_000);
const totalRequiredMicrocredits = estimatedFeeMicrocredits + priorityFeeMicrocredits;

console.log(`Program ID: ${declaredProgramId}`);
console.log(`Account: ${maskAddress(derivedAddress)}`);
console.log(`API URL: ${apiUrl}`);
console.log(`Estimated deployment fee: ${formatCredits(estimatedFeeMicrocredits)} credits (${estimatedFeeMicrocredits} microcredits)`);
console.log(`Priority fee: ${priorityFee.toFixed(6)} credits (${priorityFeeMicrocredits} microcredits)`);
console.log(`Public balance: ${formatCredits(publicBalanceMicrocredits)} credits (${publicBalanceMicrocredits} microcredits)`);

if (publicBalanceMicrocredits < totalRequiredMicrocredits) {
  throw new Error(`Insufficient public balance. Need ${formatCredits(totalRequiredMicrocredits)} credits including priority fee.`);
}

if (estimateOnly) {
  console.log('Estimate complete. No transaction was broadcast.');
  process.exit(0);
}

const keyProvider = new AleoKeyProvider();
keyProvider.useCache(true);

const recordProvider = new NetworkRecordProvider(account, networkClient);
const programManager = new ProgramManager(apiUrl, keyProvider, recordProvider);
programManager.setAccount(account);

console.log('Building and submitting deployment transaction to Aleo testnet...');
const transactionId = await programManager.deploy(programSource, priorityFee, false);
console.log(`Deployment transaction submitted: ${transactionId}`);
console.log(`Explorer: ${explorerBaseUrl}/transaction/${transactionId}`);

const confirmation = await waitForConfirmation(networkClient, transactionId);
if (confirmation) {
  console.log(`Deployment transaction is now visible on testnet with status: ${confirmation.status || 'accepted'}`);
} else {
  console.log('Transaction submitted but not yet confirmed during the polling window. Check the explorer link for final status.');
}

function parseProgramId(program) {
  const match = program.match(/program\s+([a-z0-9_]+\.aleo);/i);
  return match?.[1] || null;
}

function stripQuotes(value) {
  return (value || '').replace(/^['"]|['"]$/g, '');
}

function normalizeAddress(address) {
  if (typeof address === 'string') {
    return address;
  }

  if (typeof address?.to_string === 'function') {
    return address.to_string();
  }

  return String(address);
}

function formatCredits(microcredits) {
  return (Number(microcredits) / 1_000_000).toFixed(6);
}

function normalizeIntegerValue(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    return Number(value.replace(/[^0-9.-]/g, ''));
  }

  return Number(value);
}

function maskAddress(address) {
  if (!address || address.length < 12) {
    return address;
  }

  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

async function checkProgramExists(host, programId) {
  const response = await fetch(`${host.replace(/\/$/, '')}/program/${programId}`);
  return response.ok;
}

async function waitForConfirmation(networkClient, transactionId) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const transaction = await networkClient.getTransaction(transactionId);
      if (transaction) {
        return transaction;
      }
    } catch (_error) {
      // Keep polling while the transaction propagates.
    }

    console.log(`Waiting for confirmation... (${attempt}/12)`);
    await sleep(10000);
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
