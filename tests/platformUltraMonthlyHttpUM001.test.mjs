import test from 'node:test';
import assert from 'node:assert/strict';
import {devicesHttp} from '../lib/platform/ultra/operations-http.mjs';
import {initialOperation} from '../lib/platform/ultra/operation.mjs';

const deviceId='11111111-1111-4111-8111-111111111111';
const otherDevice='22222222-2222-4222-8222-222222222222';
const ownerId='synthetic-authenticated-owner';
const bearer='synthetic-session-token-0123456789';
const now=()=>new Date('2026-11-10T15:00:00Z');
const defaultDevice={id:deviceId,label:'Conta fictícia',provider:'binance',market:'crypto',environment:'demo'};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function operation(id,{day='2026-10-15',market='crypto',currency='BRL',gross='1500',fees='100',costsComplete=true,...patch}={}){
  const t=Date.parse(day+'T12:00:00Z');
  return {...initialOperation({market,symbol:market==='b3'?'WINZ26':'BTCBRL',currency,side:'buy',quantity:'1'},id,t),
    state:'closed',openedAt:new Date(t).toISOString(),closedAt:new Date(t+60000).toISOString(),updatedAt:new Date(t+60000).toISOString(),
    entryQuantity:'1',exitQuantity:'1',entryPrice:'100',exitPrice:'110',gross,fees,financing:'0',costsComplete,
    brokerRefs:['synthetic-ref-'+id],...patch};
}
function database({devices=[defaultDevice],operations=[],count=operations.length,authResult={data:{user:{id:ownerId}}}}={}){
  const calls=[],authCalls=[],mutations=[],rpcCalls=[];
  const result={calls,authCalls,mutations,rpcCalls,auth:{async getUser(token){authCalls.push(token);return authResult;}},from(table){
    const call={table,columns:null,options:null,filters:[],limit:null};calls.push(call);
    const query={
      select(columns,options){call.columns=columns;call.options=options;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},order(){return query;},
      async limit(limit){call.limit=limit;return table==='jenios_ultra_devices'?{data:devices}:{data:operations.map(payload=>({payload})),count};},
      insert(){mutations.push('insert');throw Error('Unexpected mutation');},
      update(){mutations.push('update');throw Error('Unexpected mutation');},
      delete(){mutations.push('delete');throw Error('Unexpected mutation');},
    };return query;
  },async rpc(name,args){rpcCalls.push({name,args});return {data:{legacy:true}};}};
  return result;
}
function request({month='2026-10',selected=deviceId,period='all',page=0,authorization='Bearer '+bearer,extra=''}={}){
  const query=new URLSearchParams({environment:'demo',period,page:String(page)});
  if(selected!==null)query.set('deviceId',selected);
  if(month!==null)query.set('month',month);
  return new Request('https://www.jenios.com.br/api/platform/ultra/devices?'+query+extra,{headers:authorization?{authorization}:{}});
}
async function get(db,options={}){const response=await devicesHttp(request(options),{getAdmin:()=>db,now});return {status:response.status,body:await response.json(),headers:response.headers};}

test('UM001 monthly GET reuses the complete scoped read independently of legacy period/page',async()=>{
  const operations=[operation('gain'),operation('loss',{gross:'-300',fees:'100'}),operation('september',{day:'2026-09-15',gross:'9000'}),operation('november',{day:'2026-11-05',gross:'9000'})];
  const db=database({operations}),result=await get(db,{period:'7d',page:1});
  assert.equal(result.status,200);assert.deepEqual(result.body.report.operations,[]);
  const m=result.body.report.monthly,g=m.groups[0];
  assert.equal(m.month,'2026-10');assert.equal(m.timeZone,'America/Bahia');assert.equal(m.periodClosed,true);
  assert.equal(m.periodStart,'2026-10-01T03:00:00.000Z');assert.equal(m.periodEnd,'2026-11-01T03:00:00.000Z');
  assert.equal(g.counts.closed,2);assert.equal(g.confirmed.gains,'1500.00000000');assert.equal(g.confirmed.losses,'300.00000000');
  assert.equal(g.confirmed.fees,'200.00000000');assert.equal(g.confirmed.net,'1000.00000000');
  assert.deepEqual(g.operations.map(o=>o.id).sort(),['gain','loss']);
  assert.equal(db.calls.length,2);assert.equal(db.rpcCalls.length,0);
  assert.deepEqual(db.calls[1].options,{count:'exact'});assert.equal(db.calls[1].limit,5001);
  assert.equal(result.body.sourceReport,undefined);assert.equal(result.body.report.sourceReport,undefined);
  assert.equal(result.headers.get('cache-control'),'private, no-store');
});

test('UM001 pending costs remain provisional and are excluded from confirmed monthly result',async()=>{
  const db=database({operations:[operation('closed'),operation('costs-pending',{gross:'500',fees:null,costsComplete:false})]});
  const {status,body}=await get(db);assert.equal(status,200);const g=body.report.monthly.groups[0];
  assert.equal(g.counts.closed,1);assert.equal(g.counts.awaitingCosts,1);
  assert.equal(g.confirmed.net,'1400.00000000');assert.equal(g.provisional.gross,'500.00000000');
  assert.equal(g.provisional.fees,null);assert.equal(g.provisional.net,null);assert.equal(g.finalNet,null);
  assert.ok(g.pendingReasons.some(r=>r.code==='COSTS_PENDING'));
  assert.equal(body.report.monthly.billable,false);assert.equal(body.report.monthly.debitExecuted,false);
});

