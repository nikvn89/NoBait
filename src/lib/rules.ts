import {pyLen,pyStrip} from "./pytext.ts";
import type {Credits,Piece} from "./types.ts";
export const MAX_HEADLINE_LENGTH=90,MAX_URL_LENGTH=512;
export const MIN_BOND_WEI=10n**15n,MAX_BOND_WEI=10n**18n;
export const REVERTS={headline:"Headline must contain 1 to 90 characters",url:"Source must be a public HTTPS URL",bondRange:"The bond is out of range",duplicate:"This publication already exists",unknown:"Unknown piece id",notOpen:"This piece is no longer open to challenge",authorChallenge:"The author cannot challenge their own piece",bondMismatch:"The challenge bond must equal the author's bond",passage:"Choose an existing source passage",onlyAuthor:"Only the author may retire this piece",nothing:"Nothing to withdraw"} as const;
export const UI={noWallet:"Connect a wallet first",tooManyBytes:"Headline and source URL exceed this build's conservative 255-byte write budget; shorten the headline or choose a shorter original URL"};
export function validSourceUrl(input:string):boolean {
 const u=pyStrip(input);if(!u.startsWith("https://")||pyLen(u)>512||/[^\x21-\x7e]|[#\\]/.test(u))return false;
 const host=u.slice(8).split("/")[0].split("?")[0].toLowerCase();
 return host.length<=253&&host.includes(".")&&!/[@:]/.test(host)&&!/[.](local|localhost|internal)$/.test(host)&&host.split(".").every(l=>l.length>0&&l.length<=63&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(l))&&/[a-z]/.test(host.split(".").at(-1)!);
}
export function isAuthor(p:Piece,me:string):boolean {return !!me&&p.author.toLowerCase()===me.toLowerCase();}
export type PublishInput={me:string;headline:string;sourceUrl:string;bondWei:bigint|null;exists:boolean;bytes:number};
export function publishBlock(i:PublishInput):string|null {
 if(!i.me)return UI.noWallet;const h=pyStrip(i.headline);
 if(!pyLen(h)||pyLen(h)>90)return REVERTS.headline;
 if(!validSourceUrl(i.sourceUrl))return REVERTS.url;
 if(i.bondWei===null||i.bondWei<MIN_BOND_WEI||i.bondWei>MAX_BOND_WEI)return REVERTS.bondRange;
 if(i.exists)return REVERTS.duplicate;if(i.bytes>255)return UI.tooManyBytes;return null;
}
export function challengeBlock(p:Piece,me:string,index?:number):string|null {
 if(!me)return UI.noWallet;if(p.state!=="OPEN")return REVERTS.notOpen;if(isAuthor(p,me))return REVERTS.authorChallenge;
 if(!Number.isInteger(index)||index!<0||index!>=p.passage_count)return REVERTS.passage;return null;
}
export function retireBlock(p:Piece,me:string):string|null {if(!me)return UI.noWallet;if(p.state!=="OPEN")return REVERTS.notOpen;if(!isAuthor(p,me))return REVERTS.onlyAuthor;return null;}
export function withdrawBlock(me:string,c:Credits|null):string|null {if(!me)return UI.noWallet;return BigInt(c?.credits??"0")<=0n?REVERTS.nothing:null;}
export type Stamp={label:string;tone:"over"|"within"|"void"|"open"|"retired";who:string};
export function stampOf(p:Piece):Stamp {
 switch(p.state){case "RULED_OVERCLAIMS":return {label:"OVERCLAIMS",tone:"over",who:"challenger credited both bonds"};case "RULED_WITHIN":return {label:"WITHIN",tone:"within",who:"author credited both bonds"};case "VOID":return {label:"VOID",tone:"void",who:"each bond refunded to credits"};case "RETIRED":return {label:"RETIRED",tone:"retired",who:"author credited their bond"};default:return {label:"OPEN",tone:"open",who:"bond held, open to one challenge"};}
}
