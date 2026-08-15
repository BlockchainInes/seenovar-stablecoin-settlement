// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SeenovarSettlementRegistry {
    enum SettlementStatus {
        None,
        Registered,
        Reconciled
    }

    struct SettlementRecord {
        bytes32 settlementIdHash;
        bytes32 transactionHash;
        uint256 chainId;
        uint256 amountMinorUnits;
        address asset;
        address senderWallet;
        address recipientWallet;
        SettlementStatus status;
        uint256 registeredAt;
        uint256 reconciledAt;
    }

    address public immutable owner;

    mapping(bytes32 => SettlementRecord) private settlements;

    event SettlementRegistered(
        bytes32 indexed settlementIdHash,
        bytes32 indexed transactionHash,
        uint256 indexed chainId,
        address asset,
        address senderWallet,
        address recipientWallet,
        uint256 amountMinorUnits
    );

    event SettlementReconciled(
        bytes32 indexed settlementIdHash,
        uint256 reconciledAt
    );

    error Unauthorized();
    error InvalidSettlementId();
    error InvalidTransactionHash();
    error InvalidChainId();
    error InvalidAmount();
    error InvalidAsset();
    error InvalidSender();
    error InvalidRecipient();
    error SettlementAlreadyExists(bytes32 settlementIdHash);
    error SettlementNotFound(bytes32 settlementIdHash);
    error SettlementAlreadyReconciled(bytes32 settlementIdHash);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }

        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerSettlement(
        bytes32 settlementIdHash,
        bytes32 transactionHash,
        uint256 chainId,
        uint256 amountMinorUnits,
        address asset,
        address senderWallet,
        address recipientWallet
    ) external onlyOwner {
        if (settlementIdHash == bytes32(0)) {
            revert InvalidSettlementId();
        }

        if (transactionHash == bytes32(0)) {
            revert InvalidTransactionHash();
        }

        if (chainId == 0) {
            revert InvalidChainId();
        }

        if (amountMinorUnits == 0) {
            revert InvalidAmount();
        }

        if (asset == address(0)) {
            revert InvalidAsset();
        }

        if (senderWallet == address(0)) {
            revert InvalidSender();
        }

        if (recipientWallet == address(0)) {
            revert InvalidRecipient();
        }

        if (settlements[settlementIdHash].status != SettlementStatus.None) {
            revert SettlementAlreadyExists(settlementIdHash);
        }

        settlements[settlementIdHash] = SettlementRecord({
            settlementIdHash: settlementIdHash,
            transactionHash: transactionHash,
            chainId: chainId,
            amountMinorUnits: amountMinorUnits,
            asset: asset,
            senderWallet: senderWallet,
            recipientWallet: recipientWallet,
            status: SettlementStatus.Registered,
            registeredAt: block.timestamp,
            reconciledAt: 0
        });

        emit SettlementRegistered(
            settlementIdHash,
            transactionHash,
            chainId,
            asset,
            senderWallet,
            recipientWallet,
            amountMinorUnits
        );
    }

    function markReconciled(
        bytes32 settlementIdHash
    ) external onlyOwner {
        SettlementRecord storage settlement =
            settlements[settlementIdHash];

        if (settlement.status == SettlementStatus.None) {
            revert SettlementNotFound(settlementIdHash);
        }

        if (settlement.status == SettlementStatus.Reconciled) {
            revert SettlementAlreadyReconciled(settlementIdHash);
        }

        settlement.status = SettlementStatus.Reconciled;
        settlement.reconciledAt = block.timestamp;

        emit SettlementReconciled(
            settlementIdHash,
            block.timestamp
        );
    }

    function getSettlement(
        bytes32 settlementIdHash
    ) external view returns (SettlementRecord memory) {
        SettlementRecord memory settlement =
            settlements[settlementIdHash];

        if (settlement.status == SettlementStatus.None) {
            revert SettlementNotFound(settlementIdHash);
        }

        return settlement;
    }

    function exists(
        bytes32 settlementIdHash
    ) external view returns (bool) {
        return (
            settlements[settlementIdHash].status
                != SettlementStatus.None
        );
    }

    function isReconciled(
        bytes32 settlementIdHash
    ) external view returns (bool) {
        return (
            settlements[settlementIdHash].status
                == SettlementStatus.Reconciled
        );
    }
}