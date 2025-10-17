import { encodeFunctionData, parseUnits, maxUint256 } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getBaseProvider } from './baseAccount';

// --- CONSTANTS ---
export const CHAIN_ID_HEX = '0x14A74' as const; // Base Sepolia
export const USDC_TOKEN_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
export const OUR_CONTRACT_ADDRESS = '0xa926eD649871b21dd4C18AbD379fE82C8859b21E' as const;
export const AMOUNT_USDC_6DP = parseUnits('1', 6); // 1 USDC

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

/**
 * Execute a bet using Base Sub Account + Auto Spend Permissions
 * This is the single source of truth for placing bets on URIM
 */
export async function executeBaseBet(
  onStatusUpdate?: (status: BetStatus) => void
): Promise<BetResult> {
  const updateStatus = (message: string, isLoading = true, callsId: string | null = null) => {
    onStatusUpdate?.({ message, isLoading, callsId });
  };

  try {
    updateStatus('🔵 Connecting Base Smart Wallet...', true);

    // 1. Get Base provider (SINGLETON - reused across all calls)
    const provider = getBaseProvider();
    if (!provider) {
      throw new Error('Base provider not available');
    }
    console.log('✅ Using cached provider instance (prevents Base Pay redirect)');

    // 2. Connect and get Sub Account
    updateStatus('🟣 Requesting accounts...', true);
    let accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    
    if (accounts.length < 2) {
      console.log('🔄 Requesting account access...');
      accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
    }

    const universalAccount = accounts[0];
    const subAccountAddress = accounts[1]; // Sub account is the second account

    console.log('🔵 Universal Account:', universalAccount);
    console.log('🟢 Sub Account (Auto-Spend):', subAccountAddress);

    if (!subAccountAddress) {
      throw new Error('Sub Account not found. Please reconnect your wallet.');
    }

    // 3. Check USDC allowance
    updateStatus('⏳ Checking USDC allowance...', true);
    const allowanceCallData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [subAccountAddress as `0x${string}`, OUR_CONTRACT_ADDRESS],
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
    console.log(`💰 Current USDC allowance: ${currentAllowance.toString()}`);

    // 4. Build calls array
    const calls = [];

    // Add approve call if needed
    if (currentAllowance < AMOUNT_USDC_6DP) {
      console.log('⚠️ Insufficient allowance, adding approve call');
      updateStatus('🟣 Approving USDC (enables Auto-Spend)...', true);

      const approveCallData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [OUR_CONTRACT_ADDRESS, maxUint256],
      });

      calls.push({
        to: USDC_TOKEN_ADDRESS,
        data: approveCallData,
        value: '0x0',
      });
    }

    // Add placeBet call
    const placeBetCallData = encodeFunctionData({
      abi: BET_CONTRACT_ABI,
      functionName: 'placeBet',
      args: [AMOUNT_USDC_6DP],
    });

    calls.push({
      to: OUR_CONTRACT_ADDRESS,
      data: placeBetCallData,
      value: '0x0',
    });

    updateStatus('⚙️ Placing bet with Auto-Spend...', true);

    console.log('📡 Sending wallet_sendCalls with params:', {
      version: '2.0.0',
      atomicRequired: true,
      chainId: CHAIN_ID_HEX,
      from: subAccountAddress,
      callsCount: calls.length,
    });

    // 5. Send transaction with wallet_sendCalls v2.0.0 (enables auto-spend)
    // CRITICAL: This must NOT redirect to Base Pay - it should show Base popup in-app
    const result = (await provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          version: '2.0.0', // ✅ Critical: Use 2.0.0 for auto-spend permissions
          atomicRequired: true,
          chainId: CHAIN_ID_HEX,
          from: subAccountAddress,
          calls,
        },
      ],
    })) as string;

    console.log('✅ Bet Tx:', result);
    console.log('✅ Auto-Spend enabled! Future transactions won\'t need approval.');
    console.log('✅ NO Base Pay redirect - transaction stayed in-app');

    updateStatus('✅ Bet placed! Auto-Spend enabled.', false, result);

    return {
      success: true,
      txId: result,
    };
  } catch (error: any) {
    console.error('❌ Bet execution error:', error);

    const errorMessage = error?.message || 'Unknown error';
    
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
