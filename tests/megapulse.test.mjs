import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFutures,createMegaPulse} from '../lib/megapulse.mjs';
const now=Date.parse('2026-10-15T20:00:00Z');
const row={symbol:'WINZ26',underlyingAsset:'WIN',expirationDate:'2026-12-16',close:200000,volume:100,oscillationPct:-1,date:Date.parse('2026-10-14')/1000};
test('rejects expired, stale, invalid and mismatched contracts',()=>{
 const bad=[{...row,close:null},{...row,date:0},{...row,date:now/1000+10},{...row,expirationDate:'2026-10-01'},{...row,underlyingAsset:'WDO'}];
 assert.equal(normalizeFutures({asset:'WIN',contracts:bad},'WIN',now).length,0);
 assert.equal(normalizeFutures({asset:'WIN',contracts:[row]},'WIN',now)[0].dataPregao,'2026-10-14');
 assert.throws(()=>normalizeFutures({asset:'WDO',contracts:[row]},'WIN',now));
});
test('partial response and shared bounded cache',async()=>{
 let count=0;const load=createMegaPulse({now:()=>now,env:{},fetchImpl:async u=>{count++;if(u.endsWith('WDO'))throw Error('offline');return {ok:true,json:async()=>({asset:'WIN',contracts:[row]})};}});
 const [a,b]=await Promise.all([load(),load()]);assert.equal(count,2);assert.equal(a.rows.length,1);assert.equal(a.status.parcial,true);assert.deepEqual(a,b);
 a.rows.length=0;assert.equal((await load()).rows.length,1);assert.equal(count,2);
});
