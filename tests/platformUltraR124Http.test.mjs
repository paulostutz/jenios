import test from 'node:test';
import assert from 'node:assert/strict';
import {devicesHttp} from '../lib/platform/ultra/operations-http.mjs';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const now=()=>new Date('2026-11-10T15:00:00Z');
function database({devices=[{id,label:'Conta 1',provider:'binance',environment:'demo'}],count=0,data=[]}={}){
 const calls=[];return {calls,auth:{getUser:async()=>({data:{user:{id:'authenticated-owner'}}})},from(table){
  const filters=[];return {select(columns,opts){calls.push({table,columns,opts,filters});const query={eq(k,v){filters.push([k,v]);return query},order(){return query},limit:async()=>table==='jenios_ultra_devices'?{data:devices}:{data,count}};return query}};
 }};
}
const request=deviceId=>new Request('https://www.jenios.com.br/api/platform/ultra/devices?environment=demo&period=all&deviceId='+deviceId,{headers:{authorization:'Bearer '+'x'.repeat(24)}});
test('R124 per-account report binds both table queries to authenticated owner and selected device',async()=>{
 const db=database();const r=await devicesHttp(request(id),{getAdmin:()=>db,now});assert.equal(r.status,200);const body=await r.json();assert.equal(body.report.accountScope,'single_sync_connection');assert.deepEqual(body.report.totals,[]);assert.ok(db.calls.every(c=>c.filters.some(([k,v])=>k==='user_id'&&v==='authenticated-owner')));assert.ok(db.calls[1].filters.some(([k,v])=>k==='device_id'&&v===id));
});
test('R124 device of another user/environment is rejected before reading operations',async()=>{
 const db=database();const r=await devicesHttp(request(other),{getAdmin:()=>db,now});assert.equal(r.status,404);assert.equal(db.calls.length,1);
});
test('R124 truncated data or absent exact count never yields misleading totals',async()=>{
 for(const count of [null,1,5001]){const db=database({count});const r=await devicesHttp(request(id),{getAdmin:()=>db,now});assert.equal(r.status,503);assert.equal((await r.json()).report,undefined);}
});
test('R124 absent/invalid session cannot read even a known device',async()=>{
 let queried=false;const db={auth:{getUser:async()=>({error:Error('expired')})},from(){queried=true;throw Error()}};
 const r=await devicesHttp(request(id),{getAdmin:()=>db,now});assert.equal(r.status,401);assert.equal(queried,false);
});
