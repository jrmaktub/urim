import { createBaseAccountSDK } from "@base-org/account";
import { baseSepolia } from "viem/chains";

// CRITICAL: Singleton pattern - SDK and provider MUST be persistent
let sdkInstance: ReturnType<typeof createBaseAccountSDK> | null = null;
let providerInstance: any = null;
let subAccountCache: { address: string } | null = null;

export function getBaseSDK() {
  if (!sdkInstance) {
    console.log("🔵 Initializing Base Account SDK...");
    sdkInstance = createBaseAccountSDK({
      appName: "Urim – Quantum Prediction Markets",
      appLogoUrl: "https://urim.lovable.app/icon.png",
      appChainIds: [baseSepolia.id], // 84532
      subAccounts: {
        creation: "on-connect",
        defaultAccount: "sub",
      },
    });
    console.log(`✅ SDK initialized for Base Sepolia (Chain ID: ${baseSepolia.id})`);
  }
  return sdkInstance;
}

export function getBaseProvider() {
  if (!providerInstance) {
    const sdk = getBaseSDK();
    console.log("🟢 Creating provider instance...");
    providerInstance = sdk.getProvider();
    console.log("✅ Provider cached");
  }
  return providerInstance;
}

export async function getSubAccount() {
  if (!subAccountCache) {
    const provider = getBaseProvider();
    
    // Get universal account
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
      params: [],
    })) as string[];
    
    const universalAccount = accounts[0];
    console.log("🟣 Checking for existing Sub Account...");
    
    // Check for existing sub accounts
    const response = (await provider.request({
      method: "wallet_getSubAccounts",
      params: [{ account: universalAccount, domain: window.location.origin }],
    })) as { subAccounts: { address: string }[] };
    
    if (response.subAccounts.length > 0) {
      subAccountCache = response.subAccounts[0];
      console.log("✅ Existing Sub Account found:", subAccountCache.address);
    } else {
      console.log("🟣 Creating new Sub Account...");
      const newSubAccount = (await provider.request({
        method: "wallet_addSubAccount",
        params: [{ account: { type: 'create' } }],
      })) as { address: string };
      
      subAccountCache = newSubAccount;
      console.log("✅ Sub Account created:", subAccountCache.address);
    }
  }
  return subAccountCache;
}

export async function debugBaseAccount() {
  try {
    const provider = getBaseProvider();
    console.log("🟣 Connecting to Base Account...");
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
      params: [],
    })) as string[];

    console.log("✅ Connected accounts:", accounts);

    return { accounts };
  } catch (err) {
    console.error("❌ Base SDK connection failed:", err);
  }
}

export async function testUSDCTransfer() {
  try {
    const provider = getBaseProvider();
    const subAccount = await getSubAccount();
    
    console.log("🟡 Preparing test USDC transfer...");
    const usdcAddress = "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557";
    const recipient = "0x4bbfd120d9f352a0bed7a014bd67913a2007a878";
    const amountHex = "00000000000000000000000000000000000000000000000000000000000f4240"; // 1 USDC
    const data = "0xa9059cbb" + recipient.slice(2).padStart(64, "0") + amountHex;

    console.log("🟢 Sending 1 USDC from Sub Account...");
    const callsId = await provider.request({
      method: "wallet_sendCalls",
      params: [
        {
          version: "2.0",
          atomicRequired: true,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          from: subAccount.address,
          calls: [{ to: usdcAddress, data, value: "0x0" }],
        },
      ],
    });

    console.log("✅ Transaction sent successfully:", callsId);
  } catch (err) {
    console.error("❌ USDC transfer failed:", err);
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
    const subAccount = await getSubAccount();

    const tx = await provider.request({
      method: "wallet_sendCalls",
      params: [
        {
          version: "2.0",
          atomicRequired: true,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          from: subAccount.address,
          calls: [{ to, data, value }],
        },
      ],
    });
    console.log("✅ Transaction sent:", tx);
    return tx;
  } catch (err) {
    console.error("Transaction failed:", err);
    throw err;
  }
}
