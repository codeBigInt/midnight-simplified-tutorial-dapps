import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { Interface } from "node:readline/promises"
import { WalletConfig, WalletConfiguration, WalletContext } from "./common-types";
import { wordlist as english } from "@scure/bip39/wordlists/english.js"
import { generateMnemonic, mnemonicToSeed } from "@scure/bip39";
import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import { DustSecretKey, LedgerParameters, nativeToken, ZswapSecretKeys } from "@midnight-ntwrk/ledger-v6";
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { filter, firstValueFrom, map, pipe, tap, throttleTime } from "rxjs";
import { CREATE_WALLET_CHOICE } from "./userChoices";

export async function buildFreshWallet(config: WalletConfig): Promise<WalletContext> {
    console.log(`Creating new wallet...`);
    const mnemonics = generateMnemonic(english, 24);
    console.log(`Generated new wallet. Your passphrase is ${mnemonics}...`);

    return await buildWalletAndWaitForFunds(mnemonics, config);
}

export async function buildWalletFromMnemonics(rli: Interface, config: WalletConfig): Promise<WalletContext> {
    console.log(`Building wallet from mnemonic passphrase...`);
    const mnemonics = await rli.question(`Enter your wallet passphrase (24 words): `);
    return await buildWalletAndWaitForFunds(mnemonics, config);
}

export async function buildWalletAndWaitForFunds(mnemonics: string, config: WalletConfig) {
    const seed = await mnemonicToSeed(mnemonics, "dummyPassword");
    // Build a HDWallet using the computed seed from the user's mnemonic
    const hdWallet = HDWallet.fromSeed(seed);
    const walletContext = await intiallizeWallet(hdWallet, config);

    console.log(`Wallet connection successful. Your bech32m address is: ${walletContext.unshieldedKeyStore.getBech32Address().asString()
        }`)
    console.log(`Your wallet public key is: ${walletContext.unshieldedKeyStore.getPublicKey()}`)
    console.log(`Your wallet secret key is: ${walletContext.unshieldedKeyStore.getAddress()}`)


    await waitForWalletSync(walletContext.wallet);
    const tokenBalances = await waitForFunds(walletContext.wallet);
    console.log(`Wallet recieved funds. Shielded: ${tokenBalances.shielded} tokens, Unshielded: ${tokenBalances.unshielded}`);

    /** Register available unshielded tokens to generate DUST for paying gas fee */
    await registerNightForDustGeneration(walletContext);

    return walletContext;
}

export async function waitForWalletSync(facadeWallet: WalletFacade) {
    await firstValueFrom(
        facadeWallet.state().pipe(
            throttleTime(5000),
            tap((state) => {
                console.log(`Wallet syncing in progress. Syncing completed: ${state.isSynced}`);
            }),
            filter((s) => s.isSynced == true)
        )
    );
}

export async function waitForFunds(facadeWallet: WalletFacade) {
    const state = await firstValueFrom(
        facadeWallet.state().pipe(
            throttleTime(5000),
            tap((state) => {
                const unshieldedTokenBalance = state.unshielded.balances[nativeToken().raw] ?? 0n;
                const shieldedTokenBalance = state.shielded.balances[nativeToken().raw] ?? 0n;
                console.log(`Waiting for funds. Unshielded: ${unshieldedTokenBalance} Shielded: ${shieldedTokenBalance}`)
            }),
            filter((state) => state.isSynced),
            map((state) => {
                return {
                    unshielded: state.unshielded.balances[nativeToken().raw] ?? 0n,
                    shielded: state.shielded.balances[nativeToken().raw] ?? 0n
                }
            }),
            filter((balance) => (balance.shielded + balance.unshielded) > 0n))
    )
    return state;
}


