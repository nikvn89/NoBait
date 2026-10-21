import {keccak256,stringToBytes} from "viem";
import {pyLen,pyNormalize,pyStrip} from "./pytext.ts";
export function pieceId(author:string,headline:string,url:string):string {
 const h=pyNormalize(headline),u=pyStrip(url);
 return keccak256(stringToBytes("NOB_SOURCE:PIECE:V2|"+author.toLowerCase()+"|"+pyLen(h)+"|"+h+"|"+pyLen(u)+"|"+u)).slice(2);
}
export function sourceHash(text:string):string {return keccak256(stringToBytes(text)).slice(2);}
export function verdictCommitment(id:string,hash:string):string {
 return keccak256(stringToBytes("NOB_SOURCE:VERDICT:V2|"+id+"|"+hash)).slice(2);
}
export function idsFromInput(value:string):string[] {
 return [...new Set(Array.from(value.matchAll(/(?<![0-9a-fA-F])([0-9a-fA-F]{64})(?![0-9a-fA-F])/g),m=>m[1].toLowerCase()))];
}
export function short(v:string,head=6,tail=4):string {return !v||v.length<=head+tail+1?v:`${v.slice(0,head)}…${v.slice(-tail)}`;}
