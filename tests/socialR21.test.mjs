import test from 'node:test';
import assert from 'node:assert/strict';
import {storyIsActive,storyExpiry} from '../lib/social/story-lifetime.mjs';
import {normalizeWhaleTransfers,createWhaleService} from '../lib/whale-transfers.mjs';
import {createSocialFeedClient} from '../lib/social/feed-client.mjs';
const now=Date.parse('2026-10-15T20:00:00Z');
test('Story expires exactly at 24h, even if provider expiry is later',()=>{
 const s={criadoEm:new Date(now-86400000).toISOString(),expiresAt:new Date(now+86400000).toISOString()};
 assert.equal(storyExpiry(s),now);assert.equal(storyIsActive(s,now-1),true);assert.equal(storyIsActive(s,now),false);
 assert.equal(storyIsActive({criadoEm:new Date(now+1).toISOString()},now),false);
 assert.equal(storyIsActive({criadoEm:'invalid'},now),false);
});
const tx=(n,value=100e8)=>({txid:String(n).padStart(64,'0'),status:{confirmed:true,block_time:now/1000-60},vin:[{}],vout:[{value}]});
test('Whales accepts confirmed large Bitcoin outputs, rejects coinbase, stale, small and duplicate records',()=>{
 const good=tx(1);const coinbase=tx(2);coinbase.vin=[{is_coinbase:true}];const stale=tx(3);stale.status.block_time=now/1000-86401;
 const unconfirmed=tx(4);unconfirmed.status.confirmed=false;
 const result=normalizeWhaleTransfers([good,good,coinbase,stale,unconfirmed,tx(5,99e8)],now);
 assert.equal(result.length,1);assert.equal(result[0].quantidade,100);assert(!('instituicao' in result[0]));
});
test('Whale samples share in-flight requests and report valid zero matches',async()=>{
 let calls=0;const read=createWhaleService({now:()=>now,fetchImpl:async url=>{calls++;return {ok:true,json:async()=>url.endsWith('/blocks')?[{id:'a'.repeat(64),tx_count:2,timestamp:now/1000-60,height:1}]:[tx(1,1e8)]};}});
 const [a,b]=await Promise.all([read(),read()]);assert.equal(calls,2);assert.equal(a.status.disponivel,true);assert.deepEqual(a.rows,[]);a.status.disponivel=false;assert.equal(b.status.disponivel,true);await read();assert.equal(calls,2);
});
test('Whale provider failure stays unavailable instead of a fake zero result',async()=>{
 const read=createWhaleService({fetchImpl:async()=>({ok:false})});assert.equal((await read()).status.disponivel,false);
});
test('Feed batches likes once and story sharing transmits only the original post ID',async()=>{
 const calls=[];const c=createSocialFeedClient({getAccessToken:async()=>'fixture',fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({stats:[]})}}});
 await c.likesBatch(['a','b']);await c.createStory({postId:'original'});assert.equal(calls.length,2);assert(calls[0].url.includes('ids=a%2Cb'));assert.deepEqual(JSON.parse(calls[1].options.body),{postId:'original'});
});
