import hre, { network } from "hardhat";
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";



async function main() {
  // Connect to your configured network (example: baseSepolia, hardhatOp, etc.)
  const { ethers } = await network.connect({
    network: "baseSepolia", // or "baseSepolia" if that’s your target
    chainType: "op",      // OP-style chain
  });
  const pythContractAddress = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729"
  const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" // Base-Sepolia USDC contract address
  console.log("Deploying contracts using the OP chain type...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", balance.toString());

  // === Deploy contracts sequentially ===
  console.log("\n--- Deploying UrimMarket ---");
  const UrimMarket = await ethers.getContractFactory("UrimMarket"); // replace with actual name
  const urimMarket = await UrimMarket.deploy(USDC, pythContractAddress); 
  await urimMarket.waitForDeployment();
  console.log("UrimMarket deployed to:", await urimMarket.getAddress());

  console.log("\n--- Deploying UrimQuantumMarket  ---");
  const UrimQuantumMarket = await ethers.getContractFactory("UrimQuantumMarket"); // replace with actual name
  const urimQuantumMarket = await UrimQuantumMarket.deploy(USDC, pythContractAddress); 
  await urimQuantumMarket.waitForDeployment();
  console.log("UrimQuantumMarket deployed to:", await urimQuantumMarket.getAddress());

  console.log("\n✅ All contracts deployed successfully!");


  // Verification part:

    try {
    console.log("Verifying UrimMarket...");
    await verifyContract({
      address: await urimMarket.getAddress(),
      constructorArgs: [USDC, pythContractAddress],
      provider: "etherscan",
      
    }, hre);
    console.log("✅ UrimMarket verified successfully!");
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("✅ UrimMarket is already verified!");
    } else {
      console.error("🔥 UrimMarket verification failed:", error);
    }
  }


    try {
    console.log("Verifying UrimQuantumMarket...");
    await verifyContract({
      address: await urimQuantumMarket.getAddress(),
      constructorArgs: [USDC, pythContractAddress],
      provider: "etherscan",
      
    }, hre);
    console.log("✅ UrimQuantumMarket verified successfully!");
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("✅ UrimQuantumMarket is already verified!");
    } else {
      console.error("🔥 UrimQuantumMarket verification failed:", error);
    }
  }

}

// Run the deployer
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