async function intiallizeWallet(
    hdWallet: Awaited<ReturnType<typeof HDWallet.fromSeed>>,
    config: WalletConfig
): Promise<WalletContext> {
    /** Ensure the hdwallet was derived successfully */
    if (hdWallet.type !== "seedOk") {
        throw (new Error("Failed to set up wallet"));
    };

    /** Derive wallet zswap keys for wallet creation and intialization */
    const zswapKey = hdWallet.hdWallet.selectAccount(0).selectRoles([
        Roles.Zswap,
        Roles.NightExternal,
        Roles.Dust
    ]).deriveKeysAt(0);

    if (zswapKey.type !== "keysDerived") {
        throw (new Error("HD Wallet key derivation failed"));
    }
    /** Clears internals to prevent memory clogging */
    hdWallet.hdWallet.clear();

    const shieldedSecreteKey = ZswapSecretKeys.fromSeed(
        zswapKey.keys[Roles.Zswap]
    )
    const dustSecreteKey = DustSecretKey.fromSeed(
        zswapKey.keys[Roles.Dust]
    )
    const unshieldedKeyStore = createKeystore(zswapKey.keys[Roles.NightExternal], config.networkId as any)

    const walletConfiguration: WalletConfiguration = {
        relayURL: new URL(config.substrateNodeUri),
        provingServerUrl: new URL(config.proverServerUri),
        indexerClientConnection: {
            indexerHttpUrl: config.indexerUri,
            indexerWsUrl: config.indexerWsUri
        },
        indexerUrl: config.indexerWsUri,
        costParameters: {
            additionalFeeOverhead: 300_000_000_000_000n, // 300 trillion - matches SDK examples
            feeBlocksMargin: 5,
        },
        networkId: config.networkId as any
    }

    /** Create shielded, dust and unshielded wallet */
    const shieldedWallet = ShieldedWallet(walletConfiguration).startWithSecretKeys(shieldedSecreteKey);
    const dustWallet = DustWallet(walletConfiguration)
        .startWithSecretKey(
            dustSecreteKey,
            LedgerParameters.initialParameters().dust
        )
    const unshieldedWallet = UnshieldedWallet({
        ...walletConfiguration,
        txHistoryStorage: new InMemoryTransactionHistoryStorage()
    }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeyStore))


    /** Create wallet facade */
    const facade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    await facade.start(shieldedSecreteKey, dustSecreteKey)
    return {
        wallet: facade,
        shieldedSecreteKey,
        unshieldedKeyStore,
        dustSecreteKey
    }
}


/** @function registerNightForDustGeneration registers available unshielded Night tokens for Dust (shileded token) generation */

export async function registerNightForDustGeneration(walletContext: WalletContext) {
    const state = await firstValueFrom(walletContext.wallet.state().pipe(
        throttleTime(5000),
        tap((state) => {
            console.log(`Wallet synced: Sync: ${state.isSynced}`)
        }),
        filter((s) => s.isSynced)
    ));

    const unregisteredUnshiieldedTokens = state.unshielded.availableCoins.filter((coin) => coin.meta.registeredForDustGeneration) ?? [];

    if (unregisteredUnshiieldedTokens.length == 0) {
        console.log(`No unsheilded night or unshielded tokens for DUST generation`)

        /** Check DUST balance */
        const dustBalance = state.dust.walletBalance(new Date()) ?? 0n;
        return dustBalance > 0n
    }

    console.log(`Found ${unregisteredUnshiieldedTokens.length} NIGHT UTXO available for DUST generation. Registering UTXO...`);
    try {
        console.log(`Registering unregistered NIGHT UTXOs...`)
        const reciepe = await walletContext.wallet.registerNightUtxosForDustGeneration(
            unregisteredUnshiieldedTokens,
            walletContext.unshieldedKeyStore.getPublicKey(),
            (payload) => walletContext.unshieldedKeyStore.signData(payload)
        )

        console.log(`Finalizing registration transaction`);
        const finalizedTx = await walletContext.wallet.finalizeTransaction(reciepe);
        console.log(`Finalized transaction successfully`);

        console.log(`Submitting registration transaction`);
        const transactionId = await walletContext.wallet.submitTransaction(finalizedTx);
        console.log(`Wallet successfully sumbitted regisration transaction with ID: ${transactionId}`)


        /** Wait for dust to arrive */
        await firstValueFrom(walletContext.wallet.state().pipe(
            throttleTime(5000),
            tap((state) => {
                const dustBalance = state.dust.walletBalance(new Date()) ?? 0n;
                console.log(`Wallet DUST Balance is ${dustBalance}`);
            }),
            filter((state) => (state.dust.walletBalance(new Date()) ?? 0n) > 0n)
        ))

        console.log(`NIGTH registration for DUST generation complete!✅`)
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : `Failed to register all ${unregisteredUnshiieldedTokens.length} UTXO`
        console.log(`Failed to generate DUST: ${errorMessage}`);
        return false;
    }
}

export async function buildWallet(config: WalletConfig, rli: Interface): Promise<WalletContext | undefined>{
    let walletContext: WalletContext | undefined;
    const userWalletChoice = await rli.question(CREATE_WALLET_CHOICE);
    switch(userWalletChoice){
        case "1":{
            walletContext = await buildFreshWallet(config);
            break;
        }
        case "2": {
            walletContext = await buildWalletFromMnemonics(rli, config)
        }
        case "3": {
            /** Exit the cli interface */
            console.log(`Exiting cli dapp....`)
            rli.close()
        }
        default:{
            console.error(`Invalid option selected`)
        }
    }

    return walletContext;
}