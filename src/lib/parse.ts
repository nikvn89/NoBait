import type {Credits,Piece,Source} from "./types.ts";
export function parseObject(raw:string):Record<string,unknown>|null {
 try{let v=JSON.parse(raw);for(let i=0;i<2&&typeof v==="string";i++)v=JSON.parse(v);return v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length?v:null;}catch{return null;}
}
const amount=(v:unknown)=>typeof v==="string"&&/^\d+$/.test(v);
const hash=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
export function parsePiece(raw:string):Piece|null {
 const o=parseObject(raw);if(!o||!hash(o.piece_id)||!hash(o.source_hash)||!hash(o.commitment)||!amount(o.bond_wei)||!amount(o.held_wei)||typeof o.source_url!=="string"||!o.source_url.startsWith("https://")||typeof o.author!=="string"||typeof o.headline!=="string"||typeof o.state!=="string"||!Number.isInteger(o.passage_count)||!Array.isArray(o.cited_indices)||!Array.isArray(o.cited_passages))return null;
 return o as unknown as Piece;
}
export function parseSource(raw:string):Source|null {const o=parseObject(raw);return o&&hash(o.piece_id)&&hash(o.source_hash)&&hash(o.commitment)&&typeof o.text==="string"&&Array.isArray(o.passages)&&o.passages.every(x=>typeof x==="string")?o as unknown as Source:null;}
export function parseCredits(raw:string):Credits|null {const o=parseObject(raw);return o&&typeof o.wallet==="string"&&amount(o.credits)?o as unknown as Credits:null;}
export type Limits={rubric_hash?:string;min_bond_wei?:string;max_bond_wei?:string;contract_name?:string;version?:string;source_snapshot_required?:boolean;challenger_passages?:boolean;verdict_citations?:boolean;external_web_used?:boolean};
export function parseLimits(raw:string):Limits|null {return parseObject(raw) as Limits|null;}
export function compatibleProfile(p:Limits|null):boolean {return !!p&&p.contract_name==="HeadlineBound"&&p.version==="2.0.0"&&p.source_snapshot_required===true&&p.challenger_passages===true&&p.verdict_citations===true&&p.external_web_used===true;}
