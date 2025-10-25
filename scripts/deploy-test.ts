import hre, { network } from "hardhat";
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

interface DeployedContracts {
  network: string;
  chainId: number;
  timestamp: string;
  contracts: {
    [key: string]: {
      address: string;
      constructorArgs: any[];
    };
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function saveDeployedAddresses(deployedData: DeployedContracts) {
  const deployedDir = path.join(__dirname, "..", "deployed");
  const filePath = path.join(deployedDir, "deployedAddresses.json");

  // Create 'deployed' directory if it doesn't exist
  if (!fs.existsSync(deployedDir)) {
    fs.mkdirSync(deployedDir, { recursive: true });
  }

  // Read existing data if file exists
  let allDeployments: { [network: string]: DeployedContracts } = {};
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, "utf8");
    allDeployments = JSON.parse(fileContent);
  }

  // Add or update the current network deployment
  allDeployments[deployedData.network] = deployedData;

  // Write back to file
  fs.writeFileSync(filePath, JSON.stringify(allDeployments, null, 2));
  console.log(`\n📝 Deployment addresses saved to: ${filePath}`);
}

async function main() {
  // Connect to your configured network (example: baseSepolia, hardhatOp, etc.)
  const { ethers } = await network.connect({
    network: "baseSepolia", // or "baseSepolia" if that's your target
    chainType: "op", // OP-style chain
  });

  const pythContractAddress = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";
  const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base-Sepolia USDC contract address

  console.log("Deploying contracts using the OP chain type...");

  const ETH_USD_BASE_SEPOLIA_ID =
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", balance.toString());

  // Get network info from the provider
  const providerNetwork = await ethers.provider.getNetwork();
  const networkName = providerNetwork.name || "unknown";
  const chainId = providerNetwork.chainId;

  // Prepare deployment data structure
  const deployedData: DeployedContracts = {
    network: networkName,
    chainId: Number(chainId),
    timestamp: new Date().toISOString(),
    contracts: {},
  };

  // === Deploy contracts sequentially ===
  console.log("\n--- Deploying PythUrimQuantumMarket ---");
  const UrimMarket = await ethers.getContractFactory("PythUrimQuantumMarket");
  const urimMarket = await UrimMarket.deploy(USDC, pythContractAddress);
  await urimMarket.waitForDeployment();
  const urimMarketAddress = await urimMarket.getAddress();
  console.log("UrimMarket deployed to:", urimMarketAddress);

  // Save UrimMarket deployment info
  deployedData.contracts["PythUrimQuantumMarket"] = {
    address: urimMarketAddress,
    constructorArgs: [USDC, pythContractAddress],
  };

  console.log("\n--- Deploying UrimQuantumMarket ---");
  const UrimQuantumMarket = await ethers.getContractFactory("UrimQuantumMarket");
  const urimQuantumMarket = await UrimQuantumMarket.deploy(USDC, pythContractAddress);
  await urimQuantumMarket.waitForDeployment();
  const urimQuantumMarketAddress = await urimQuantumMarket.getAddress();
  console.log("UrimQuantumMarket deployed to:", urimQuantumMarketAddress);

  // Save UrimQuantumMarket deployment info
  deployedData.contracts["UrimQuantumMarket"] = {
    address: urimQuantumMarketAddress,
    constructorArgs: [USDC, pythContractAddress],
  };

  console.log("\n✅ All contracts deployed successfully!");

  // Save deployment addresses to JSON file
  await saveDeployedAddresses(deployedData);

  // Verification part:
  try {
    console.log("\nVerifying PythUrimQuantumMarket...");
    await verifyContract(
      {
        address: urimMarketAddress,
        constructorArgs: [USDC, pythContractAddress],
        provider: "etherscan",
      },
      hre
    );
    console.log("✅ PythUrimQuantumMarket verified successfully!");
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("✅ PythUrimQuantumMarket is already verified!");
    } else {
      console.error("🔥 PythUrimQuantumMarket verification failed:", error);
    }
  }

  try {
    console.log("\nVerifying UrimQuantumMarket...");
    await verifyContract(
      {
        address: urimQuantumMarketAddress,
        constructorArgs: [USDC, pythContractAddress],
        provider: "etherscan",
      },
      hre
    );
    console.log("✅ UrimQuantumMarket verified successfully!");
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("✅ UrimQuantumMarket is already verified!");
    } else {
      console.error("🔥 UrimQuantumMarket verification failed:", error);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log("\nDeployed Contracts:");
  for (const [name, data] of Object.entries(deployedData.contracts)) {
    console.log(`  ${name}: ${data.address}`);
  }
  console.log("=".repeat(60));
}

// Run the deployer
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});