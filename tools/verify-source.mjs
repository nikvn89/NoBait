import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),release=JSON.parse(readFileSync(new URL('release.json',root),'utf8'));
const bytes=readFileSync(new URL(release.contract_file,root),'utf8').replaceAll('\r\n','\n');
const digest=createHash('sha256').update(bytes).digest('hex');
if(digest!==release.source_sha256)throw Error('Contract source differs from the frozen v2 fingerprint');
if(!readFileSync(new URL('SOURCE_SHA256.txt',root),'utf8').startsWith(digest))throw Error('SOURCE_SHA256.txt differs');
if(!readFileSync(new URL('src/lib/config.ts',root),'utf8').includes(digest))throw Error('UI source fingerprint differs');
console.log('Source parity PASS: '+digest);
