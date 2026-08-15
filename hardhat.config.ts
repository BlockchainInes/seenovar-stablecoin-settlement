import "dotenv/config";

import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const etherscanApiKey = process.env.ETHERSCAN_API_KEY;

export default defineConfig({
  plugins: [
    hardhatToolboxMochaEthers,
  ],

  paths: {
    sources: "./contracts",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: sepoliaRpcUrl ?? "",
      accounts: privateKey
        ? [privateKey]
        : [],
    },
  },

  verify: {
    etherscan: {
      apiKey: etherscanApiKey ?? "",
    },
  },
});