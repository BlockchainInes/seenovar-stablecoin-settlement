import { network } from "hardhat";

const { ethers, networkName } = await network.create();

console.log(
  `Deploying SeenovarSettlementRegistry to ${networkName}...`,
);

const registry = await ethers.deployContract(
  "SeenovarSettlementRegistry",
);

console.log(
  "Waiting for deployment confirmation...",
);

await registry.waitForDeployment();

const address = await registry.getAddress();

console.log(
  "SeenovarSettlementRegistry deployed at:",
  address,
);