"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { getBaseProvider } from "@/lib/baseAccount";

export default function BetButton({ outcomeAddress }: { outcomeAddress: `0x${string}` }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleBet() {
    try {
      setLoading(true);
      setStatus("⏳ Sending 0.1 USDC…");

      const provider = getBaseProvider();

      // Base Sepolia USDC token
      const usdcAddress = "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557";

      // Get Sub Account (Base SDK defaultAccount: "sub")
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
        params: [],
      })) as string[];

      const from = (accounts.length > 1 ? accounts[1] : accounts[0]) as `0x${string}`;
      console.log("🟣 Sub Account used for TX:", from);

      // ERC20 transfer(to, amount)
      const recipient = outcomeAddress.slice(2).padStart(64, "0");
      const amount = parseUnits("0.1", 6).toString(16).padStart(64, "0");
      const data = `0xa9059cbb${recipient}${amount}`;

      // Send TX via Base SDK (auto-spend flow)
      const tx = await provider.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "2.0",
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from,
            calls: [{ to: usdcAddress, data, value: "0x0" }],
          },
        ],
      });

      console.log("✅ Transaction sent:", tx);
      setStatus("✅ Bet placed! Check Base Sepolia Explorer & Base Account dashboard.");
    } catch (error) {
      console.error("❌ Transaction failed:", error);
      setStatus("❌ Bet failed. See console for details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleBet}
      disabled={loading}
      className="px-6 py-3 rounded-xl border border-purple-400 text-purple-100 hover:bg-purple-600/20 disabled:opacity-50 transition-all"
    >
      {loading ? "Processing…" : "Bet"}
      {status && <p className="text-xs text-gray-400 mt-1">{status}</p>}
    </button>
  );
}
