// Shapes of the contract's JSON views. Every amount is a decimal STRING in the
// view (wei exceeds 2^53) and stays a string until it is turned into a bigint.

export type Piece = {
  piece_id: string;
  author: string;
  headline: string;
  summary: string;
  bond_wei: string;
  state: "OPEN" | "RULED_OVERCLAIMS" | "RULED_WITHIN" | "VOID" | "RETIRED" | string;
  challenger: string;
  outcome: "OVERCLAIMS" | "WITHIN" | "VOID" | "" | string;
  open_to_challenge: boolean;
  held_wei: string;
};

export type Credits = {
  wallet: string;
  credits: string;
};

export type TxPhase = "idle" | "checking" | "signing" | "submitted" | "delayed" | "success" | "error";

export type TxStatus = {
  phase: TxPhase;
  message: string;
  hash?: string;
  action?: string;
};
