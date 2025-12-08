import { Ledger } from "./managed/tweet/contract/index.cjs";
import { MerkleTreePath, WitnessContext } from "@midnight-ntwrk/compact-runtime";

export interface TweetPrivateState {
    secreteKey: Uint8Array;
}

export function createTweetPrivateState(secreteKey: Uint8Array): TweetPrivateState {
    return {
        secreteKey
    };
}

export const witnesses = {
    getCurrentTime: ({ privateState }: WitnessContext<Ledger, TweetPrivateState>): [TweetPrivateState, bigint] => {
        return [privateState, BigInt(Date.now())]
    },
    findLiker: ({ privateState, ledger }: WitnessContext<Ledger, TweetPrivateState>, commitHash: Uint8Array): [TweetPrivateState, MerkleTreePath<Uint8Array>] => {
        return [privateState, ledger.likers.findPathForLeaf(commitHash)!]
    },
    getSecretKey: ({privateState}:WitnessContext<Ledger, TweetPrivateState>): [TweetPrivateState, Uint8Array] => {
        return [privateState, privateState.secreteKey]
    }
};