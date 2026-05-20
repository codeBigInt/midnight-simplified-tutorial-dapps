import {
  CostModel,
  createConstructorContext,
  encodeRawTokenType,
  QueryContext,
  sampleContractAddress,
} from "@midnight-ntwrk/compact-runtime";
import type {
  CircuitContext,
  CircuitResults,
  ContractAddress,
} from "@midnight-ntwrk/compact-runtime";
import { nativeToken, sampleCoinPublicKey } from "@midnight-ntwrk/ledger-v8";

import { Contract, ledger } from "../managed/contract";
import type { Ledger } from "../managed/contract";
import {
  createVaultPrivateState as createWitnessPrivateState,
  witnesses,
} from "../witness";
import type { VaultPrivateState } from "../witness";
import { randomBytes } from "./utils";

export interface VaultSimulatorType {
  readonly contract: Contract<VaultPrivateState>;
  readonly contractAddress: ContractAddress;
  circuitContext: CircuitContext<VaultPrivateState>;
}

export const TEST_COIN_COLOR = encodeRawTokenType(nativeToken().raw);

export const createVaultPrivateState = (
  secretKey = randomBytes(32)
): VaultPrivateState => createWitnessPrivateState(secretKey);

export class VaultSimulator implements VaultSimulatorType {
  readonly contract: Contract<VaultPrivateState>;
  readonly contractAddress: ContractAddress;
  circuitContext: CircuitContext<VaultPrivateState>;

  constructor(privateState: VaultPrivateState) {
    this.contract = new Contract<VaultPrivateState>(witnesses);
    this.contractAddress = sampleContractAddress();

    const {
      currentContractState,
      currentPrivateState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext(privateState, sampleCoinPublicKey())
    );

    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      currentQueryContext: new QueryContext(
        currentContractState.data,
        this.contractAddress
      ),
      costModel: CostModel.initialCostModel(),
    };
  }

  static deployContract(
    privateState = createVaultPrivateState()
  ): VaultSimulator {
    return new VaultSimulator(privateState);
  }

  getLedgerState(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  getPrivateState(): VaultPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  updateStateAndGetLedger<T>(
    circuitResult: CircuitResults<VaultPrivateState, T>
  ): Ledger {
    this.circuitContext = circuitResult.context;
    return this.getLedgerState();
  }

  coin(amount: bigint, color = TEST_COIN_COLOR) {
    return {
      nonce: randomBytes(32),
      color,
      value: amount,
    };
  }

  deposit(amount: bigint, color = TEST_COIN_COLOR): Ledger {
    const circuitResult = this.contract.impureCircuits.deposit(
      this.circuitContext,
      this.coin(amount, color)
    );

    return this.updateStateAndGetLedger(circuitResult);
  }

  withdraw(amount: bigint): Ledger {
    const circuitResult = this.contract.impureCircuits.withdraw(
      this.circuitContext,
      amount
    );

    return this.updateStateAndGetLedger(circuitResult);
  }
}
