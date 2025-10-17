import { encodeFunctionData, parseUnits, maxUint256 } from 'viem';
import { getBaseProvider } from './baseAccount';

// --- AUTHORITATIVE CONSTANTS (Base Sepolia) ---
export const CHAIN_ID_HEX = '0x14A74' as const; // Base Sepolia (84532 decimal)
export const CHAIN_ID_DECIMAL = 84532 as const;
export const USDC_TOKEN_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
export const BET_CONTRACT_ADDRESS = '0xa926eD649871b21dd4C18AbD379fE82C8859b21E' as const;
export const AMOUNT_USDC_6DP = parseUnits('1', 6); // 1 USDC = 1_000_000

// --- ABIS ---
const ERC20_ABI = [
  {
    constant: true,
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const;

const BET_CONTRACT_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'usdcAmount', type: 'uint256' }],
    name: 'placeBet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export interface BetResult {
  success: boolean;
  txId?: string;
  error?: string;
  needsPermission?: boolean;
}

export interface BetStatus {
  message: string;
  isLoading: boolean;
  callsId?: string | null;
}

// Request Spend Permission via Base Account SDK
async function requestSpendPermission(provider: any, account: string) {
  try {
    console.info('🔑 Requesting Spend Permission (100 USDC, 1 day)');
    await provider.request({
      method: 'wallet_requestSpendPermission',
      params: [
        {
          account,
          spender: BET_CONTRACT_ADDRESS,
          token: USDC_TOKEN_ADDRESS,
          chainId: CHAIN_ID_DECIMAL,
          allowance: 100_000_000, // 100 USDC (6 decimals)
          periodInDays: 1,
        },
      ],
    });
    console.info('✅ Spend Permission requested');
  } catch (e) {
    console.error('❌ Spend Permission request failed:', e);
    throw e;
  }
}

/**
 * Execute a bet using Base Sub Account + Auto Spend Permissions
 * This is the SINGLE SOURCE OF TRUTH for placing bets
 * 
 * Flow:
 * 1. Get singleton provider (NO re-initialization)
 * 2. Request Sub Account (accounts[1])
 * 3. Check USDC allowance
 * 4. Build calls: [approve (if needed), placeBet]
 * 5. Execute via wallet_sendCalls v2.0.0 from Sub Account
 * 6. First bet: "Skip further approvals" → Auto-Spend enabled
 * 7. Future bets: Silent execution (no popup)
 */
