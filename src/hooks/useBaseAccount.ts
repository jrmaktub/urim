import { useState, useEffect } from "react";
import { provider, baseAccountSDK } from "@/lib/baseAccount";

export function useBaseAccount() {
  const [universalAddress, setUniversalAddress] = useState<string | null>(null);
  const [subAccountAddress, setSubAccountAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");

  useEffect(() => {
    const init = async () => {
      try {
        setStatus("connecting");
        const accounts = (await provider.request({
          method: "eth_requestAccounts",
          params: [],
        })) as string[];

        const universal = accounts[0];
        setUniversalAddress(universal);

        const result = (await provider.request({
          method: "wallet_getSubAccounts",
          params: [{ account: universal, domain: window.location.origin }],
        })) as { subAccounts: { address: string }[] };

        let sub = result?.subAccounts?.[0];
        if (!sub) {
          const created = (await provider.request({
            method: "wallet_addSubAccount",
            params: [{ account: { type: "create" } }],
          })) as { address: string };
          sub = { address: created.address };
        }
        setSubAccountAddress(sub.address);
        setStatus("connected");
        console.log("✅ Sub Account Connected:", sub.address);
      } catch (err) {
        console.error("Base Account connection failed:", err);
        setStatus("error");
      }
    };

    init();
  }, []);

  return { universalAddress, subAccountAddress, status };
}
