import { deployContract, DeployedContract, findDeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CoinInfo as ContractCoinInfo, Contract, createTweetPrivateState, ledger, TweetPrivateState, witnesses, Witnesses } from "./src";
import { MidnightProvider, MidnightProviders, WalletProvider, type UnbalancedTransaction,
  createBalancedTx,
  type BalancedTransaction,
  PrivateStateId } from "@midnight-ntwrk/midnight-js-types";
import { filter, firstValueFrom, map, pipe, tap, throttleTime } from "rxjs";
import { createInterface, Interface } from "node:readline/promises";
import { cwd, stdin as input, stdout as output } from "node:process";
import { CREATE_WALLET_CHOICE, DEPLOY_OR_JOIN_QUESTION } from "./userChoices";
import { WalletBuilder } from "@midnight-ntwrk/wallet";
import { nativeToken, Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import path from "node:path";
import fs from "node:fs";
import { fromHex } from "@midnight-ntwrk/midnight-js-utils";
import { decode, encode } from "node:punycode";
import { encodeTokenType } from "@midnight-ntwrk/compact-runtime";
import {levelPrivateStateProvider} from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import {getZswapNetworkId, setNetworkId, NetworkId, getLedgerNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {indexerPublicDataProvider} from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {httpClientProofProvider} from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import {NodeZkConfigProvider} from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {Transaction, type TransactionId, CoinInfo} from "@midnight-ntwrk/ledger";
setNetworkId(NetworkId.TestNet);

/** Type Definitions */
export type TweetPrivateStateId = typeof privateStateId;
export type TweetContract = Contract<TweetPrivateState, Witnesses<TweetPrivateState>>;
export type TokenCircuitKeys = Exclude<keyof TweetContract["impureCircuits"], number | symbol>;
export type TweetContractProviders = MidnightProviders<TokenCircuitKeys, TweetPrivateStateId, TweetPrivateState>;
export type TweetContractAPI = DeployedContract<TweetContract> | FoundContract<TweetContract>;
export type WalletConfig = {
    indexerUri: string,
    indexerWsUri: string,
    proverServerUri: string,
    substrateNodeUri: string,
}
export type WalletResourceType = Awaited<ReturnType<typeof WalletBuilder.build>>

export function coin(amount: number): ContractCoinInfo{
    return {
    nonce: getRandomBytes(32),
    value: BigInt(1_000_000),
    color: encodeTokenType(nativeToken())
}}

export const TweetContractInstance = new Contract<TweetPrivateState>(witnesses);
export const privateStateId = "tweet_ps";

export async function deployTweetContract(providers: TweetContractProviders): Promise<DeployedContract<TweetContract>> {
    console.log("===========================================================================================")
    console.log(`========================== DEPLOYING CONTRACT 🔃 ==========================================`)
    console.log("============================================================================================")
    const deplyedContract = deployContract<TweetContract>(providers, {
        contract: TweetContractInstance,
        initialPrivateState: await getPrivateState(providers),
        privateStateId
    })
    console.log("=============================================================================================")
    console.log(`========================== DEPLOYED CONTRACT ✅: ${(await deplyedContract).deployTxData.public.contractAddress} =============================`)
    console.log("=============================================================================================")

    return deplyedContract;
};

export async function joinTweetContract(providers: TweetContractProviders, contractAddress: string): Promise<FoundContract<TweetContract>> {
    console.log("==================================================================================================")
    console.log(`========================== JOINING CONTRACT 🔃 ==================================================`)
    console.log("===================================================================================================")

    const foundContract = findDeployedContract<TweetContract>(providers, {
        contract: TweetContractInstance,
        contractAddress,
        initialPrivateState: await getPrivateState(providers),
        privateStateId
    })

    console.log("=========================================================================================================")
    console.log(`========================== JOINED CONTRACT ✅ ============================================================`)
    console.log("==========================================================================================================")

    return foundContract;
}

export function getRandomBytes(length: number) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
};

export async function getPrivateState(providers: TweetContractProviders): Promise<TweetPrivateState> {
    const exisitingPrivateState = await providers.privateStateProvider.get(privateStateId);
    return exisitingPrivateState ?? createTweetPrivateState(getRandomBytes(32))
};

export async function getPublicLedgerState(providers: TweetContractProviders, contractAddress: string) {
    const ledgerState = await providers.publicDataProvider.queryContractState(contractAddress)
        .then((state) => state != null ? ledger(state.data) : null);

    console.log("==============================================================================")
    console.log(`======================================= CONTRACT STATE ✅ =======================`);
    console.log("==============================================================================")

    console.log("Onchain tweets incudes", ledgerState?.tweets)
    console.log("Onchain liker incudes", ledgerState?.likers)
    console.log("Engagement payment threshold", ledgerState?.likePaymentThreshold)
    console.log("SocialFi TVL locked", ledgerState?.TVL.value)

    console.log("==============================================================================")
    console.log(`======================================= END OF CONTRACT STATE 🔚 =======================`);
    console.log("==============================================================================")
}

export async function deployOrJoin(providers: TweetContractProviders, rli: Interface): Promise<TweetContractAPI> {
    const userChoice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (userChoice) {
        case "1": {
            return await deployTweetContract(providers);
        }
        case "2": {
            const contractAddress = await rli.question(`Enter tweet contract address to join: `);
            resumeAfterInvalidInput(contractAddress, rli, "No contract address provided");

            return await joinTweetContract(providers, contractAddress);
        }

        default: {
            rli.resume();
            throw Error("Invalid choice");
        }
    }
}


async function buildWalletAndWaitForFunds(walletConfig: WalletConfig, seed: string): Promise<WalletResourceType> {
    let wallet: WalletResourceType;
    const walletSerializationPath = path.resolve(cwd(), "wallet-sync-state.txt");
    let serializedState: string = "";
    if (fs.existsSync(walletSerializationPath)) {
        serializedState = fs.readFileSync(walletSerializationPath, "utf-8");
        wallet = await WalletBuilder.restore(
            walletConfig.indexerUri,
            walletConfig.indexerWsUri,
            walletConfig.proverServerUri,
            walletConfig.substrateNodeUri,
            seed,
            serializedState,
            "error",
            true
        )

        wallet.start();

    } else {
        wallet = await WalletBuilder.build(
            walletConfig.indexerUri,
            walletConfig.indexerWsUri,
            walletConfig.proverServerUri,
            walletConfig.substrateNodeUri,
            seed,
            getZswapNetworkId(),
            "error",
            true
        )

        wallet.start();
    }

    await waitForWalletToSync(wallet);
    await waitForFunds(wallet);

    const walletState = await firstValueFrom(wallet.state());
    const balance = walletState.availableCoins.find(coin => coin.type == nativeToken());
    console.log("====================================================================================================")
    console.log("========================= WALLET CONNECTED SUCCESSFULLY ✅ ========================================")
    console.log("====================================================================================================")

    console.log("Your wallet address is: ", walletState.address);
    console.log("Your wallet coin public key is: ", walletState.coinPublicKey);
    console.log(`Your wallet balance is: ${balance && balance?.value > 0n ? balance : 0n}`);

    return wallet;
}

async function waitForWalletToSync(wallet: WalletResourceType) {
    await firstValueFrom(
        wallet.state().pipe(
            throttleTime(5000),
            tap((state) => {
                const sourceGap = state.syncProgress?.lag.sourceGap;
                const applyGap = state.syncProgress?.lag.applyGap;
                console.log(`Waiting for wallet backend to sync. Source gap ${sourceGap} & apply gap is ${applyGap}`)
            }),
            filter((state) => {
                return state.syncProgress?.synced != undefined && state.syncProgress.synced;
            })
        )
    )
}

async function waitForFunds(wallet: WalletResourceType) {
    firstValueFrom(
        wallet.state().pipe(
            throttleTime(3000),
            tap((state) => {
                const sourceGap = state.syncProgress?.lag.sourceGap ?? 0n;
                const applyGap = state.syncProgress?.lag.applyGap ?? 0n;
                console.log(`Waiting for funds. Source gap ${sourceGap} & apply gap is ${applyGap}`)
            }),
            filter((state) => {
                return state.syncProgress?.synced == true;
            }),
            map((state) => {
                return state.balances[nativeToken()] ?? 0n
            }),
            filter((balance) => balance > 0n)
        )
    )
}

export async function buildWallet(config: WalletConfig, rli: Interface): Promise<WalletResourceType> {
    const userChoice = await rli.question(CREATE_WALLET_CHOICE);
    switch (userChoice) {
        case "1": {
            return await buildWalletAndWaitForFunds(config, uintArrayToStr(getRandomBytes(32)));
        }
        case "2": {
            const seed = await rli.question(`🌱Enter wallet seed: `);
            resumeAfterInvalidInput(seed, rli, "Invalid seed length provided")
            return await buildWalletAndWaitForFunds(config, seed);
        }

        default: {
            rli.resume();
            throw Error("Invalid choice");
        }
    }
}


export async function circuitMainLoop(providers: TweetContractProviders, rli: Interface) {
    const tweetAPI = await deployOrJoin(providers, rli);
    if (tweetAPI == undefined) {
        console.error("Failed to deploy or join contract");
        rli.resume();
    }

    const userChoice = await rli.question(CREATE_WALLET_CHOICE);
    switch (userChoice) {
        case "1": {
            const newTweetId = getRandomBytes(32);
            const tweet = await rli.question(`What's on your mind today?😊 `);
            resumeAfterInvalidInput(tweet, rli, "Invalid tweet length");
            console.log("=========================================================================");
            console.log(`==================== CREATING TWEET WITH ID: ${uintArrayToStr(newTweetId)}================`)
            console.log("=========================================================================");

            try {
                await tweetAPI.callTx.createTweet(newTweetId, tweet);
                console.log("=========================================================================");
                console.log(`==================== CREATED TWEET SUCCESSFULLY =========================`)
                console.log("=========================================================================");
            } catch (error) {
                console.error(error);
            }
            break;

        }
        case "2": {
            const tweetId = await rli.question(`Enter tweet ID? `);
            const updatedTweet = await rli.question(`Edit tweet message? `);

            resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
            console.log("=========================================================================");
            console.log(`==================== UPDATING TWEET WITH ID: ${tweetId} =================`)
            console.log("=========================================================================");

            try {
                await tweetAPI.callTx.updateTweet(strToUintArray(tweetId), updatedTweet);
                console.log("=========================================================================");
                console.log(`==================== UPDATED TWEET SUCCESSFULLY ✅ =========================`)
                console.log("=========================================================================");
            } catch (error) {
                console.error(error);
            }
            break;

        }

        case "3": {
            const tweetId = await rli.question(`Enter tweet ID? `);

            resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
            console.log("=========================================================================");
            console.log(`==================== DELETING TWEET WITH ID: ${tweetId} =================`)
            console.log("=========================================================================");

            try {
                await tweetAPI.callTx.deleteTweet(strToUintArray(tweetId)) ;
                console.log("=========================================================================");
                console.log(`==================== DELETED TWEET SUCCESSFULLY ✅ =========================`)
                console.log("=========================================================================");
            } catch (error) {
                console.error(error);
            }
            break;

        }

        case "4": {
            const tweetId = await rli.question(`Enter tweet ID? `);

            resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
            console.log("=========================================================================");
            console.log(`==================== WITHDRAWING TWEET EARNINGS WITH ID: ${tweetId} =================`)
            console.log("=========================================================================");

            try {
                await tweetAPI.callTx.withdrawTweetEarnings(strToUintArray(tweetId)) ;
                console.log("=========================================================================");
                console.log(`==================== WITHDREW TWEET EARNINGS SUCCESSFULLY ✅ =========================`)
                console.log("=========================================================================");
            } catch (error) {
                console.error(error);
            }
            break;

        }

        case "5": {
            const tweetId = await rli.question(`Enter tweet ID? `);

            resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
            console.log("=========================================================================");
            console.log(`==================== ENGAGING TWEET WITH ID (LIKE): ${tweetId} =================`)
            console.log("=========================================================================");

            try {
                await tweetAPI.callTx.likeTweet(strToUintArray(tweetId), coin(1)) ;
                console.log("=========================================================================");
                console.log(`==================== LIKED TWEET SUCCESSFULLY ✅ =====================`)
                console.log("=========================================================================");
            } catch (error) {
                console.error(error);
            }
            break;

        }

        case "6": {
            const tweetId = await rli.question(`Enter tweet ID? `);

            resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
            console.log("=========================================================================");
            console.log(`==================== ENGAGING TWEET WITH ID (UNLIKE): ${tweetId} =================`)
            console.log("=========================================================================");

            try {
                await tweetAPI.callTx.unlikeTweet(strToUintArray(tweetId)) ;
                console.log("=========================================================================");
                console.log(`==================== UNLIKE TWEET SUCCESSFULLY ✅ =====================`)
                console.log("=========================================================================");
            } catch (error) {
                console.error(error);
            }
            break;

        }

        case "7": {
            const tweetId = await rli.question(`Enter tweet ID? `);

            resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
            console.log("=========================================================================");
            console.log(`==================== PROMOTING TWEET WITH ID: ${tweetId} =================`)
            console.log("=========================================================================");

            try {
                await tweetAPI.callTx.promoteTweet(strToUintArray(tweetId), coin(5)) ;
                console.log("=========================================================================");
                console.log(`==================== PROMOTED TWEET SUCCESSFULLY ✅ =====================`)
                console.log("=========================================================================");
            } catch (error) {
                console.error(error);
            }
            break;
        }
        case "8": {
            await getPublicLedgerState(providers, tweetAPI.deployTxData.public.contractAddress);
            break;
        }
        case "9": {
            await getPrivateState(providers);
            break;
        }

        default: {
            rli.resume();
            throw Error("Invalid choice");
        }
    }
}

export function resumeAfterInvalidInput(str: string, rli: Interface, errMsg: string) {
    if (str == "") {
        console.error(errMsg);
        rli.resume();
    };
}

export function strToUintArray(str: string) {
        const encoder = new TextEncoder();
        const encodedStr = encoder.encode(str);
        return encodedStr;
}

export function uintArrayToStr(array: Uint8Array) {
        const decoder = new TextDecoder();
        const decodedStr = decoder.decode(array);
        return decodedStr;
}

export async function createWalletAndMinghtProvider(wallet: WalletResourceType): Promise<WalletProvider & MidnightProvider>{
    const walletState = await firstValueFrom(wallet.state());

    return {
        coinPublicKey: walletState.coinPublicKey,
        encryptionPublicKey: walletState.encryptionPublicKey,
        submitTx(tx: BalancedTransaction): Promise<TransactionId>{
            return wallet.submitTransaction(tx)
        },
        balanceTx(tx: UnbalancedTransaction, newCoins: CoinInfo[]): Promise<BalancedTransaction> {
            return wallet
        .balanceTransaction(
          ZswapTransaction.deserialize(tx.serialize(getLedgerNetworkId()), getZswapNetworkId()),
          newCoins,
        )
        .then((tx) => wallet.proveTransaction(tx))
        .then((zswapTx) => Transaction.deserialize(zswapTx.serialize(getZswapNetworkId()), getLedgerNetworkId()))
        .then(createBalancedTx);
        }
    }
}


async function runDapp(){
    const rli = createInterface({
        input,
        output,
        terminal: true
    });

    const zkConfigPath = path.resolve(cwd(), "managed", "tweet", "keys");

    const walletConfig: WalletConfig = {
        indexerUri:"https://indexer.testnet-02.midnight.network/api/v1/graphql",
        indexerWsUri: "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws",
        substrateNodeUri: "https://rpc.testnet-02.midnight.network",
        proverServerUri: "http://127.0.0.1:6300"

    };
    const wallet = await buildWallet(walletConfig, rli)

    const providers: TweetContractProviders = {
        privateStateProvider: levelPrivateStateProvider({
            privateStateStoreName: privateStateId
        }),
        publicDataProvider: indexerPublicDataProvider(
            walletConfig.indexerUri,
            walletConfig.indexerWsUri
        ),
        zkConfigProvider: new NodeZkConfigProvider<TokenCircuitKeys>(zkConfigPath),
        walletProvider: await createWalletAndMinghtProvider(wallet),
        midnightProvider: await createWalletAndMinghtProvider(wallet),
        proofProvider: httpClientProofProvider<TokenCircuitKeys>(walletConfig.proverServerUri)
    };

    await circuitMainLoop(providers, rli);

}


runDapp();