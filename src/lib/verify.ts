import {pieceId,sourceHash,verdictCommitment} from "./ids.ts";
import {pyStrip} from "./pytext.ts";
import type {Credits,Piece,Source} from "./types.ts";
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const n=(v:Credits|null)=>BigInt(v?.credits??"0");
export function sourceVerified(p:Piece,s:Source|null):s is Source {
 if(!s||s.piece_id!==p.piece_id||s.source_url!==p.source_url||s.source_hash!==p.source_hash||s.commitment!==p.commitment||sourceHash(s.text)!==p.source_hash||verdictCommitment(p.piece_id,p.source_hash)!==p.commitment)return false;
 const paragraphs=s.text.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/u).flatMap(l=>{const a=pyStrip(l),chars=Array.from(a),out=[];for(let i=0;i<chars.length;i+=600)out.push(chars.slice(i,i+600).join(""));return out;});
 return paragraphs.length===p.passage_count&&JSON.stringify(paragraphs)===JSON.stringify(s.passages);
}
export function publishVerified(p:Piece|null,s:{id:string;me:string;headline:string;sourceUrl:string;bondWei:bigint}):boolean {return !!p&&p.piece_id===s.id&&pieceId(s.me,s.headline,s.sourceUrl)===s.id&&same(p.author,s.me)&&p.headline===pyStrip(s.headline)&&p.source_url===pyStrip(s.sourceUrl)&&p.bond_wei===s.bondWei.toString()&&p.state==="OPEN"&&p.held_wei===p.bond_wei&&verdictCommitment(p.piece_id,p.source_hash)===p.commitment;}
export type ChallengeCheck={ok:true;piece:Piece}|{ok:false};
export function challengeVerified(before:{piece:Piece;myCredits:Credits|null;authorCredits:Credits|null;source:Source;index:number},after:{piece:Piece|null;myCredits:Credits|null;authorCredits:Credits|null},me:string):ChallengeCheck {
 const p=after.piece,b=before.piece;if(!p||!after.myCredits||!after.authorCredits||!same(after.myCredits.wallet,me)||!same(after.authorCredits.wallet,b.author)||!same(p.challenger,me)||p.held_wei!=="0"||p.source_hash!==b.source_hash||p.commitment!==b.commitment||p.headline!==b.headline||p.source_url!==b.source_url||p.bond_wei!==b.bond_wei||p.challenged_passage!==before.index||p.challenger_quote!==before.source.passages[before.index]||!sourceVerified(p,before.source))return {ok:false};
 const bond=BigInt(b.bond_wei),mine=n(after.myCredits)-n(before.myCredits),author=n(after.authorCredits)-n(before.authorCredits);
 const table:Record<string,[string,bigint,bigint]>={OVERCLAIMS:["RULED_OVERCLAIMS",2n*bond,0n],WITHIN:["RULED_WITHIN",0n,2n*bond],VOID:["VOID",bond,bond]};const e=table[p.outcome];
 if(!e||p.state!==e[0]||mine!==e[1]||author!==e[2])return {ok:false};
 if(p.outcome==="VOID"){if(p.cited_indices.length||p.cited_passages.length)return {ok:false};}
 else if(!p.cited_indices.length||p.cited_indices.length>3||new Set(p.cited_indices).size!==p.cited_indices.length||p.cited_indices.some((i,k)=>!Number.isInteger(i)||i<0||i>=p.passage_count||p.cited_passages[k]!==before.source.passages[i])||p.cited_passages.length!==p.cited_indices.length)return {ok:false};
 return {ok:true,piece:p};
}
export function retireVerified(before:{piece:Piece;myCredits:Credits|null},after:{piece:Piece|null;myCredits:Credits|null}):boolean {return !!after.piece&&after.piece.state==="RETIRED"&&after.piece.source_hash===before.piece.source_hash&&after.piece.held_wei==="0"&&n(after.myCredits)===n(before.myCredits)+BigInt(before.piece.bond_wei);}
export function withdrawVerified(before:Credits|null,after:Credits|null):boolean {return !!before&&!!after&&same(before.wallet,after.wallet)&&n(before)>0n&&n(after)===0n;}
