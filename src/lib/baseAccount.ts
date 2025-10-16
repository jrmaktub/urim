import { createBaseAccountSDK } from "@base-org/account";
import { baseSepolia } from "viem/chains";

// Lazy SDK and provider initialization to avoid cross-origin issues in iframes
let sdkInstance: ReturnType<typeof createBaseAccountSDK> | null = null;
let providerInstance: any = null;

export function getBaseProvider() {
  if (!sdkInstance) {
    console.log("🔵 [URIM] Initializing Base Account SDK with Sub Accounts + Auto Spend...");
    sdkInstance = createBaseAccountSDK({
      appName: "URIM",
      appLogoUrl: "https://base.org/logo.png",
      appChainIds: [baseSepolia.id],
      paymasterUrls: {
        [baseSepolia.id]: "https://api.developer.coinbase.com/rpc/v1/base-sepolia",
      },
      subAccounts: {
        creation: "on-connect",
        defaultAccount: "sub",
      },
    });
  }
  
  if (!providerInstance) {
    console.log("🟢 [URIM] Getting provider instance...");
    providerInstance = sdkInstance.getProvider();
  }
  
  return providerInstance;
}

export async function debugBaseAccount() {
  try {
    const provider = getBaseProvider();
    console.log("🟣 [URIM] Connecting to Base Account...");
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
      params: [],
    })) as string[];

    const universal = accounts[0];
    const sub = accounts.length > 1 ? accounts[1] : accounts[0];
    console.log("✅ Universal Account:", universal);
    console.log("✅ Sub Account:", sub);

    const { subAccounts } = (await provider.request({
      method: "wallet_getSubAccounts",
      params: [{ account: universal, domain: window.location.origin }],
    })) as { subAccounts: { address: string }[] };
    console.log("🔹 Found Sub Accounts:", subAccounts);

    return { universal, sub, subAccounts };
  } catch (err) {
    console.error("❌ [URIM] Base SDK connection failed:", err);
  }
}

export async function testUSDCTransfer() {
  try {
    const provider = getBaseProvider();
    console.log("🟡 [URIM] Preparing test USDC transfer...");
    const result = await debugBaseAccount();
    if (!result) return;
    
    const { sub } = result;
    const usdcAddress = "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557";
    const recipient = "0x4bbfd120d9f352a0bed7a014bd67913a2007a878"; // dummy address
    const amountHex = "00000000000000000000000000000000000000000000000000000000000f4240"; // 1e6 = 1 USDC (6 decimals)
    const data = "0xa9059cbb" + recipient.slice(2).padStart(64, "0") + amountHex;

    console.log("🟢 [URIM] Sending 1 USDC from Sub Account...");
    const callsId = await provider.request({
      method: "wallet_sendCalls",
      params: [
        {
          version: "2.0",
          atomicRequired: true,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          from: sub,
          calls: [{ to: usdcAddress, data, value: "0x0" }],
        },
      ],
    });

    console.log("✅ [URIM] Transaction sent successfully:", callsId);
  } catch (err) {
    console.error("❌ [URIM] USDC transfer failed:", err);
  }
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
    const provider = getBaseProvider();
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
