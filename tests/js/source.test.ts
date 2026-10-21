import test from 'node:test';import assert from 'node:assert/strict';
import {pieceId,sourceHash,verdictCommitment} from '../../src/lib/ids.ts';
import {compatibleProfile,parsePiece,parseSource} from '../../src/lib/parse.ts';
import {publishBlock,challengeBlock,validSourceUrl} from '../../src/lib/rules.ts';
import {sourceVerified,challengeVerified,publishVerified,withdrawVerified} from '../../src/lib/verify.ts';
import {classifyTransaction} from '../../src/lib/receipt.ts';
import {calldataBytes} from '../../src/lib/calldata.ts';
import type {Piece,Source} from '../../src/lib/types.ts';
const A='0x'+'a'.repeat(40),B='0x'+'b'.repeat(40),url='https://example.org/article',headline='The study concerned mice',text='Study announcement\nA mouse study observed smaller tumours. No human trials have been conducted.';
const id=pieceId(A,headline,url),hash=sourceHash(text),commitment=verdictCommitment(id,hash);
const p:Piece={piece_id:id,author:A,headline,source_url:url,source_hash:hash,commitment,passage_count:2,bond_wei:'1000000000000000',state:'OPEN',challenger:'',outcome:'',challenged_passage:-1,challenger_quote:'',cited_indices:[],cited_passages:[],open_to_challenge:true,held_wei:'1000000000000000'};
const s:Source={piece_id:id,source_url:url,source_hash:hash,commitment,text,passages:text.split('\n')};
const credit=(wallet:string,credits:string)=>({wallet,credits});
const before={piece:p,myCredits:credit(B,'0'),authorCredits:credit(A,'0'),source:s,index:1};
function after(){return {piece:{...p,state:'RULED_WITHIN',challenger:B,outcome:'WITHIN',challenged_passage:1,challenger_quote:s.passages[1],cited_indices:[1],cited_passages:[s.passages[1]],held_wei:'0'},myCredits:credit(B,'0'),authorCredits:credit(A,'2000000000000000')};}
test('hash and commitment bind exact snapshot, headline and URL',()=>{
 assert.notEqual(sourceHash(text+' '),hash);assert.notEqual(pieceId(A,headline+'!',url),id);assert.notEqual(pieceId(A,headline,url+'/other'),id);assert.equal(pieceId(A.toUpperCase(),headline,url),id);assert.ok(sourceVerified(p,s));
});
test('tampered source, passages or commitment cannot enable a challenge',()=>{
 for(const v of [{...s,text:text+' Changed.'},{...s,passages:['Fabricated evidence']},{...s,source_url:'https://other.org'},{...s,commitment:'0'.repeat(64)}])assert.equal(sourceVerified(p,v),false);
});
test('legacy profile and pieces are refused',()=>{
 assert.equal(compatibleProfile({version:'1.0.0'}),false);assert.equal(parsePiece(JSON.stringify({piece_id:id,bond_wei:p.bond_wei,held_wei:p.held_wei,summary:'author summary'})),null);
 assert.ok(compatibleProfile({version:'2.0.0',contract_name:'HeadlineBound',source_snapshot_required:true,challenger_passages:true,verdict_citations:true,external_web_used:true}));assert.ok(parsePiece(JSON.stringify(p)));assert.ok(parseSource(JSON.stringify(s)));
});
test('challenger must select an existing source passage',()=>{assert.ok(challengeBlock(p,B));assert.ok(challengeBlock(p,B,-1));assert.ok(challengeBlock(p,B,2));assert.equal(challengeBlock(p,B,1),null);assert.ok(challengeBlock(p,A,1));});
test('URL gate excludes credentials, IP literals and non-HTTPS',()=>{
 for(const u of ['http://example.org','https://127.0.0.1','https://a@example.org','https://example.org:443','https://example.org/#x','https://example.local/a','https://-bad.org'])assert.equal(validSourceUrl(u),false,u);
 assert.ok(validSourceUrl(url));assert.equal(publishBlock({me:A,headline,sourceUrl:url,bondWei:10n**15n,exists:false,bytes:200}),null);
 assert.ok(publishBlock({me:A,headline,sourceUrl:url,bondWei:10n**15n,exists:false,bytes:256}));
});
test('publish postcondition binds URL and source commitment',()=>{
 const expected={id,me:A,headline,sourceUrl:url,bondWei:10n**15n};assert.ok(publishVerified(p,expected));assert.equal(publishVerified({...p,source_url:url+'/changed'},expected),false);assert.equal(publishVerified({...p,commitment:'0'.repeat(64)},expected),false);
});
test('ruling verifies BOTH parties credits and source-grounded citations',()=>{
 assert.ok(challengeVerified(before,after(),B).ok);
 const a=after();a.authorCredits.credits='0';assert.equal(challengeVerified(before,a,B).ok,false);
 const b=after();b.piece.cited_passages=['Invented quote'];assert.equal(challengeVerified(before,b,B).ok,false);
 const c=after();c.piece.source_hash='0'.repeat(64);assert.equal(challengeVerified(before,c,B).ok,false);
 const d=after();d.piece.challenged_passage=0;assert.equal(challengeVerified(before,d,B).ok,false);
});
test('VOID refunds each side and has no conclusive citations',()=>{
 const a=after();a.piece.state='VOID';a.piece.outcome='VOID';a.piece.cited_indices=[];a.piece.cited_passages=[];a.myCredits.credits=a.authorCredits.credits='1000000000000000';assert.ok(challengeVerified(before,a,B).ok);
 a.piece.cited_indices=[1];assert.equal(challengeVerified(before,a,B).ok,false);
});
test('finality and explicit raw normal return are required',()=>{
 const success={mode:'leader',execution_result:'SUCCESS',result:Buffer.from([0]).toString('base64')};
 assert.equal(classifyTransaction({status:'ACCEPTED',consensus_data:{leader_receipt:[success]}}).kind,'pending');
 assert.equal(classifyTransaction({status:'FINALIZED',consensus_data:{leader_receipt:[success]}}).kind,'success');
 assert.equal(classifyTransaction({status:'FINALIZED',consensus_data:{leader_receipt:[{...success,result:null}]}}).kind,'pending');
 assert.equal(classifyTransaction({status:'FINALIZED',consensus_data:{leader_receipt:[success,{mode:'leader',execution_result:'ERROR',result:Buffer.from([1]).toString('base64')}]}}).kind,'error');
});
test('withdraw checks same wallet credit clearance only, not native arrival',()=>{assert.ok(withdrawVerified(credit(A,'100'),credit(A,'0')));assert.equal(withdrawVerified(credit(A,'100'),credit(B,'0')),false);});
test('numeric evidence pointer stays below conservative calldata guard',()=>{
 assert.ok(calldataBytes('publish',[headline,url])<=255);assert.ok(calldataBytes('challenge',[id,1])<=255);
});
test('source hash, unicode publication id and commitment match real SDK golden vectors',async()=>{
 const {readFileSync}=await import('node:fs');
 const vectors=JSON.parse(readFileSync(new URL('./source-vectors.json',import.meta.url),'utf8'));
 for(const v of vectors){assert.equal(pieceId(v.author,v.headline,v.url),v.id);assert.equal(sourceHash(v.text),v.source_hash);assert.equal(verdictCommitment(v.id,v.source_hash),v.commitment);}
});
