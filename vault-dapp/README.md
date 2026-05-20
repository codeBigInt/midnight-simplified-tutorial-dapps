# Midnight Shielded Token Vault

A minimal Midnight Compact smart contract that demonstrates how to receive shielded tokens, accumulate deposits in a vault, and withdraw shielded funds back to the vault owner.

This project is contract-focused. It does not include a frontend.

## What It Demonstrates

- Compact structs and ledger maps
- Witness-based private state
- Commitment-based per-user vault identity
- Shielded deposits with `receiveShielded`
- Contract-held shielded balance management with `insertCoin`
- Deposit accumulation with `mergeCoinImmediate`
- Shielded withdrawals with `sendShielded`
- Owner commitment checks before withdrawal
- Local contract testing with Vitest

## Toolchain

The contract is pinned to Compact language version `0.23.0`:

```compact
pragma language_version 0.23.0;
```

The generated contract metadata currently targets:

- Compact compiler: `0.31.0`
- Compact language: `0.23.0`
- Compact runtime: `0.16.0`

## Project Structure

```txt
vault-dapp/
|-- package.json
|-- README.md
|-- src/
|   |-- vault.compact
|   |-- witness.ts
|   |-- managed/
|   `-- test/
|       |-- vault.test.ts
|       |-- vault-setup.ts
|       `-- utils.ts
`-- tsconfig.json
```

Key files:

- `src/vault.compact`: the Compact vault contract
- `src/witness.ts`: witness implementation for private state
- `src/test/vault-setup.ts`: local simulator helper
- `src/test/vault.test.ts`: contract behavior tests
- `src/managed/`: generated Compact TypeScript bindings and artifacts

## Install

```bash
bun install
```

## Compile

Fast compile without generating full ZK materials:

```bash
bun run test-compile
```

Full compile:

```bash
bun run compile
```

Both commands write generated artifacts to `src/managed`.

## Test

```bash
bun run test:run
```

The tests cover:

- empty deployment state
- vault creation on first valid deposit
- multiple deposits accumulating into one balance
- invalid coin color rejection
- partial withdrawal
- full withdrawal and stored balance removal
- withdrawal rejection with the wrong witness secret
- withdrawal rejection when a stolen secret is used from a different public key

## Contract Behavior

The first valid deposit creates a vault for the user. Later deposits from the same committed user identity must use the same coin color and are added to the existing vault balance.

Withdrawals check:

- the vault exists
- the vault has enough balance
- the current public key matches the stored owner commitment

The contract also updates the stored shielded coin balance after each deposit or withdrawal, including storing returned change or removing the balance entry after a full withdrawal.

## Privacy Note

This is a minimal tutorial contract, not a production privacy vault.

The underlying coin is shielded, and deposits/withdrawals use shielded token helpers. However, each `Vault.balance` is stored as a public `Uint<128>` in a public ledger map, and each vault stores its accepted `coinColor`.

That means per-user vault balances and asset colors are visible on-chain. A production design should usually keep per-user balances in private state and store only commitments on-chain.

## Related Docs

- Dev.to tutorial guide: https://github.com/codeBigInt/midnight-simplified-tutorial-dapps/tree/main/vault-dapp
- Midnight documentation: https://docs.midnight.network/
