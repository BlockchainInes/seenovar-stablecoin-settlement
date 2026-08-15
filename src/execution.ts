export type ExecutionStatus =
  | "SUBMITTED"
  | "CONFIRMED"
  | "FAILED";

export interface StablecoinTransferRequest {
  settlementId: string;
  chainId: number;
  tokenAddress: string;
  senderWallet: string;
  recipientWallet: string;
  amount: string;
  assetSymbol: string;
}

export interface StablecoinTransferResult {
  settlementId: string;
  transactionHash: string;
  chainId: number;
  status: ExecutionStatus;
  submittedAt: string;
  confirmedAt?: string;
  failureReason?: string;
}

export interface StablecoinExecutor {
  execute(
    request: StablecoinTransferRequest,
  ): Promise<StablecoinTransferResult>;
}

export class SimulatedEvmExecutor implements StablecoinExecutor {
  async execute(
    request: StablecoinTransferRequest,
  ): Promise<StablecoinTransferResult> {
    this.validateRequest(request);

    const transactionHash = this.createTransactionHash(
      request.settlementId,
    );

    return {
      settlementId: request.settlementId,
      transactionHash,
      chainId: request.chainId,
      status: "CONFIRMED",
      submittedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    };
  }

  private validateRequest(
    request: StablecoinTransferRequest,
  ): void {
    if (request.assetSymbol !== "USDC") {
      throw new Error(
        `Unsupported stablecoin: ${request.assetSymbol}`,
      );
    }

    if (request.chainId <= 0) {
      throw new Error("Invalid chain ID");
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(request.tokenAddress)) {
      throw new Error("Invalid token address");
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(request.senderWallet)) {
      throw new Error("Invalid sender wallet");
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(request.recipientWallet)) {
      throw new Error("Invalid recipient wallet");
    }

    if (!/^[0-9]+(\.[0-9]{1,6})?$/.test(request.amount)) {
      throw new Error("Invalid transfer amount");
    }

    if (Number(request.amount) <= 0) {
      throw new Error("Transfer amount must be greater than zero");
    }
  }

  private createTransactionHash(
    settlementId: string,
  ): string {
    const encoded = Buffer.from(settlementId)
      .toString("hex")
      .padEnd(64, "0")
      .slice(0, 64);

    return `0x${encoded}`;
  }
}