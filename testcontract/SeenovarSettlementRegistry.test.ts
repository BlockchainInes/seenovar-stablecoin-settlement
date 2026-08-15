import { expect } from "chai";
import hre from "hardhat";

const { ethers } = await hre.network.create();

describe("SeenovarSettlementRegistry", function () {
  async function deployRegistry() {
    const registry = await ethers.deployContract(
      "SeenovarSettlementRegistry",
    );

    await registry.waitForDeployment();

    const [owner, otherAccount] =
      await ethers.getSigners();

    return {
      registry,
      owner,
      otherAccount,
    };
  }

  function createSettlementData() {
    return {
      settlementIdHash: ethers.keccak256(
        ethers.toUtf8Bytes(
          "seenovar-settlement-001",
        ),
      ),
      transactionHash: ethers.keccak256(
        ethers.toUtf8Bytes(
          "seenovar-transaction-001",
        ),
      ),
      chainId: 11155111n,
      amountMinorUnits: 100000000000n,
      asset:
        "0x1111111111111111111111111111111111111111",
      senderWallet:
        "0x2222222222222222222222222222222222222222",
      recipientWallet:
        "0x3333333333333333333333333333333333333333",
    };
  }

  it("sets the deployer as owner", async function () {
    const {
      registry,
      owner,
    } = await deployRegistry();

    expect(
      await registry.owner(),
    ).to.equal(owner.address);
  });

  it("registers a settlement", async function () {
    const { registry } =
      await deployRegistry();

    const data =
      createSettlementData();

    await expect(
      registry.registerSettlement(
        data.settlementIdHash,
        data.transactionHash,
        data.chainId,
        data.amountMinorUnits,
        data.asset,
        data.senderWallet,
        data.recipientWallet,
      ),
    )
      .to.emit(
        registry,
        "SettlementRegistered",
      )
      .withArgs(
        data.settlementIdHash,
        data.transactionHash,
        data.chainId,
        data.asset,
        data.senderWallet,
        data.recipientWallet,
        data.amountMinorUnits,
      );

    expect(
      await registry.exists(
        data.settlementIdHash,
      ),
    ).to.equal(true);

    const settlement =
      await registry.getSettlement(
        data.settlementIdHash,
      );

    expect(
      settlement.settlementIdHash,
    ).to.equal(
      data.settlementIdHash,
    );

    expect(
      settlement.transactionHash,
    ).to.equal(
      data.transactionHash,
    );

    expect(
      settlement.chainId,
    ).to.equal(
      data.chainId,
    );

    expect(
      settlement.amountMinorUnits,
    ).to.equal(
      data.amountMinorUnits,
    );

    expect(
      settlement.asset,
    ).to.equal(
      data.asset,
    );

    expect(
      settlement.senderWallet,
    ).to.equal(
      data.senderWallet,
    );

    expect(
      settlement.recipientWallet,
    ).to.equal(
      data.recipientWallet,
    );

    expect(
      settlement.status,
    ).to.equal(1n);
  });

  it("marks a settlement as reconciled", async function () {
    const { registry } =
      await deployRegistry();

    const data =
      createSettlementData();

    await registry.registerSettlement(
      data.settlementIdHash,
      data.transactionHash,
      data.chainId,
      data.amountMinorUnits,
      data.asset,
      data.senderWallet,
      data.recipientWallet,
    );

    await expect(
      registry.markReconciled(
        data.settlementIdHash,
      ),
    ).to.emit(
      registry,
      "SettlementReconciled",
    );

    expect(
      await registry.isReconciled(
        data.settlementIdHash,
      ),
    ).to.equal(true);

    const settlement =
      await registry.getSettlement(
        data.settlementIdHash,
      );

    expect(
      settlement.status,
    ).to.equal(2n);

    expect(
      settlement.reconciledAt,
    ).to.be.greaterThan(0n);
  });

  it("rejects registration from a non-owner", async function () {
    const {
      registry,
      otherAccount,
    } = await deployRegistry();

    const data =
      createSettlementData();

    await expect(
      registry
        .connect(otherAccount)
        .registerSettlement(
          data.settlementIdHash,
          data.transactionHash,
          data.chainId,
          data.amountMinorUnits,
          data.asset,
          data.senderWallet,
          data.recipientWallet,
        ),
    ).to.be.revertedWithCustomError(
      registry,
      "Unauthorized",
    );
  });

  it("rejects duplicate settlements", async function () {
    const { registry } =
      await deployRegistry();

    const data =
      createSettlementData();

    await registry.registerSettlement(
      data.settlementIdHash,
      data.transactionHash,
      data.chainId,
      data.amountMinorUnits,
      data.asset,
      data.senderWallet,
      data.recipientWallet,
    );

    await expect(
      registry.registerSettlement(
        data.settlementIdHash,
        data.transactionHash,
        data.chainId,
        data.amountMinorUnits,
        data.asset,
        data.senderWallet,
        data.recipientWallet,
      ),
    )
      .to.be.revertedWithCustomError(
        registry,
        "SettlementAlreadyExists",
      )
      .withArgs(
        data.settlementIdHash,
      );
  });

  it("rejects an invalid settlement id", async function () {
    const { registry } =
      await deployRegistry();

    const data =
      createSettlementData();

    await expect(
      registry.registerSettlement(
        ethers.ZeroHash,
        data.transactionHash,
        data.chainId,
        data.amountMinorUnits,
        data.asset,
        data.senderWallet,
        data.recipientWallet,
      ),
    ).to.be.revertedWithCustomError(
      registry,
      "InvalidSettlementId",
    );
  });

  it("rejects reconciliation of an unknown settlement", async function () {
    const { registry } =
      await deployRegistry();

    const unknownSettlement =
      ethers.keccak256(
        ethers.toUtf8Bytes(
          "unknown-settlement",
        ),
      );

    await expect(
      registry.markReconciled(
        unknownSettlement,
      ),
    )
      .to.be.revertedWithCustomError(
        registry,
        "SettlementNotFound",
      )
      .withArgs(
        unknownSettlement,
      );
  });

  it("rejects double reconciliation", async function () {
    const { registry } =
      await deployRegistry();

    const data =
      createSettlementData();

    await registry.registerSettlement(
      data.settlementIdHash,
      data.transactionHash,
      data.chainId,
      data.amountMinorUnits,
      data.asset,
      data.senderWallet,
      data.recipientWallet,
    );

    await registry.markReconciled(
      data.settlementIdHash,
    );

    await expect(
      registry.markReconciled(
        data.settlementIdHash,
      ),
    )
      .to.be.revertedWithCustomError(
        registry,
        "SettlementAlreadyReconciled",
      )
      .withArgs(
        data.settlementIdHash,
      );
  });
});