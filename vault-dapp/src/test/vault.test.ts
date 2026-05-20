import { describe, expect, it } from "vitest";
import { QueryContext } from "@midnight-ntwrk/compact-runtime";

import type { Vault } from "../managed/contract";
import {
  createVaultPrivateState,
  TEST_COIN_COLOR,
  VaultSimulator,
} from "./vault-setup";
import {
  convertLedgerMappingToArray,
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
  it("deploys with empty vault and balance ledgers", () => {
    const simulator = VaultSimulator.deployContract();
    const ledgerState = simulator.getLedgerState();

    expect(ledgerState.vaults.size()).toBe(0n);
    expect(ledgerState.balances.size()).toBe(0n);
    expect(simulator.getPrivateState().secretKey).toHaveLength(32);
  });

  it("creates a vault on the first valid deposit", () => {
    const simulator = VaultSimulator.deployContract();

    const ledgerState = simulator.deposit(100n);
    const vaults = convertLedgerMappingToArray<Vault>(ledgerState.vaults);
    const [vaultEntry] = vaults;

    if (!vaultEntry) {
      throw new Error("Expected one vault to exist");
    }

    expect(vaults).toHaveLength(1);
    expect(vaultEntry.item.balance).toBe(100n);
    expect(vaultEntry.item.coinColor).toEqual(TEST_COIN_COLOR);
    expect(vaultEntry.item.ownerHash).toHaveLength(32);
  });

  it("accumulates multiple deposits into the same vault", () => {
    const simulator = VaultSimulator.deployContract();

    simulator.deposit(100n);
    simulator.deposit(200n);

    const { item: vault } = getOnlyVault(simulator);
    const { item: balance } = getOnlyBalance(simulator);

    expect(vault.balance).toBe(300n);
    expect(balance.value).toBe(300n);
    expect(balance.color).toEqual(TEST_COIN_COLOR);
  });

  it("accepts deposits for the vault coin color and accumulates balances", () => {
    const simulator = VaultSimulator.deployContract();

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

    simulator.deposit(1_000n);

    expect(() => simulator.deposit(1_000n, randomBytes(32))).toThrow(
      "Invalid coin type deposited"
    );
  });

  it("withdraws from the vault balance", () => {
    const simulator = VaultSimulator.deployContract();

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

    simulator.deposit(1_000n);
    const ledgerState = simulator.withdraw(1_000n);
    const { item: vault } = getOnlyVault(simulator);

    expect(vault.balance).toBe(0n);
    expect(ledgerState.balances.size()).toBe(0n);
  });

  it("rejects withdrawal when the witness secret does not match an existing vault", () => {
    const simulator = VaultSimulator.deployContract();

    simulator.deposit(1_000n);
    simulator.circuitContext.currentPrivateState = {
      secretKey: randomBytes(32),
    };

    expect(() => simulator.withdraw(100n)).toThrow(
      "You have no vault position"
    );
  });

  it("rejects withdrawal when a stolen witness secret is used from a different public key", () => {
    const victimSecret = randomBytes(32);
    const victim = VaultSimulator.deployContract(
      createVaultPrivateState(victimSecret)
    );

    victim.deposit(1_000n);

    const attacker = VaultSimulator.deployContract(
      createVaultPrivateState(victimSecret)
    );
    attacker.circuitContext.currentQueryContext = new QueryContext(
      victim.circuitContext.currentQueryContext.state,
      victim.contractAddress
    );

    expect(() => attacker.withdraw(100n)).toThrow(
      "Unauthorized: You are not the owner"
    );
  });
});
