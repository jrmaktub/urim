import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export const MINERAL_FUTURES_PROGRAM_ID = new PublicKey("9zakGc9vksLmWz62R84BG9KNHP4xjNAPJ6L91eFhRxUq");
export const MINERAL_FUTURES_RPC = "https://api.devnet.solana.com";
export const MARKET_AUTHORITY = new PublicKey("A8BvVoby8b4fGtEL7waCV9FmNJCMjouDJbzcQGh31utL");
export const URIM_TOKEN_MINT = "F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump";

export const COMMODITIES = ["ANTIMONY", "LITHIUM", "COBALT", "COPPER"] as const;
export type CommodityName = typeof COMMODITIES[number];

export const MARKET_PDAS: Record<CommodityName, string> = {
  ANTIMONY: "4ue7sreFXsyH9RuUooPyDFTLHmCjo5bC673NSAKkWjCQ",
  LITHIUM: "7YVF8cxeRVVbMjvqqx72ELVVyHqnWJbVgYyPafSicCj4",
  COBALT: "3cHX4ujZQZJ6Q4b27kWgpijcqwuMJVQxp8xcQo7iEHGJ",
  COPPER: "EnEX2JyNa5AwmzPhw9m8wnm6PtM41Ap1NtNDXZTd29hZ",
};

export const COMMODITY_ICONS: Record<CommodityName, string> = {
  ANTIMONY: "⚗️",
  LITHIUM: "🔋",
  COBALT: "💎",
  COPPER: "🟤",
};

// Position account size: 8 (discriminator) + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 1 = 107
export const POSITION_ACCOUNT_SIZE = 107;

export function getMarketPDA(commodity: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(commodity)],
    MINERAL_FUTURES_PROGRAM_ID
  );
  return pda;
}

export function getPositionPDA(trader: PublicKey, market: PublicKey, nonce: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      trader.toBuffer(),
      market.toBuffer(),
      Buffer.from(new BN(nonce).toArray("le", 8)),
    ],
    MINERAL_FUTURES_PROGRAM_ID
  );
  return pda;
}

export function getVaultPDA(trader: PublicKey, market: PublicKey, nonce: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      trader.toBuffer(),
      market.toBuffer(),
      Buffer.from(new BN(nonce).toArray("le", 8)),
    ],
    MINERAL_FUTURES_PROGRAM_ID
  );
  return pda;
}
