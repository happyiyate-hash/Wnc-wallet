
/**
 * INSTITUTIONAL FEE RECIPIENT REGISTRY
 * Version: 2.0.0 (Unified Mapping)
 * 
 * Centralized node for managing fee targets across 39 blockchain ecosystems.
 * EVM chains are merged into a single vault, while others maintain discrete nodes.
 */

export const FEE_RECIPIENTS = {
    // --- EVM COMPATIBLE GROUP (19 Chains) ---
    // Ethereum, Polygon, Base, Linea, Optimism, Arbitrum, Blast, Avalanche, BSC, Celo, zkSync, Scroll, Sei, Mantle, opBNB, Palm, Hemi, Swellchain, Unichain
    evm: '0x144F9E614c094ADDA010A27c254faDeFF390A3B2',

    // --- LEDGER / ACCOUNT NODES ---
    xrpLedger: "rHb9CJAWyUMayX9V8Gu89FWJCoDYHnC4n",
    polkadot: "126uFrKy6yuX9S7yY6YVf6YVf6YVf6YVf6YVf6YVf6YV",
    kusama: "E6YVf6YVf6YVf6YVf6YVf6YVf6YVf6YVf6YVf6YVf6YV",

    // --- SOLANA-LIKE / SMART CONTRACT NODES ---
    solana: "AdminVaultSolana1111111111111111111111111",
    near: "admin-vault.near",
    cosmos: "cosmos1adminvaultplaceholder",
    osmosis: "osmo1adminvaultplaceholder",
    secretNetwork: "secret1adminvaultplaceholder",
    injective: "inj1adminvaultplaceholder",
    celestia: "celestia1adminvaultplaceholder",
    cardano: "addr1adminvaultplaceholder",
    tron: "TNV9Z6XYnZAnvXAnvXAnvXAnvXAnvX",
    algorand: "ADMINALGOVAULTPH",
    hedera: "0.0.123456",
    tezos: "tz1adminvaultplaceholder",
    aptos: "0xaptosadminvaultplaceholder",
    sui: "0xsuiadminvaultplaceholder",

    // --- UTXO NODES ---
    bitcoin: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    litecoin: "ltc1qadminvaultplaceholder",
    dogecoin: "Ddogeadminvaultplaceholder",
};

/**
 * Resolves the institutional fee recipient address for any supported chain.
 */
export function getFeeRecipient(chainName: string): string {
    const name = chainName.toLowerCase();

    // 1. EVM GROUPING (19 Chains)
    const evmNames = [
        "ethereum", "polygon", "base", "linea", "optimism", "arbitrum", "blast",
        "avalanche c-chain", "bsc", "celo", "zksync", "scroll", "sei", "mantle",
        "opbnb", "palm", "hemi", "swellchain", "unichain"
    ];
    if (evmNames.includes(name)) return FEE_RECIPIENTS.evm;

    // 2. LEDGER HANDSHAKE
    if (name.includes("xrp")) return FEE_RECIPIENTS.xrpLedger;
    if (name === "polkadot") return FEE_RECIPIENTS.polkadot;
    if (name === "kusama") return FEE_RECIPIENTS.kusama;

    // 3. SOLANA-LIKE HANDSHAKE
    if (name === "solana") return FEE_RECIPIENTS.solana;
    if (name === "near protocol") return FEE_RECIPIENTS.near;
    if (name === "cosmos hub") return FEE_RECIPIENTS.cosmos;
    if (name === "osmosis") return FEE_RECIPIENTS.osmosis;
    if (name === "secret network") return FEE_RECIPIENTS.secretNetwork;
    if (name === "injective") return FEE_RECIPIENTS.injective;
    if (name === "celestia") return FEE_RECIPIENTS.celestia;
    if (name === "cardano") return FEE_RECIPIENTS.cardano;
    if (name === "tron") return FEE_RECIPIENTS.tron;
    if (name === "algorand") return FEE_RECIPIENTS.algorand;
    if (name === "hedera") return FEE_RECIPIENTS.hedera;
    if (name === "tezos") return FEE_RECIPIENTS.tezos;
    if (name === "aptos") return FEE_RECIPIENTS.aptos;
    if (name === "sui") return FEE_RECIPIENTS.sui;

    // 4. UTXO HANDSHAKE
    if (name === "bitcoin") return FEE_RECIPIENTS.bitcoin;
    if (name === "litecoin") return FEE_RECIPIENTS.litecoin;
    if (name === "dogecoin") return FEE_RECIPIENTS.dogecoin;

    // Fallback to primary EVM vault
    return FEE_RECIPIENTS.evm;
}
