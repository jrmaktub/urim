import { BridgeButton } from '@avail-project/nexus-widgets';
import { useAccount, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

function Bridge() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();

  const isOnCorrectChain = chain?.id === baseSepolia.id;

  if (!isConnected) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 rounded text-red-700">
        ⚠️ Please connect your wallet first using the Connect Wallet button
      </div>
    );
  }

  if (!isOnCorrectChain) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
        <p className="text-yellow-700 mb-3">
          ⚠️ You need to be on Base Sepolia to bridge to Optimism Sepolia
        </p>
        <p className="text-sm text-yellow-600 mb-3">
          Current network: {chain?.name}
        </p>
        <button
          onClick={() => switchChain({ chainId: baseSepolia.id })}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Switch to Base Sepolia
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-green-100 border border-green-300 rounded">
        <p className="text-green-700">✅ Ready to bridge!</p>
        <p className="text-sm text-green-600 mt-1">
          Wallet: {address?.slice(0, 8)}...{address?.slice(-6)} on {chain?.name}
        </p>
      </div>

      <BridgeButton
        prefill={{
          chainId: 11155420, // OP Sepolia (destination)
          token: 'ETH',
          amount: '0.01',
        }}
      >
        {({ onClick, isLoading }) => (
          <button
            onClick={onClick}
            disabled={isLoading}
            className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? '⏳ Bridging…' : '🌉 Bridge 0.01 ETH to OP Sepolia'}
          </button>
        )}
      </BridgeButton>

      <div className="text-xs text-gray-500 space-y-1">
        <p>✅ Wallet Connected</p>
        <p>✅ On Base Sepolia</p>
        <p className="text-green-600 font-semibold">Ready to bridge!</p>
      </div>
    </div>
  );
}

export default Bridge;