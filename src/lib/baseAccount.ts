import { createBaseAccountSDK } from '@base-org/account';
import { baseSepolia } from 'viem/chains';

let sdkInstance: ReturnType<typeof createBaseAccountSDK> | null = null;
let provider: ReturnType<ReturnType<typeof createBaseAccountSDK>['getProvider']> | null = null;
let subAccountAddr: `0x${string}` | null = null;

export async function initBaseSDK() {
  if (sdkInstance) return sdkInstance;

  sdkInstance = createBaseAccountSDK({
    appName: 'Urim',
    appLogoUrl: '/urim-logo.png',
    appChainIds: [baseSepolia.id],
    subAccounts: {
      creation: 'on-connect',
      defaultAccount: 'sub', // default to sub account
      // Auto Spend Permissions ON by default
    },
  });

  provider = sdkInstance.getProvider();
  return sdkInstance;
}

export async function ensureSubAccount(): Promise<{
  provider: NonNullable<typeof provider>;
  universal: `0x${string}`;
  sub: `0x${string}`;
}> {
  const sdk = await initBaseSDK();
  const prov = provider!;
  const accounts = (await prov.request({ method: 'eth_requestAccounts', params: [] })) as `0x${string}`[];
  const universal = accounts[0];

  // Fetch or create sub account
  const result = (await prov.request({
    method: 'wallet_getSubAccounts',
    params: [{ account: universal, domain: window.location.origin }],
  })) as { subAccounts: { address: `0x${string}` }[] };

  if (result?.subAccounts?.length > 0) {
    subAccountAddr = result.subAccounts[0].address;
  } else {
    const created = (await prov.request({
      method: 'wallet_addSubAccount',
      params: [{ account: { type: 'create' } }],
    })) as { address: `0x${string}` };
    subAccountAddr = created.address;
  }

  return { provider: prov, universal, sub: subAccountAddr! };
}

// Send any write transaction via the Sub Account
export async function sendFromSubAccount(tx: {
  to: `0x${string}`;
  data?: `0x${string}`;
  valueHex?: `0x${string}`;
}) {
  const { provider, sub } = await ensureSubAccount();

  try {
    const callsId = await provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          version: '2.0',
          atomicRequired: true,
          chainId: '0x14A34', // Base Sepolia
          from: sub,
          calls: [{ to: tx.to, data: tx.data ?? '0x', value: tx.valueHex ?? '0x0' }],
        },
      ],
    });
    return callsId;
  } catch {
    const hash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: sub, to: tx.to, data: tx.data ?? '0x', value: tx.valueHex ?? '0x0' }],
    });
    return hash;
  }
}
