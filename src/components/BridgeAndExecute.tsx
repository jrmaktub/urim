import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { useAccount, useSwitchChain } from 'wagmi';
import { optimismSepolia, baseSepolia } from 'wagmi/chains';

// Your UrimMarket contract ABI (only the createMarket function)
const URIM_MARKET_ABI = [
  {
    "name": "createMarket",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "_question", "type": "string" },
      { "name": "_optionA", "type": "string" },
      { "name": "_optionB", "type": "string" },
      { "name": "_duration", "type": "uint256" },
      { "name": "_priceFeedId", "type": "bytes32" },
      { "name": "_tragetPrice", "type": "int64" }
    ],
    "outputs": [{ "name": "", "type": "uint256" }]
  }
] as const;

const CONTRACT_ADDRESS = "0x8bFaF540467D3661CF50aF4A1f9a4818cAe47897";

// ETH/USD Price Feed ID for Pyth
const ETH_USD_PRICE_FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

function BridgeAndExecute() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();

  const isOnCorrectChain = chain?.id === optimismSepolia.id;

  if (!isConnected) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 rounded text-red-700">
        ⚠️ Please connect your wallet first
      </div>
    );
  }

  if (!isOnCorrectChain) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
        <p className="text-yellow-700 mb-3">
          ⚠️ You need to be on Optimism Sepolia to bridge and execute
        </p>
        <p className="text-sm text-yellow-600 mb-3">
          Current network: {chain?.name}
        </p>
        <button 
          onClick={() => switchChain({ chainId: optimismSepolia.id })}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Switch to Optimism Sepolia
        </button>
      </div>
    );
  }

  // Example market parameters
  const marketParams = {
    question: "Will ETH reach $4000 in 7 days?",
    optionA: "Yes, ETH will reach $4000",
    optionB: "No, ETH will stay below $4000",
    duration: 7 * 24 * 60 * 60, // 7 days in seconds
    priceFeedId: ETH_USD_PRICE_FEED,
    targetPrice: 400000000000n, // $4000 with 8 decimals (4000 * 1e8)
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold text-blue-900 mb-2">Bridge & Execute</h3>
        <p className="text-sm text-blue-700 mb-2">
          This will bridge 0.01 ETH from Optimism Sepolia to Base Sepolia
          and create a market on Base Sepolia in one transaction!
        </p>
        <div className="text-xs text-blue-600 space-y-1 mt-3">
          <p><strong>Question:</strong> {marketParams.question}</p>
          <p><strong>Option A:</strong> {marketParams.optionA}</p>
          <p><strong>Option B:</strong> {marketParams.optionB}</p>
          <p><strong>Duration:</strong> 7 days</p>
          <p><strong>Target Price:</strong> $4000</p>
        </div>
      </div>

      <div className="p-3 bg-green-100 border border-green-300 rounded">
        <p className="text-green-700">✅ Ready to bridge & execute!</p>
        <p className="text-sm text-green-600 mt-1">
          From: Optimism Sepolia → To: Base Sepolia
        </p>
        <p className="text-sm text-green-600">
          Wallet: {address?.slice(0, 8)}...{address?.slice(-6)}
        </p>
      </div>

      <BridgeAndExecuteButton
        contractAddress={CONTRACT_ADDRESS}
        contractAbi={URIM_MARKET_ABI}
        functionName="createMarket"
        buildFunctionParams={(token, amount, chainId, userAddress) => {
          // Return the function parameters for createMarket
          return {
            functionParams: [
              marketParams.question,
              marketParams.optionA,
              marketParams.optionB,
              marketParams.duration,
              marketParams.priceFeedId,
              marketParams.targetPrice
            ]
          };
        }}
        prefill={{
          toChainId: baseSepolia.id, // Destination: Base Sepolia
          token: 'USDC',
          amount: '0.1'
        }}
      >
        {({ onClick, isLoading, disabled }) => (
          <button
            onClick={onClick}
            disabled={isLoading || disabled}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
          >
            {isLoading ? '⏳ Bridging & Executing...' : '🚀 Bridge 0.01 ETH & Create Market'}
          </button>
        )}
      </BridgeAndExecuteButton>

      <div className="text-xs text-gray-500 space-y-1">
        <p>✅ Wallet Connected on {chain?.name}</p>
        <p>✅ Will bridge FROM Optimism Sepolia</p>
        <p>✅ Will execute ON Base Sepolia</p>
        <p className="text-green-600 font-semibold mt-2">Ready to go!</p>
      </div>
    </div>
  );
}

export default BridgeAndExecute;