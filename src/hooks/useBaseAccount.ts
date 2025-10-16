import { useAccount } from "wagmi";

export function useBaseAccount() {
  const { address, connector } = useAccount();

  const isBaseAccount = connector?.name === "Base Account";
  const status = address && isBaseAccount ? "connected" : "idle";

  return {
    universalAddress: address || null,
    subAccountAddress: address || null, // In wagmi, the address is the sub-account when using baseAccount connector
    status,
    isBaseAccount,
  };
}
