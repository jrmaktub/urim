// src/components/ExplorerLink.tsx

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getExplorerTxUrl } from "@/constants/blockscout";

interface ExplorerLinkProps {
  txHash?: string;
  address?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExplorerLink({ 
  txHash, 
  address, 
  label = "View on Explorer",
  variant = "outline",
  size = "sm"
}: ExplorerLinkProps) {
  const url = txHash 
    ? getExplorerTxUrl(txHash)
    : address 
    ? getExplorerAddressUrl(address) 
    : null;

  if (!url) return null;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => window.open(url, '_blank')}
    >
      <ExternalLink className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}

// Also export the import we need
import { getExplorerAddressUrl } from "@/constants/blockscout";

export default ExplorerLink;