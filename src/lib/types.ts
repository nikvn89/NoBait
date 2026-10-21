export type Piece = {
 piece_id: string; author: string; headline: string; source_url: string; source_hash: string;
 commitment: string; passage_count: number; bond_wei: string; state: string;
 challenger: string; outcome: string; challenged_passage: number; challenger_quote: string;
 cited_indices: number[]; cited_passages: string[]; open_to_challenge: boolean; held_wei: string;
};
export type Source = {piece_id:string; source_url:string; source_hash:string; commitment:string; text:string; passages:string[]};
export type Credits = {wallet:string; credits:string};
export type TxPhase = "idle"|"checking"|"signing"|"submitted"|"delayed"|"success"|"error";
export type TxStatus = {phase:TxPhase;message:string;hash?:string;action?:string};
