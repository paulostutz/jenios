import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const names=['books','exchange-rules','token-venue','risk','microstructure','validation','operations','gate'];
test('R112 modules contain no direct broker transport, dynamic network, account credentials',()=>{
 for(const n of names){
  const s=readFileSync(new URL(`../lib/platform/research/ultrafast-v3-${n}.mjs`,import.meta.url),'utf8');
  assert.doesNotMatch(s,/\bfetch\s*\(|\bWebSocket\s*\(|submitOrder\s*\(|createOrder\s*\(|process\.env|API_SECRET|PRIVATE_KEY/i,n);
 }
});