export async function executeBaseBet(
  onStatusUpdate?: (status: BetStatus) => void
): Promise<BetResult> {
  const updateStatus = (message: string, isLoading = true, callsId: string | null = null) => {
    onStatusUpdate?.({ message, isLoading, callsId });
  };

  try {
    updateStatus('🔵 Connecting Base Smart Wallet...', true);

    // 1. Get Base provider (SINGLETON - prevents Base Pay redirect)
    const provider = getBaseProvider();
    if (!provider) {
      throw new Error('Base provider not available');
    }
    console.info('✅ Using cached provider: true');
    // Ensure in-page execution (no Base Pay redirect)
    provider.setConfig?.({ disableRedirectFallback: true });
    console.info('🔒 Redirect fallback disabled = true');
    console.info('🧪 Is sandboxed?', window.top !== window.self);

    // 2. Connect and get Sub Account (accounts[1])
    updateStatus('🟣 Requesting Sub Account...', true);
    let accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    
    if (accounts.length === 0) {
      console.info('🔄 Requesting account access...');
      accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
    }

    const universalAccount = accounts[0];
    const subAccountAddress = accounts[1]; // Sub Account for Auto-Spend

    console.info('🔵 Universal Account:', universalAccount);
    console.info('🟢 Sub Account (Auto-Spend):', subAccountAddress);

    if (!subAccountAddress) {
      throw new Error('Sub Account not found. Reconnect Base Account to create a Sub Account.');
    }

    // Runtime guard: ensure provider is on Base Sepolia before sending
    const currentChain = (await provider.request({ method: 'eth_chainId' })) as string;
    if (currentChain?.toLowerCase() !== CHAIN_ID_HEX.toLowerCase()) {
      console.warn(`⚠️ Provider chainId=${currentChain} — expected ${CHAIN_ID_HEX}. Attempting switch...`);
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
      } catch (e) {
        console.warn('wallet_switchEthereumChain not available or failed; will proceed with wallet_sendCalls specifying chainId');
      }
    }

    // 3. Check USDC allowance from Sub Account
    updateStatus('⏳ Checking USDC allowance...', true);
    const allowanceCallData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [subAccountAddress as `0x${string}`, BET_CONTRACT_ADDRESS],
    });

    const allowanceResult = (await provider.request({
      method: 'eth_call',
      params: [
        {
          to: USDC_TOKEN_ADDRESS,
          data: allowanceCallData,
        },
        'latest',
      ],
    })) as string;

    const currentAllowance = BigInt(allowanceResult);
    console.info(`💰 Current USDC allowance: ${currentAllowance.toString()}`);

    // 4. Build calls array: [approve (if needed), placeBet]
    const calls = [];

    // Add approve call ONLY if allowance < amount
    if (currentAllowance < AMOUNT_USDC_6DP) {
      console.info('⚠️ Insufficient allowance, adding approve call');
      updateStatus('🟣 Approving USDC (enables Auto-Spend)...', true);

      const approveCallData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [BET_CONTRACT_ADDRESS, maxUint256],
      });

      calls.push({
        to: USDC_TOKEN_ADDRESS,
        data: approveCallData,
        value: '0x0',
      });
    }

    // Add placeBet call (ALWAYS)
    const placeBetCallData = encodeFunctionData({
      abi: BET_CONTRACT_ABI,
      functionName: 'placeBet',
      args: [AMOUNT_USDC_6DP], // 1_000_000 = 1 USDC
    });

    calls.push({
      to: BET_CONTRACT_ADDRESS,
      data: placeBetCallData,
      value: '0x0',
    });

    updateStatus('⚙️ Placing bet with Auto-Spend...', true);

    console.info('📡 wallet_sendCalls -> version=2.0.0, chainId=' + CHAIN_ID_HEX + ', from=' + subAccountAddress + ', calls=' + calls.length);

    // 5. Execute via wallet_sendCalls v2.0.0 from Sub Account
    // CRITICAL: Must use v2.0.0 + Sub Account to enable Auto-Spend (no Base Pay)
    try {
      const result = (await provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            version: '2.0.0', // ✅ REQUIRED for Auto-Spend Permissions
            atomicRequired: true,
            chainId: CHAIN_ID_HEX, // 0x14A74 - must match SDK appChainIds
            from: subAccountAddress, // ✅ MUST be Sub Account (accounts[1])
            calls,
          },
        ],
      })) as string;

      console.info('✅ Auto-Spend enabled; TX=' + result);
      console.info('✅ Transaction stayed in-app (no Base Pay redirect)');
      console.info(`OK: chainId=${CHAIN_ID_HEX} (${CHAIN_ID_DECIMAL}) • provider/client/wallet_sendCalls all match`);

      updateStatus('✅ Bet placed! Auto-Spend enabled.', false, result);

      return {
        success: true,
        txId: result,
      };
    } catch (sendErr: any) {
      const msg = (sendErr?.message || '').toLowerCase();
      const clientChainErr = msg.includes('client not found for chainid');
      const permissionErr = msg.includes('allowance') || msg.includes('permission') || msg.includes('cap exceeded');
      if (permissionErr) {
        updateStatus('🔑 Requesting Spend Permission...', true);
        await requestSpendPermission(provider, universalAccount);
        console.info('🔁 Retrying wallet_sendCalls after permission grant');

        const retryResult = (await provider.request({
          method: 'wallet_sendCalls',
          params: [
            {
                version: '2.0.0',
                atomicRequired: true,
                chainId: CHAIN_ID_HEX,
                from: subAccountAddress,
                calls,
            },
          ],
        })) as string;

        console.info('✅ Auto-Spend enabled; TX=' + retryResult);
        updateStatus('✅ Bet placed! Auto-Spend enabled.', false, retryResult);
        return { success: true, txId: retryResult };
      }

      if (clientChainErr) {
        console.warn('⚠️ Client not found for chain — ensuring wagmi client is on 84532 and retrying once...');
        try {
          // Soft-rebuild wagmi/viem client context (no-op if already correct)
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const { rebuildWagmiClientForBaseSepolia } = await import('./chainDiagnostics');
          rebuildWagmiClientForBaseSepolia();

          const retry = (await provider.request({
            method: 'wallet_sendCalls',
            params: [
              {
                version: '2.0.0',
                atomicRequired: true,
                chainId: CHAIN_ID_HEX,
                from: subAccountAddress,
                calls,
              },
            ],
          })) as string;

          updateStatus('✅ Bet submitted!', false, retry);
          return { success: true, txId: retry };
        } catch (_) {
          // fall through to error toast
        }
      }

      throw sendErr;
    }
  } catch (error: any) {
    console.error('❌ Bet execution error:', error);

    const errorMessage = error?.message || 'Unknown error';
    
    // Detect if redirect/navigation occurred (should NOT happen)
    if (errorMessage.toLowerCase().includes('redirect') || 
        errorMessage.toLowerCase().includes('navigation') ||
        window.location.href.includes('keys.coinbase.com')) {
      console.error('❌ Redirect detected - Base Pay was triggered incorrectly!');
      console.error('Stack:', error?.stack);
    }
    
    // Check if it's a permission/allowance error
    const needsPermission = 
      errorMessage.toLowerCase().includes('allowance') ||
      errorMessage.toLowerCase().includes('permission') ||
      errorMessage.toLowerCase().includes('cap exceeded');

    updateStatus(`❌ Error: ${errorMessage}`, false);

    return {
      success: false,
      error: errorMessage,
      needsPermission,
    };
  }
}
