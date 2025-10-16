"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { getBaseProvider } from "@/lib/baseAccount";

const USDC = "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557"; // Base Sepolia USDC
const RECEIVER = "0x2177F513BA2a0746A22037Eb6626616e131eB69E"; // verified BetReceiver

export default function BetButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleBet = async () => {
    try {
      setLoading(true);
      setMsg("⏳ Sending 0.1 USDC to contract...");
      const provider = getBaseProvider();

      const accounts = (await provider.request({ method: "eth_requestAccounts", params: [] })) as string[];
      const from = (accounts.length > 1 ? accounts[1] : accounts[0]) as `0x${string}`;
      console.log("🟣 Sub Account:", from);

      // ABI selector for placeBet(address,uint256)
      const selector = "0x8b32d59c"; 
      const tokenParam = USDC.slice(2).padStart(64, "0");
      const amountParam = parseUnits("0.1", 6).toString(16).padStart(64, "0");
      const data = `${selector}${tokenParam}${amountParam}`;

      const tx = await provider.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "2.0",
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from,
            calls: [{ to: RECEIVER, data, value: "0x0" }],
          },
        ],
      });

      console.log("✅ TX sent:", tx);
      setMsg("✅ Bet placed! Check Basescan.");
    } catch (err) {
      console.error("❌ Bet failed:", err);
      setMsg("❌ Bet failed — check console.");
    } finally {
      setLoading(false);
    }
  };

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
