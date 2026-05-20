import {WitnessContext} from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "./managed/contract";


export interface VaultPrivateState {
    secretKey: Uint8Array
}

export function createVaultPrivateState(secretKey: Uint8Array): VaultPrivateState{
    return {
        secretKey
    }
}


export const witnesses = {
    getSecretKey: (
        {privateState}: WitnessContext<Ledger, VaultPrivateState>
    ): [VaultPrivateState, Uint8Array] => {
        return [privateState, privateState.secretKey]
    }
}
