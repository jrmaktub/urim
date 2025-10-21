import { BridgeButton } from '@avail-project/nexus-widgets';
 
function Bridge() {
  return (
    <BridgeButton
      prefill={{
        chainId: 11155420,  // OP Sepolia (destination)
        token: 'ETH',
        amount: '0.01',
      }}
    >
      {({ onClick, isLoading }) => (
        <button onClick={onClick} disabled={isLoading}>
          {isLoading ? 'Bridging…' : 'Bridge 0.01 ETH to Sepolia'}
        </button>
      )}
    </BridgeButton>
  );
}

export default Bridge