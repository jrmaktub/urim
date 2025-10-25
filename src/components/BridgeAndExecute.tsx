import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { useAccount, useSwitchChain } from 'wagmi';
import { optimismSepolia, baseSepolia } from 'wagmi/chains';
import { parseUnits } from 'viem';

const URIM_QUANTUM_MARKET: `0x${string}` = '0xc0c5a6a7faa3255305be6e1cd7dd3c2e4a81f776';

const QUANTUM_MARKET_ABI = [{
  name: 'buyScenarioShares',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'marketId', type: 'uint256' },
    { name: 'scenarioIndex', type: 'uint256' },
    { name: 'usdcAmount', type: 'uint256' }
  ],
  outputs: []
}] as const;

function BridgeAndExecute() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();

  const isOnCorrectChain = chain?.id === optimismSepolia.id;

  const betParams = {
    marketId: 0n,
    scenarioIndex: 0n,
    usdcAmount: parseUnits('1', 6)
  };

  if (!isConnected) {
    return <div className="p-4 bg-red-100 rounded">⚠️ Connect wallet</div>;
  }

  if (!isOnCorrectChain) {
    return (
      <button onClick={() => switchChain({ chainId: optimismSepolia.id })} className="bg-blue-600 text-white px-4 py-2 rounded">
        Switch to Optimism Sepolia
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-yellow-100 rounded border border-yellow-300">
        <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Manual Approval Required (Workaround)</h3>
        <p className="text-sm text-yellow-800 mb-3">
          Due to a known bug, you need to manually approve USDC first:
        </p>
        <ol className="text-sm text-yellow-800 space-y-1 mb-3">
          <li>1. Go to <a href="https://sepolia-optimism.etherscan.io/address/0x5fd84259d66Cd46123540766Be93DFE6D43130D7#writeContract" target="_blank" className="text-blue-600 underline">USDC Contract</a></li>
          <li>2. Connect wallet → Write Contract</li>
          <li>3. Find <code className="bg-yellow-200 px-1">approve</code> function</li>
          <li>4. Spender: <code className="bg-yellow-200 px-1">0x036cbd53842c5426634e7929541ec2318f3dcf7e</code></li>
          <li>5. Amount: <code className="bg-yellow-200 px-1">1000000000</code> (1000 USDC)</li>
          <li>6. Click Write</li>
        </ol>
        <p className="text-xs text-yellow-700">Or use <a href="https://revoke.cash" target="_blank" className="text-blue-600 underline">revoke.cash</a> on OP Sepolia</p>
      </div>

      <div className="p-4 bg-purple-50 rounded border border-purple-200">
        <h3 className="font-semibold mb-2">Bridge & Place Bet</h3>
        <p className="text-sm text-gray-600 mb-3">
          Bridge 1 USDC from OP Sepolia to Base Sepolia and place bet
        </p>
        
        <BridgeAndExecuteButton
          contractAddress={URIM_QUANTUM_MARKET}
          contractAbi={QUANTUM_MARKET_ABI}
          functionName="buyScenarioShares"
          buildFunctionParams={() => ({
            functionParams: [
              betParams.marketId,
              betParams.scenarioIndex,
              betParams.usdcAmount
            ]
          })}
          prefill={{
            toChainId: baseSepolia.id,
            token: 'USDC',
            amount: '1'
          }}
        >
          {({ onClick, isLoading, disabled }) => (
            <button
              onClick={onClick}
              disabled={isLoading || disabled}
              className="w-full bg-purple-600 text-white px-6 py-4 rounded disabled:opacity-50 hover:bg-purple-700"
            >
              {isLoading ? '⏳ Processing...' : '🚀 Bridge & Place Bet'}
            </button>
          )}
        </BridgeAndExecuteButton>
      </div>
    </div>
  );
}

export default BridgeAndExecute;