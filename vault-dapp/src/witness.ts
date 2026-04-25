import {WitnessContext} from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "./managed/contract";


export interface VaultPrivateState {
    secreteKey: Uint8Array
}

export function createVaultPrivateState(secreteKey: Uint8Array): VaultPrivateState{
    return {
        secreteKey
    }
}


export const witnesses = {
    getSecretKey: (
        {privateState}: WitnessContext<Ledger, VaultPrivateState>
    ): [VaultPrivateState, Uint8Array] => {
        return [privateState, privateState.secreteKey]
    },

    getCurrentTime: (
        {privateState}: WitnessContext<Ledger, VaultPrivateState>
    ): [VaultPrivateState, bigint] => {
        return [privateState, BigInt(Date.now())]
    },
}