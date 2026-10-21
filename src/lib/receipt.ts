import {readExplicitExecutionResult} from "./transactionExecution.ts";
export type ReceiptVerdict={kind:"pending";status:string}|{kind:"success";status:string}|{kind:"error";status:string;reason:string};
export function revertReasonFrom(v:unknown):string|null {
 const walk=(x:unknown,d=0):string[]=>d>6?[]:typeof x==="string"?[x]:Array.isArray(x)?x.flatMap(t=>walk(t,d+1)):x&&typeof x==="object"?Object.values(x).flatMap(t=>walk(t,d+1)):[];
 for(const s of walk(v)){const m=s.match(/(?:UserError|\[rollback\])[:\s]*([^\n"]{3,200})/i);if(m)return m[1].trim();}return null;
}
export function classifyTransaction(tx:any):ReceiptVerdict {
 const status=String(tx?.status??"").toUpperCase();const execution=readExplicitExecutionResult(tx);
 if(execution==="FINISHED_WITH_RETURN")return {kind:"success",status};
 if(execution==="FINISHED_WITH_ERROR")return {kind:"error",status,reason:"Contract execution rolled back. Check the explorer for details."};
 if(["CANCELED","UNDETERMINED","LEADER_TIMEOUT","VALIDATORS_TIMEOUT"].includes(status))return {kind:"error",status,reason:`Consensus ended as ${status}; no verified change.`};
 return {kind:"pending",status};
}
