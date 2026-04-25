import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Vault } from "../managed/contract";
import {
  TEST_COIN_COLOR,
  TEST_CREATED_AT,
  VaultSimulator,
} from "./vault-setup";
import {
  convertLedgerMappingToArray,
  convertUint8ArraysToStrings,
  randomBytes,
} from "./utils";

const getOnlyVault = (simulator: VaultSimulator) => {
  const [vaultEntry] = convertLedgerMappingToArray<Vault>(
    simulator.getLedgerState().vaults
  );

  if (!vaultEntry) {
    throw new Error("Expected one vault to exist");
  }

  return vaultEntry;
};

const getOnlyBalance = (simulator: VaultSimulator) => {
  const [balanceEntry] = convertLedgerMappingToArray(
    simulator.getLedgerState().balances
  );

  if (!balanceEntry) {
    throw new Error("Expected one balance to exist");
  }

  return balanceEntry;
};

describe("Vault contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Number(TEST_CREATED_AT));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deploys with empty vault and balance ledgers", () => {
    const simulator = VaultSimulator.deployContract();
    const ledgerState = simulator.getLedgerState();

    expect(ledgerState.vaults.size()).toBe(0n);
    expect(ledgerState.balances.size()).toBe(0n);
    expect(simulator.getPrivateState().secreteKey).toHaveLength(32);
  });

  it("creates a vault for the current secret key", () => {
    const simulator = VaultSimulator.deployContract();

    const ledgerState = simulator.createVault();
    const vaults = convertLedgerMappingToArray<Vault>(ledgerState.vaults);
    const [vaultEntry] = vaults;

    if (!vaultEntry) {
      throw new Error("Expected one vault to exist");
    }

    expect(vaults).toHaveLength(1);
    expect(vaultEntry.item.balance).toBe(0n);
    expect(vaultEntry.item.createdAt).toBe(TEST_CREATED_AT);
    expect(vaultEntry.item.coinColor).toEqual(TEST_COIN_COLOR);
  });

  it("rejects deposits before the user creates a vault", () => {
    const simulator = VaultSimulator.deployContract();

    expect(() => simulator.deposit(1_000n)).toThrow(
      "You have no vault position"
    );
  });

  it("accepts deposits for the vault coin color and accumulates balances", () => {
    const simulator = VaultSimulator.deployContract();

    simulator.createVault();
    const firstDepositLedgerState = simulator.deposit(1_000n);
    const secondDepositLedgerState = simulator.deposit(500n);

    const { item: vault } = getOnlyVault(simulator);
    const { item: balance } = getOnlyBalance(simulator);

    expect(firstDepositLedgerState.balances.size()).toBe(1n);
    expect(secondDepositLedgerState.balances.size()).toBe(1n);
    expect(vault.balance).toBe(1_500n);
    expect(balance.value).toBe(1_500n);
    expect(balance.color).toEqual(TEST_COIN_COLOR);
  });

  it("rejects deposits with a different coin color", () => {
    const simulator = VaultSimulator.deployContract();

    simulator.createVault();

    expect(() => simulator.deposit(1_000n, randomBytes(32))).toThrow(
      "Invalid coin type deposited"
    );
  });

  it("withdraws from the vault balance", () => {
    const simulator = VaultSimulator.deployContract();

    simulator.createVault();
    simulator.deposit(1_000n);
    const ledgerState = simulator.withdraw(400n);
    const { item: vault } = getOnlyVault(simulator);
    const { item: balance } = getOnlyBalance(simulator);

    expect(vault.balance).toBe(600n);
    expect(balance.value).toBe(600n);
    expect(ledgerState.balances.size()).toBe(1n);
  });

  it("removes the stored coin balance on a full withdrawal", () => {
    const simulator = VaultSimulator.deployContract();

    simulator.createVault();
    simulator.deposit(1_000n);
    const ledgerState = simulator.withdraw(1_000n);
    const { item: vault } = getOnlyVault(simulator);

    expect(vault.balance).toBe(0n);
    expect(ledgerState.balances.size()).toBe(0n);
    expect(convertUint8ArraysToStrings(vault)).toMatchObject({
      balance: 0n,
      createdAt: TEST_CREATED_AT,
    });
  });
});
