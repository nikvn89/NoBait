// Verified Project V2 deployment; a Vercel environment value may override it.
export const PROJECT_DEPLOYMENT = "0xB4f042B07E140F990DE7e5c6fecdd6bB46cF9816";
export const CONTRACT_ADDRESS = String(import.meta.env.VITE_CONTRACT_ADDRESS ?? PROJECT_DEPLOYMENT).trim();

// Same-origin proxy declared in BOTH vite.config.ts and vercel.json.
// Every read, every receipt poll and the write client use this one URL.
export const RPC_PATH = "/genlayer-rpc";

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_HEX = "0xf22f";
// Only used when MetaMask must add the network (wallet_addEthereumChain needs an absolute URL).
export const WALLET_ADD_RPC = "https://studio.genlayer.com/api";
export const EXPLORER_BASE = "https://explorer-studio.genlayer.com";

export const SOURCE_SHA256 = "666c2bc87bc7cd208720c14c7c5d6eece44c1b9d8c4e4427551399d01dd9b1c4";

export const RECEIPT_TIMEOUT_MS = 150_000;
export const RECEIPT_POLL_MS = 3_000;
