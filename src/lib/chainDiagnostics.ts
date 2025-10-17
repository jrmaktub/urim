import { getBaseProvider, SDK_APP_CHAIN_IDS, BASE_SEPOLIA_CHAIN_ID } from './baseAccount';
import { CHAIN_ID_DECIMAL, CHAIN_ID_HEX } from './baseBetHelper';
import { baseSepolia } from 'wagmi/chains';

let printedOnce = false;

export async function initChainDiagnostics() {
  if (printedOnce) return;
  printedOnce = true;
  try {
    const provider = getBaseProvider();
    const providerChainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;

    // Report
    console.info('🔎 Chain Diagnostics');
    console.info('• SDK appChainIds (from baseAccount.ts):', SDK_APP_CHAIN_IDS);
    console.info('• provider.chainId (hex) (from Base provider):', providerChainIdHex);
    console.info('• wagmi client chainId (decimal) (from wagmi.config.ts):', baseSepolia.id);
    console.info('• wallet_sendCalls.chainId (from baseBetHelper.ts):', CHAIN_ID_HEX);

    // Detect mismatches
    const mismatches: string[] = [];
    if (!SDK_APP_CHAIN_IDS.includes(BASE_SEPOLIA_CHAIN_ID)) {
      mismatches.push('SDK appChainIds');
    }
    if (providerChainIdHex?.toLowerCase() !== CHAIN_ID_HEX.toLowerCase()) {
      mismatches.push('provider.chainId');
    }
    if (baseSepolia.id !== CHAIN_ID_DECIMAL) {
      mismatches.push('wagmi client chainId');
    }

    if (mismatches.length) {
      console.warn('⚠️ Chain mismatch detected in:', mismatches.join(', '));
    } else {
      console.info(`OK: chainId=${CHAIN_ID_HEX} (${CHAIN_ID_DECIMAL}) • provider/client/wallet_sendCalls all match`);
    }
  } catch (e) {
    console.error('Chain diagnostics failed:', e);
  }
}

export async function ensureProviderOnBaseSepolia(provider: any) {
  const current = (await provider.request({ method: 'eth_chainId' })) as string;
  if (current?.toLowerCase() === CHAIN_ID_HEX.toLowerCase()) return true;
  console.warn(`⚠️ Provider on ${current}, attempting switch to ${CHAIN_ID_HEX}`);
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (e) {
    console.warn('wallet_switchEthereumChain not available or failed; proceeding with configured chain.');
  }
  const after = (await provider.request({ method: 'eth_chainId' })) as string;
  return after?.toLowerCase() === CHAIN_ID_HEX.toLowerCase();
}

export function rebuildWagmiClientForBaseSepolia() {
  // wagmi config is already built for baseSepolia; this is a no-op placeholder for runtime rebuild.
  console.info('🔁 Ensuring wagmi client is configured for Base Sepolia (84532)');
}