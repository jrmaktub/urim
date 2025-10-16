"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { getBaseProvider } from "@/lib/baseAccount";

export default function BetButton({ outcomeAddress }: { outcomeAddress: `0x${string}` }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleBet() {
    try {
      setLoading(true);
      setMsg("⏳ Sending 0.1 USDC via Base Sub Account...");

      const provider = getBaseProvider();
      const usdc = "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557";

      // Fetch Sub Account (Base SDK defaultAccount: sub)
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
        params: [],
      })) as string[];

      const from = (accounts.length > 1 ? accounts[1] : accounts[0]) as `0x${string}`;
      console.log("🟣 Sub Account:", from);

      // Encode ERC20 transfer(to, amount)
      const recipient = outcomeAddress.slice(2).padStart(64, "0");
      const amount = parseUnits("0.1", 6).toString(16).padStart(64, "0");
      const data = `0xa9059cbb${recipient}${amount}`;

      // Send with Auto-Spend (wallet_sendCalls)
      const tx = await provider.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "2.0",
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from,
            calls: [{ to: usdc, data, value: "0x0" }],
          },
        ],
      });

      console.log("✅ Transaction sent:", tx);
      setMsg("✅ Bet confirmed! Check Base Sepolia explorer.");
    } catch (err) {
      console.error("❌ Transaction failed:", err);
      setMsg("❌ Transaction failed. Check console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleBet}
      disabled={loading}
      className="px-6 py-3 rounded-xl border border-purple-400 text-purple-100 hover:bg-purple-600/20 disabled:opacity-50"
    >
      {loading ? "Processing…" : "Bet"}
      {msg && <p className="text-xs text-gray-400 mt-1">{msg}</p>}
    </button>
  );
}
