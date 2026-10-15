import test from 'node:test';import assert from 'node:assert/strict';
import {createWhaleService,mergeWhaleHistory} from '../lib/whale-transfers.mjs';
import {visibleTrendRows,trendDetail} from '../lib/trends-ui.mjs';
import {createSocialFeedClient} from '../lib/social/feed-client.mjs';
const now=Date.parse('2026-10-15T20:00:00Z');
const event=(n,minutes)=>({id:n.toString(16).padStart(64,'0'),data:new Date(now-minutes*60000).toISOString(),quantidade:100+n});
const response=async url=>({ok:true,json:async()=>url.endsWith('/blocks')?[{id:'a'.repeat(64),tx_count:1,timestamp:now/1000-60}]:[]});
test('whale fallback loads exactly last three confirmed records, time ordered across a cold start',async()=>{
 const history={read:async()=>[event(1,45),event(2,60),event(3,30),event(4,50)],save:async()=>assert.fail('no new event')};
 const load=createWhaleService({now:()=>now,fetchImpl:response});const result=await load({history});
 assert.equal(result.status.historico,true);assert.deepEqual(result.rows.map(x=>x.id),[event(3,30).id,event(1,45).id,event(4,50).id]);assert(result.rows.every(x=>trendDetail('baleias',x).includes('15/10/2026')));
});
test('provider outage keeps stored last three and marks them historical',async()=>{
 const load=createWhaleService({now:()=>now,fetchImpl:async()=>{throw Error('offline')}});
 const result=await load({history:{read:async()=>[event(1,45),event(2,60),event(3,30)]}});
 assert.equal(result.rows.length,3);assert.equal(result.status.historico,true);assert.equal(result.status.stale,true);
});
test('history rejects forged IDs, future timestamps, small values and duplicate movements',()=>{
 assert.equal(mergeWhaleHistory([event(1,5),event(1,5),{...event(2,2),id:'bad'},event(3,-1),{...event(4,2),quantidade:1}],now).length,1);
});
test('MegaPulse UI hides expired rows even when a prior response is retained',()=>{
 const data={megapulse:[{preco:100,variacao:1,negociadoEm:new Date(now-120001).toISOString()},{preco:90,variacao:-1,negociadoEm:new Date(now-10000).toISOString()}]};
 assert.equal(visibleTrendRows('megapulse',data,now).length,1);assert.equal(visibleTrendRows('megapulse',data,now+130000).length,0);
});
test('archive client sends an explicit owner action and restore action, not a bookmark',async()=>{
 const calls=[];const c=createSocialFeedClient({getAccessToken:async()=>'fixture',fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({posts:[]})}}});
 await c.archive('post',true);await c.archive('post',false);await c.listArchived(20);
 assert.deepEqual(JSON.parse(calls[0].options.body),{postId:'post',archived:true});assert.equal(JSON.parse(calls[1].options.body).archived,false);assert(calls[2].url.endsWith('archive?offset=20'));
});
test('compact block totals are only candidates; displayed movement requires a matching full transaction and large output',async()=>{
 const ids=[1,2,3].map(n=>n.toString().padStart(64,'0'));let saved=[];
 const load=createWhaleService({now:()=>now,fetchImpl:async url=>({ok:true,json:async()=>{
  if(url.endsWith('/blocks'))return [{id:'a'.repeat(64),tx_count:3,timestamp:now/1000-60}];
  if(url.endsWith('/summary'))return ids.map(txid=>({txid,value:200e8}));
  const id=url.split('/').at(-1);return {txid:id===ids[2]?'f'.repeat(64):id,status:{confirmed:true,block_time:now/1000-60},vin:[{}],vout:id===ids[1]?[{value:80e8},{value:80e8}]:[{value:150e8}]};
 }})});
 const result=await load({history:{read:async()=>[],save:async rows=>{saved=rows;}}});assert.equal(result.rows.length,1);assert.equal(result.rows[0].quantidade,150);assert.equal(saved.length,1);assert.equal(result.status.parcial,true);
});
