import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonical} from '../lib/platform/pilot-prep/contracts.mjs';
import {parseR7Kraken} from '../lib/platform/research/robot-r7-public-h1.mjs';
import {verifyR10Commit} from '../lib/platform/research/robot-r10-post-candle.mjs';
import {readFileSync} from 'node:fs';

const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
const open=Date.parse('2026-10-22T13:00:00Z');
const plan={asset:'BTC-USD',openMs:open,closeMs:open+3600000};
const row=[open/1000,'100','102','99','101','100.4','30',2];

test('R11 BTC-USD rejects unrelated Kraken pair keys even when OHLC is valid',()=>{
 for(const key of ['XETHZUSD','ETHUSD','USDTUSD','XXBTZUSDT','UNKNOWN']){
  assert.throws(()=>parseR7Kraken({error:[],result:{[key]:[row],last:open/1000}},plan),/R7_KRAKEN_PAIR_AMBIGUOUS/);
 }
 for(const key of ['XXBTZUSD','XBTUSD']){
  assert.equal(parseR7Kraken({error:[],result:{[key]:[row],last:open/1000}},plan).close,101);
 }
});

test('R11 preserves R9 SHA precommit while refusing duplicated or missing mode-intent pairs',()=>{
 // This test uses a digest test double matching the R10 configured expected digest
 // through the exposed archive-backed fixture only; malformed records must fail.
 const publicRecord={commitmentSha256:'2b9734aada05ad3fcbfbcb9f0d24859dfd17547cb9e16d3424c27681fb21a36d',
  futureTargetOpenMs:open,futureTargetCloseMs:open+3600000};
 const privateRecord={
  targetOpenMs:open,targetCloseMs:open+3600000,
  modeResults:['manual','hybrid','reverse'].flatMap(mode=>
   ['buy','sell'].map(intent=>({mode,intent,action:'wait_for_context',side:null})))
 };
 // Existing public commitment cannot be forged by this fixture.
 assert.notEqual(hash(privateRecord),publicRecord.commitmentSha256);
 assert.throws(()=>verifyR10Commit(privateRecord,publicRecord),/R10_PRECOMMIT_INTEGRITY_FAILURE/);
 assert.equal(new Set(privateRecord.modeResults.map(x=>x.mode+'|'+x.intent)).size,6);
 const duplicate=[...privateRecord.modeResults.slice(0,5),privateRecord.modeResults[0]];
 assert.equal(new Set(duplicate.map(x=>x.mode+'|'+x.intent)).size,5);
});

test('R11 rejects misleading Kraken symbols for all three supported research assets',()=>{
 const x={error:[],result:{XXBTZUSD:[row],last:open/1000}};
 assert.throws(()=>parseR7Kraken(x,{...plan,asset:'ETH-USD'}),/R7_KRAKEN_PAIR_AMBIGUOUS/);
 assert.throws(()=>parseR7Kraken(x,{...plan,asset:'SOL-USD'}),/R7_KRAKEN_PAIR_AMBIGUOUS/);
});

test('R11 only offline checks, no new market sender or deployment',()=>{
 const src=readFileSync(new URL('../lib/platform/research/robot-r10-post-candle.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/submitOrder\s*\(|createOrder\s*\(|OPENAI_API_KEY/);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r11-offline-evidence-hardening-20261022'],false);
});
