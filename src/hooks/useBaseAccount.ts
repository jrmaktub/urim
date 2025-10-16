import { useState, useEffect } from "react";
import { provider, debugBaseAccount } from "@/lib/baseAccount";

export function useBaseAccount() {
  const [universalAddress, setUniversalAddress] = useState<string | null>(null);
  const [subAccountAddress, setSubAccountAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");

  useEffect(() => {
    const init = async () => {
      try {
        setStatus("connecting");
        const result = await debugBaseAccount();
        
        if (result) {
          setUniversalAddress(result.universal);
          setSubAccountAddress(result.sub);
          setStatus("connected");
        } else {
          setStatus("error");
        }
      } catch (err) {
        console.error("Base Account connection failed:", err);
        setStatus("error");
      }
    };

    init();
  }, []);

  return { universalAddress, subAccountAddress, status };
}
