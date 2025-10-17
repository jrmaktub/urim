import { encodeFunctionData, parseUnits, maxUint256 } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getBaseProvider, getSubAccount } from './baseAccount';

// --- Base Sepolia Constants ---
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
          chainId: baseSepolia.id,
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
 * Following official Base Sub Accounts documentation
 * 
 * Flow:
 * 1. Get singleton provider
 * 2. Get Sub Account via SDK
 * 3. Check USDC allowance
 * 4. Build calls: [approve (if needed), placeBet]
 * 5. Execute via wallet_sendCalls v2.0 from Sub Account
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

    // 1. Get Base provider (singleton)
    const provider = getBaseProvider();
    if (!provider) {
      throw new Error('Base provider not available');
    }

    // 2. Get Sub Account via SDK
    updateStatus('🟣 Getting Sub Account...', true);
    const subAccount = await getSubAccount();
    const subAccountAddress = subAccount.address;

    console.info('✅ Sub Account:', subAccountAddress);
    console.info(`✅ Auto-Spend active, ChainID ${baseSepolia.id}`);

    // 3. Connect accounts
    const accounts = (await provider.request({ 
      method: 'eth_requestAccounts',
      params: [] 
    })) as string[];
    
    const universalAccount = accounts[0];
    console.info('🔵 Universal Account:', universalAccount);

    // 4. Check USDC allowance from Sub Account
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

    // 5. Build calls array: [approve (if needed), placeBet]
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
      args: [AMOUNT_USDC_6DP],
    });

    calls.push({
      to: BET_CONTRACT_ADDRESS,
      data: placeBetCallData,
      value: '0x0',
    });

    updateStatus('⚙️ Placing bet with Auto-Spend...', true);

    const chainIdHex = `0x${baseSepolia.id.toString(16)}`;
    console.info(`📡 wallet_sendCalls -> version=2.0, chainId=${chainIdHex} (${baseSepolia.id}), from=${subAccountAddress}, calls=${calls.length}`);

    // 6. Execute via wallet_sendCalls v2.0 from Sub Account
    try {
      const result = (await provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            version: '2.0',
            atomicRequired: true,
            chainId: chainIdHex,
            from: subAccountAddress,
            calls,
          },
        ],
      })) as string;

      console.info('✅ Auto-Spend enabled; TX=' + result);
      console.info(`✅ Auto-Spend active, ChainID ${baseSepolia.id}`);

      updateStatus('✅ Bet placed! Auto-Spend enabled.', false, result);

      return {
        success: true,
        txId: result,
      };
    } catch (sendErr: any) {
      const msg = (sendErr?.message || '').toLowerCase();
      const permissionErr = msg.includes('allowance') || msg.includes('permission') || msg.includes('cap exceeded');
      
      if (permissionErr) {
        updateStatus('🔑 Requesting Spend Permission...', true);
        await requestSpendPermission(provider, universalAccount);
        console.info('🔁 Retrying wallet_sendCalls after permission grant');

        const retryResult = (await provider.request({
          method: 'wallet_sendCalls',
          params: [
            {
                version: '2.0',
                atomicRequired: true,
                chainId: chainIdHex,
                from: subAccountAddress,
                calls,
            },
          ],
        })) as string;

        console.info('✅ Auto-Spend enabled; TX=' + retryResult);
        updateStatus('✅ Bet placed! Auto-Spend enabled.', false, retryResult);
        return { success: true, txId: retryResult };
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
