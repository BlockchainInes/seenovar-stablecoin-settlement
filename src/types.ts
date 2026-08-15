export type SettlementStatus =
  | "CREATED"
  | "COMPLIANCE_PENDING"
  | "APPROVED"
  | "SUBMITTED"
  | "CONFIRMED"
  | "RECONCILED"
  | "FAILED";

export interface SettlementParty {
  walletAddress: string;
  legalName: string;
  jurisdiction: string;
}

export interface StablecoinAsset {
  symbol: "USDC";
  decimals: 6;
  chainId: number;
  contractAddress: string;
}

export interface SettlementInstruction {
  id: string;
  idempotencyKey: string;
  sender: SettlementParty;
  recipient: SettlementParty;
  asset: StablecoinAsset;
  amount: string;
  status: SettlementStatus;
  transactionHash?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}