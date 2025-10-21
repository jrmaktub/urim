import { encodeFunctionData, parseUnits, maxUint256 } from 'viem';
import { baseSepolia } from 'viem/chains';

// --- Base Sepolia Constants ---
export const USDC_TOKEN_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
export const BET_CONTRACT_ADDRESS = '0xa926eD649871b21dd4C18AbD379fE82C8859b21E' as const;
export const AMOUNT_USDC_6DP = parseUnits('1', 6); // 1 USDC = 1_000_000

// --- ABIS ---
const ERC20_ABI = [
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
}

export interface BetStatus {
  message: string;
  isLoading: boolean;
  callsId?: string | null;
}

/**
 * Execute a bet using standard wallet connection (RainbowKit/Wagmi)
 * 
 * Flow:
 * 1. Get connected wallet address
 * 2. Approve USDC if needed
 * 3. Place bet
 */
export async function executeBaseBet(
  walletClient: any,
  address: string,
  onStatusUpdate?: (status: BetStatus) => void
): Promise<BetResult> {
  const updateStatus = (message: string, isLoading = true, callsId: string | null = null) => {
    onStatusUpdate?.({ message, isLoading, callsId });
  };

  try {
    updateStatus('🔵 Preparing transaction...', true);

    // 1. Approve USDC
    updateStatus('🟣 Approving USDC...', true);
    
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [BET_CONTRACT_ADDRESS, maxUint256],
    });

    const approveTx = await walletClient.sendTransaction({
      to: USDC_TOKEN_ADDRESS,
      data: approveData,
      chain: baseSepolia,
      account: address,
      gas: BigInt(100000),
    });

    console.info('✅ USDC approved:', approveTx);

    // 2. Place bet
    updateStatus('⚙️ Placing bet...', true);

    const placeBetData = encodeFunctionData({
      abi: BET_CONTRACT_ABI,
      functionName: 'placeBet',
      args: [AMOUNT_USDC_6DP],
    });

    const betTx = await walletClient.sendTransaction({
      to: BET_CONTRACT_ADDRESS,
      data: placeBetData,
      chain: baseSepolia,
      account: address,
      gas: BigInt(3000000),
    });

    console.info('✅ Bet placed:', betTx);

    updateStatus('✅ Bet placed successfully!', false, betTx);

    return {
      success: true,
      txId: betTx,
    };
  } catch (error: any) {
    console.error('❌ Bet execution error:', error);
    const errorMessage = error?.message || 'Unknown error';
    updateStatus(`❌ Error: ${errorMessage}`, false);

    return {
      success: false,
      error: errorMessage,
    };
  }
}
