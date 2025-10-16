import { createBaseAccountSDK } from "@base-org/account";
import { baseSepolia } from "viem/chains";

export const baseAccountSDK = createBaseAccountSDK({
  appName: "Urim — Quantum & Everything Bets",
  appLogoUrl: "/urim-logo.png",
  appChainIds: [baseSepolia.id],
  paymasterUrls: ["https://paymaster.base.org"],
  subAccounts: {
    creation: "on-connect",
    defaultAccount: "sub",
  },
});

// Lazy initialization - only get provider when needed
let providerInstance: ReturnType<typeof baseAccountSDK.getProvider> | null = null;

function getProvider() {
  if (!providerInstance) {
    providerInstance = baseAccountSDK.getProvider();
  }
  return providerInstance;
}

export async function sendTransaction({ 
  to, 
  data, 
  value = "0x0" 
}: { 
  to: string; 
  data: string; 
  value?: string;
}) {
  try {
    const provider = getProvider();
    
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
      params: [],
    })) as string[];

    const from = accounts[0];
    const tx = await provider.request({
      method: "wallet_sendCalls",
      params: [
        {
          version: "2.0",
          atomicRequired: true,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          from,
          calls: [{ to, data, value }],
        },
      ],
    });
    console.log("✅ Transaction sent (no wallet pop-up):", tx);
    return tx;
  } catch (err) {
    console.error("Transaction failed:", err);
    throw err;
  }
}

export { getProvider as getBaseProvider };
