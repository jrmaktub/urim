import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyableErrorProps {
  message: string;
}

export const CopyableError = ({ message }: CopyableErrorProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm break-words max-w-[300px]">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="w-fit h-7 text-xs bg-background/20 border-border/50 hover:bg-background/40"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 mr-1" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-3 h-3 mr-1" />
            Copy Error
          </>
        )}
      </Button>
    </div>
  );
};

// Parse Solana/Anchor errors into user-friendly messages
export function parseSolanaError(error: unknown): { userMessage: string; fullError: string } {
  const fullError = error instanceof Error ? error.message : String(error);
  
  // Common Anchor/Solana errors
  if (fullError.includes("AccountNotInitialized") || fullError.includes("Error Number: 3012")) {
    return {
      userMessage: "Your wallet doesn't have a USDC token account on Devnet. Get devnet USDC first from a faucet.",
      fullError
    };
  }
  
  if (fullError.includes("InsufficientFunds") || fullError.includes("insufficient")) {
    return {
      userMessage: "Insufficient funds in your wallet. Make sure you have enough USDC and SOL for gas.",
      fullError
    };
  }
  
  if (fullError.includes("BettingClosed") || fullError.includes("6003")) {
    return {
      userMessage: "Betting is closed for this round. Wait for the next round to start.",
      fullError
    };
  }
  
  if (fullError.includes("BetTooSmall") || fullError.includes("6005")) {
    return {
      userMessage: "Minimum bet is $1.00 USD value.",
      fullError
    };
  }
  
  if (fullError.includes("RoundResolved") || fullError.includes("6001")) {
    return {
      userMessage: "This round has already been resolved.",
      fullError
    };
  }
  
  if (fullError.includes("CannotSwitchSides") || fullError.includes("6008")) {
    return {
      userMessage: "You cannot switch sides after placing a bet.",
      fullError
    };
  }
  
  if (fullError.includes("User rejected")) {
    return {
      userMessage: "Transaction was rejected by user.",
      fullError
    };
  }
  
  if (fullError.includes("Blockhash not found")) {
    return {
      userMessage: "Transaction expired. Please try again.",
      fullError
    };
  }

  return {
    userMessage: fullError.length > 100 ? fullError.slice(0, 100) + "..." : fullError,
    fullError
  };
}
