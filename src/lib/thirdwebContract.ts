import { createThirdwebClient, getContract, prepareEvent } from "thirdweb";
import { base } from "thirdweb/chains";
import HondurasElectionABI from "@/contracts/HondurasElection.json";

// Initialize thirdweb client
export const thirdwebClient = createThirdwebClient({
  clientId: "6338fc246f407a9d38ba885ba43487f2",
});

// Honduras Election Contract
export const hondurasElectionContract = getContract({
  client: thirdwebClient,
  address: "0xb73D817C1c90606ecb6d131a10766919fcBD6Ec6",
  chain: base,
  abi: HondurasElectionABI as any,
});

// Prepare events for listening
export const sharesPurchasedEvent = prepareEvent({
  signature: "event SharesPurchased(address indexed buyer, uint256 candidateId, uint256 usdcAmount, uint256 sharesReceived, uint256 newPrice)",
});

export const sharesSoldEvent = prepareEvent({
  signature: "event SharesSold(address indexed seller, uint256 candidateId, uint256 sharesSold, uint256 usdcReceived, uint256 newPrice)",
});
