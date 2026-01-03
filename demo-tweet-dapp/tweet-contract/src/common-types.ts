import { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { Contract, Witnesses } from "./managed/tweet/contract/index.js";
import { TweetPrivateState } from "./witness";
import { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import * as ledger from "@midnight-ntwrk/ledger-v6";
import { UnshieldedKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
/** Type Definitions */
export const privateStateId = "tweet_ps";
export type TweetPrivateStateId = typeof privateStateId;
export type TweetContract = Contract<TweetPrivateState, Witnesses<TweetPrivateState>>;
export type TokenCircuitKeys = Exclude<keyof TweetContract["impureCircuits"], number | symbol>;
export type TweetContractProviders = MidnightProviders<TokenCircuitKeys, TweetPrivateStateId, TweetPrivateState>;
export type TweetContractAPI = DeployedContract<TweetContract> | FoundContract<TweetContract>;


/** Wallet type definition based on preview testnet migration */
export type WalletConfig = {
    indexerUri: string,
    indexerWsUri: string,
    proverServerUri: string,
    substrateNodeUri: string,
    networkId: "preview" | "testnet" | "mainnet" | "undeployed"
}

export interface WalletContext {
    wallet: WalletFacade,
    dustSecreteKey: ledger.DustSecretKey,
    shieldedSecreteKey: ledger.ZswapSecretKeys,
    unshieldedKeyStore: UnshieldedKeystore
}

export interface WalletConfiguration {
    relayURL: URL;
    provingServerUrl: URL;
    indexerClientConnection: {
        indexerHttpUrl: string;
        indexerWsUrl: string
    },
    indexerUrl: string;
    costParameters: {
        additionalFeeOverhead: bigint; // 300 trillion - matches SDK examples
        feeBlocksMargin: number;
    },
    networkId: any;
}