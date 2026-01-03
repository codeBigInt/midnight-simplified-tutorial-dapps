import { deployContract, DeployedContract, findDeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import { ShieldedCoinInfo as ContractCoinInfo, Contract, ledger, Witnesses } from "./managed/tweet/contract/index.js";
import { createTweetPrivateState, TokenCircuitKeys, TweetContract, TweetContractAPI, TweetContractProviders, TweetPrivateState, WalletConfig, WalletContext, witnesses } from "./index.js"
import {
    MidnightProvider, WalletProvider, type BalancedProvingRecipe
} from "@midnight-ntwrk/midnight-js-types";
import { createInterface, Interface } from "node:readline/promises";
import { cwd, stdin as input, stdout as output } from "node:process";
import { CIRCUIT_INTERACTION_QUESTION, DEPLOY_OR_JOIN_QUESTION } from "./userChoices.js";
import { WalletBuilder } from "@midnight-ntwrk/wallet";
import { nativeToken, Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import path from "node:path";
import { encodeRawTokenType } from "@midnight-ntwrk/compact-runtime";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-utils";
import { 
    CoinPublicKey, EncPublicKey, 
    type UnprovenTransaction, type FinalizedTransaction, 
    type TransactionId, type ShieldedCoinInfo, 
    Transaction, SignatureEnabled, 
    Proofish, Bindingish,
} from "@midnight-ntwrk/ledger-v6";
import { buildWallet } from "./wallet-utils.js";

setNetworkId("preview");

export type WalletResourceType = Awaited<ReturnType<typeof WalletBuilder.build>>

export function coin(amount: number): ContractCoinInfo {
    return {
        nonce: getRandomBytes(32),
        value: BigInt(amount * 1_000_000),
        color: encodeRawTokenType(nativeToken())
    }
}

export const TweetContractInstance = new Contract<TweetPrivateState>(witnesses);
export const privateStateId = "tweet_ps";

export async function deployTweetContract(providers: TweetContractProviders): Promise<DeployedContract<TweetContract>> {
    console.log("===========================================================================================")
    console.log(`========================== DEPLOYING CONTRACT 🔃 ==========================================`)
    console.log("============================================================================================")
    const deplyedContract = await deployContract<TweetContract>(providers, {
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

    const foundContract = await findDeployedContract<TweetContract>(providers, {
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
    console.log("==============================================================================")
    console.log(`======================================= PRIVATE STATE ✅ =======================`);
    console.log("==============================================================================")
    const exisitingPrivateState = await providers.privateStateProvider.get(privateStateId);
    console.log(`Your current private state:`, exisitingPrivateState)
    return exisitingPrivateState ?? createTweetPrivateState(getRandomBytes(32))
};

export async function getPublicLedgerState(providers: TweetContractProviders, contractAddress: string) {
    const ledgerState = await providers.publicDataProvider.queryContractState(contractAddress)
        .then((state) => state != null ? ledger(state.data) : null);
    if (ledgerState == null) {
        console.error("Contract state is undefined. Failed to fetch. Please try again");
        return;
    };
    console.log("==============================================================================")
    console.log(`======================================= CONTRACT STATE ✅ =======================`);
    console.log("==============================================================================")

    console.log("Onchain tweets incudes", Array.from(ledgerState.tweets).map(([key, tweet]) => ({
        id: toHex(key),
        tweet
    })))
    console.log("Tweet count: ", ledgerState.tweets.size())
    console.log("Onchain liker incudes", ledgerState.likers)
    console.log("Engagement payment threshold", ledgerState.likePaymentThreshold)
    console.log("SocialFi TVL locked", ledgerState.TVL.value)

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

export async function circuitMainLoop(providers: TweetContractProviders, rli: Interface) {
    const tweetAPI = await deployOrJoin(providers, rli);
    if (!tweetAPI) {
        console.error("Failed to deploy or join contract");
        rli.resume();
    }

    try {
        while (true) {
            const userChoice = await rli.question(CIRCUIT_INTERACTION_QUESTION);
            switch (userChoice) {
                case "1": {
                    const newTweetId = getRandomBytes(32);
                    const tweet = await rli.question(`What's on your mind today?😊 `);
                    resumeAfterInvalidInput(tweet, rli, "Invalid tweet length");
                    console.log("=========================================================================");
                    console.log(`==================== CREATING TWEET WITH ID: ${toHex(newTweetId)}================`)
                    console.log("=========================================================================");


                    await tweetAPI.callTx.createTweet(newTweetId, tweet);
                    console.log("=========================================================================");
                    console.log(`==================== CREATED TWEET SUCCESSFULLY ✅ =========================`)
                    console.log("=========================================================================");
                    break;

                }
                case "2": {
                    const tweetId = await rli.question(`Enter tweet ID? `);
                    const updatedTweet = await rli.question(`Edit tweet message? `);

                    resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
                    console.log("=========================================================================");
                    console.log(`==================== UPDATING TWEET WITH ID: ${tweetId} =================`)
                    console.log("=========================================================================");


                    await tweetAPI.callTx.updateTweet(fromHex(tweetId), updatedTweet);
                    console.log("=========================================================================");
                    console.log(`==================== UPDATED TWEET SUCCESSFULLY ✅ =========================`)
                    console.log("=========================================================================");
                    break;

                }

                case "3": {
                    const tweetId = await rli.question(`Enter tweet ID? `);

                    resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
                    console.log("=========================================================================");
                    console.log(`==================== DELETING TWEET WITH ID: ${tweetId} =================`)
                    console.log("=========================================================================");


                    await tweetAPI.callTx.deleteTweet(fromHex(tweetId));
                    console.log("=========================================================================");
                    console.log(`==================== DELETED TWEET SUCCESSFULLY ✅ =========================`)
                    console.log("=========================================================================");
                    break;

                }

                case "4": {
                    const tweetId = await rli.question(`Enter tweet ID? `);

                    resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
                    console.log("=========================================================================");
                    console.log(`==================== WITHDRAWING TWEET EARNINGS WITH ID: ${tweetId} =================`)
                    console.log("=========================================================================");


                    await tweetAPI.callTx.withdrawTweetEarnings(fromHex(tweetId));
                    console.log("=========================================================================");
                    console.log(`==================== WITHDREW TWEET EARNINGS SUCCESSFULLY ✅ =========================`)
                    console.log("=========================================================================");
                    break;

                }

                case "5": {
                    const tweetId = await rli.question(`Enter tweet ID? `);

                    resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
                    console.log("=========================================================================");
                    console.log(`==================== ENGAGING TWEET WITH ID (LIKE): ${tweetId} =================`)
                    console.log("=========================================================================");


                    await tweetAPI.callTx.likeTweet(fromHex(tweetId), coin(1));
                    console.log("=========================================================================");
                    console.log(`==================== LIKED TWEET SUCCESSFULLY ✅ =====================`)
                    console.log("=========================================================================");
                    break;

                }

                case "6": {
                    const tweetId = await rli.question(`Enter tweet ID? `);

                    resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
                    console.log("=========================================================================");
                    console.log(`==================== ENGAGING TWEET WITH ID (UNLIKE): ${tweetId} =================`)
                    console.log("=========================================================================");


                    await tweetAPI.callTx.unlikeTweet(fromHex(tweetId));
                    console.log("=========================================================================");
                    console.log(`==================== UNLIKE TWEET SUCCESSFULLY ✅ =====================`)
                    console.log("=========================================================================");
                    break;

                }

                case "7": {
                    const tweetId = await rli.question(`Enter tweet ID? `);

                    resumeAfterInvalidInput(tweetId, rli, "Invalid tweet length");
                    console.log("=========================================================================");
                    console.log(`==================== PROMOTING TWEET WITH ID: ${tweetId} =================`)
                    console.log("=========================================================================");


                    await tweetAPI.callTx.promoteTweet(fromHex(tweetId), coin(5));
                    console.log("=========================================================================");
                    console.log(`==================== PROMOTED TWEET SUCCESSFULLY ✅ =====================`)
                    console.log("=========================================================================");
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
                    throw Error("Invalid choice 😒");
                }
            }
        }
    } catch (error) {
        console.error(error);
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

export async function createWalletAndMinghtProvider(walletContext: WalletContext): Promise<WalletProvider & MidnightProvider> {
    return {
        getCoinPublicKey(): CoinPublicKey {
            return walletContext.shieldedSecreteKey.coinPublicKey as CoinPublicKey
        },
        getEncryptionPublicKey(): EncPublicKey {
            return walletContext.shieldedSecreteKey.encryptionPublicKey as EncPublicKey
        },
        submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
            return walletContext.wallet.submitTransaction(tx)
        },
        /** 
         * @param ttl means Time-To-Live and specifies how long the transaction last
         * @param tx specifies the unproven transaction to be balanced
         * @param newCoins specifies the coin to used for balancing the transaction
         */
        balanceTx(tx: UnprovenTransaction, newCoins?: ShieldedCoinInfo[], ttl?: Date): Promise<BalancedProvingRecipe> {
            const txTTL = ttl ?? new Date(Date.now() + 30 * 60 * 1000);
            return walletContext.wallet
                .balanceTransaction(
                    walletContext.shieldedSecreteKey,
                    walletContext.dustSecreteKey,
                    tx as unknown as Transaction<SignatureEnabled, Proofish, Bindingish>,
                    txTTL
                )
        }
    }
}


async function runDapp() {
    const rli = createInterface({
        input,
        output,
        terminal: true
    });

    const zkConfigPath = path.resolve(cwd(), "dist", "managed", "tweet");

    const walletConfig: WalletConfig = {
        networkId: "preview",
        indexerUri: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
        indexerWsUri: "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws",
        substrateNodeUri: "https://rpc.testnet-02.midnight.network",
        proverServerUri: "http://127.0.0.1:6300/" //http://midnight-proof-server-alb-1996898234.eu-north-1.elb.amazonaws.com

    };
    const walletContext = await buildWallet(walletConfig, rli)
    if (!walletContext) {
        throw ("Failed to build wallet")
    }
    const walletAndMidnightProvider = await createWalletAndMinghtProvider(walletContext);
    const providers: TweetContractProviders = {
        privateStateProvider: levelPrivateStateProvider<typeof privateStateId>({
            privateStateStoreName: privateStateId,
            walletProvider: walletAndMidnightProvider
        }),
        publicDataProvider: indexerPublicDataProvider(
            walletConfig.indexerUri,
            walletConfig.indexerWsUri
        ),
        zkConfigProvider: new NodeZkConfigProvider<TokenCircuitKeys>(zkConfigPath),
        walletProvider: walletAndMidnightProvider,
        midnightProvider: walletAndMidnightProvider,
        proofProvider: httpClientProofProvider<TokenCircuitKeys>(walletConfig.proverServerUri)
    };

    await circuitMainLoop(providers, rli);

}


runDapp();