test('UM001 monthly GET preserves getUser and both owner/device filters without financial identity inference',async()=>{
  const db=database({operations:[operation('closed')]});const {status,body}=await get(db);
  assert.equal(status,200);assert.deepEqual(db.authCalls,[bearer]);
  assert.ok(db.calls.every(c=>c.filters.some(([key,value])=>key==='user_id'&&value===ownerId)));
  assert.ok(db.calls[1].filters.some(([key,value])=>key==='device_id'&&value===deviceId));
  assert.equal(body.report.monthly.accountFingerprint,null);assert.equal(body.report.monthly.groups[0].accountFingerprint,null);
  assert.equal(body.report.monthly.sourceComplete,false);assert.equal(body.report.monthly.independentlyVerified,false);
  assert.ok(body.report.monthly.groups[0].pendingReasons.some(r=>r.code==='ACCOUNT_IDENTITY_PENDING'));
});

test('UM001 invalid or unscoped month is rejected after authentication and before data reads',async()=>{
  for(const options of [
    {month:'2026-13'},{month:'2026-1'},{month:''},{month:'1969-12'},{month:'2201-01'},
    {selected:null},{extra:'&month=2026-09'},
  ]){const db=database();const {status}=await get(db,options);assert.equal(status,400);assert.deepEqual(db.authCalls,[bearer]);assert.equal(db.calls.length,0);assert.equal(db.rpcCalls.length,0);}
});

test('UM001 omitted month selects the current month with the explicit Bahia timezone',async()=>{
  const db=database({operations:[operation('november',{day:'2026-11-05'}),operation('october')]});
  const {status,body}=await get(db,{month:null});assert.equal(status,200);assert.equal(body.report.monthly.month,'2026-11');
  assert.equal(body.report.monthly.periodClosed,false);assert.deepEqual(body.report.monthly.groups[0].operations.map(o=>o.id),['november']);
});

test('UM001 auth failure, anonymous session and missing bearer never reach history',async()=>{
  for(const authResult of [{error:Error('expired')},{data:{user:{id:ownerId,is_anonymous:true}}},{data:{user:null}}]){
    const db=database({authResult});assert.equal((await get(db)).status,401);assert.equal(db.calls.length,0);assert.equal(db.rpcCalls.length,0);
  }
  const db=database();assert.equal((await get(db,{authorization:null})).status,401);assert.equal(db.authCalls.length,0);assert.equal(db.calls.length,0);
});

test('UM001 truncated, absent-count or over-limit history retains 503 and emits no monthly totals',async()=>{
  for(const count of [null,2,5001]){
    const db=database({operations:[operation('closed')],count}),{status,body}=await get(db);
    assert.equal(status,503);assert.equal(body.report,undefined);assert.equal(body.monthly,undefined);
  }
});

test('UM001 another connection or environment remains inaccessible before operations are read',async()=>{
  for(const settings of [{},{devices:[{...defaultDevice,environment:'live'}]}]){
    const db=database(settings),{status}=await get(db,settings.devices?{}:{selected:otherDevice});
    assert.equal(status,404);assert.equal(db.calls.length,1);
  }
});

test('UM001 preserves R125 MT5/B3 validation and never guesses its market',async()=>{
  const devices=[{...defaultDevice,provider:'mt5',market:'b3'}];
  const db=database({devices,operations:[operation('win',{market:'b3'})]}),{status,body}=await get(db);
  assert.equal(status,200);assert.equal(body.report.provider,'mt5');assert.equal(body.report.monthly.provider,'mt5');
  assert.equal(body.report.monthly.groups[0].operations[0].market,'b3');
  const mismatch=database({devices,operations:[operation('crypto')]});assert.equal((await get(mismatch)).status,503);
});

test('UM001 GET is read-only for frozen fixtures and does not add database/RPC mutations',async()=>{
  const operations=freeze([operation('closed'),operation('pending',{costsComplete:false,fees:null})]),devices=freeze([{...defaultDevice}]);
  const before=JSON.stringify({operations,devices}),db=database({operations,devices});
  assert.equal((await get(db)).status,200);assert.equal(JSON.stringify({operations,devices}),before);
  assert.deepEqual(db.mutations,[]);assert.deepEqual(db.rpcCalls,[]);
  const legacy=database();const response=await get(legacy,{month:null,selected:null});
  assert.equal(response.status,200);assert.deepEqual(response.body.report,{legacy:true});
  assert.equal(legacy.rpcCalls.length,1);assert.equal(legacy.rpcCalls[0].name,'jenios_ultra_operations_report');
});

test('UM001 empty month stays empty without an invented zero balance or result',async()=>{
  const {status,body}=await get(database());assert.equal(status,200);assert.deepEqual(body.report.monthly.groups,[]);
  assert.equal(body.report.monthly.walletBalance,null);assert.equal(body.report.monthly.sourceComplete,false);
});

test('UM001 sends all selected-month operations for local pagination without the full raw history',async()=>{
  const operations=[...Array.from({length:61},(_,i)=>operation('october-'+i,{gross:'10',fees:'1'})),
    ...Array.from({length:20},(_,i)=>operation('september-'+i,{day:'2026-09-15',gross:'99'}))];
  const db=database({operations}),{status,body}=await get(db);assert.equal(status,200);
  assert.equal(body.report.operations.length,50);assert.equal(body.report.monthly.groups[0].operations.length,61);
  assert.equal(body.report.monthly.groups[0].confirmed.net,'549.00000000');
  assert.ok(body.report.monthly.groups[0].operations.every(o=>o.id.startsWith('october-')));
  assert.equal(db.calls.length,2);assert.equal(db.rpcCalls.length,0);
});
