import test from 'node:test';import assert from 'node:assert/strict';
import {connectDemo,listDemoConnections,syncDemo,revokeDemo,DEMO_CONSENT,demoEnabled} from '../lib/platform/connections/demo-service.mjs';
import {demoHttp} from '../lib/platform/connections/demo-http.mjs';
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',other='b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496',id1='50b85e9d-339c-4d32-b2bf-82c467673832',id2='60b85e9d-339c-4d32-b2bf-82c467673832';
const env={JENIOS_DEMO_CONNECTORS_ENABLED:'true',VERCEL_ENV:'preview',JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,7).toString('base64')};
const credentials={provider:'alpaca',environment:'paper',apiKey:'fixture_api_01234567890123',secret:'fixture_secret_01234567890123',confirmation:DEMO_CONSENT};
let time=1792521600000;let change=false;let changeIdentity=false;
const reader=async(input,{now})=>{
 const timestamp=now();const snapshot={provider:input.provider,environment:input.environment,observedAtMs:timestamp,complete:true,accountReadConfirmed:true,
  positions:[{key:'position-1',symbol:'AAPL',side:'long',quantity:change?'2':'1'}],
  openOrders:change?[]:[{key:'order-1',symbol:'AAPL',side:'buy',status:'new',quantity:'1',filledQuantity:'0'}]};
 return {accountRef:changeIdentity?'wrong-account':'stable-demo-account',identityVerified:true,snapshot,
  observation:{ok:true,provider:input.provider,environment:input.environment,accountReadConfirmed:true,summary:{permissionsVerified:false},linkedToJenios:false,liveExecution:false,ordersSent:0,credentialsStored:false,observedAtMs:timestamp}};
};
class Store{
 constructor(){this.rows=new Map();this.attempts=new Map();}
 async claimConnectAttempt(owner,provider){const k=owner+'|'+provider;if(this.attempts.has(k)&&time-this.attempts.get(k)<60000)return false;this.attempts.set(k,time);return true;}
 async list(owner){return [...this.rows.values()].filter(r=>r.user_id===owner).map(r=>structuredClone(r));}
 async findByScope(owner,p,e){return [...this.rows.values()].find(r=>r.user_id===owner&&r.provider===p&&r.environment===e)||null;}
 async findById(owner,id){const r=this.rows.get(id);return r?.user_id===owner?structuredClone(r):null;}
 async insert(row){if([...this.rows.values()].some(r=>r.user_id===row.user_id&&r.provider===row.provider&&r.environment===row.environment))throw Object.assign(Error('conflict'),{status:503});this.rows.set(row.id,structuredClone(row));return structuredClone(row);}
 async removeRevoked(owner,id){const row=this.rows.get(id);if(row?.user_id===owner&&row.status==='revoked'){this.rows.delete(id);return true;}return false;}
 async claimSync(owner,row,nowIso,lease){const r=this.rows.get(row.id);if(!r||r.user_id!==owner||r.revision!==row.revision||r.status!=='active'||Date.parse(r.sync_lease_until)>=Date.parse(nowIso))return false;this.rows.set(r.id,{...r,revision:r.revision+1,sync_lease_until:lease});return true;}
 async finishSync(owner,row,changes){const r=this.rows.get(row.id);if(!r||r.user_id!==owner||r.status!=='active'||r.revision!==row.revision+1)return false;this.rows.set(r.id,{...r,...changes,revision:r.revision+1,sync_lease_until:'1970-01-01T00:00:00.000Z'});return true;}
 async releaseSync(owner,row,code){const r=this.rows.get(row.id);if(!r||r.user_id!==owner||r.status!=='active'||r.revision!==row.revision+1)return false;this.rows.set(r.id,{...r,last_error_code:code,revision:r.revision+1,sync_lease_until:'1970-01-01T00:00:00.000Z'});return true;}
 async revoke(owner,row){const r=this.rows.get(row.id);if(!r||r.user_id!==owner||r.status!=='active')return false;this.rows.set(r.id,{...r,status:'revoked',credential_box:null,snapshot_box:null,external_digest:null,position_count:0,open_order_count:0,revision:r.revision+2});return true;}
}
const store=new Store();
const opts={store,env,reader,uuid:()=>id1,now:()=>time};
test('B167 can only connect Testnet/Paper after authenticated read, encrypts secrets, binds one Platform user',async()=>{
 const result=await connectDemo(user,credentials,opts);
 assert.equal(result.connectedForReadOnlyDemo,true);assert.equal(result.permissionsVerified,false);assert.equal(result.liveExecution,false);
 const data=store.rows.get(id1);assert.equal(data.user_id,user);assert.equal(data.external_digest.length,64);
 assert.ok(!JSON.stringify(data).includes(credentials.secret));assert.ok(!JSON.stringify(data).includes('stable-demo-account'));
 assert.ok(!JSON.stringify(result).includes(credentials.secret));
 const list=await listDemoConnections(user,opts);assert.equal(list.length,1);
 assert.deepEqual(await listDemoConnections(other,opts),[]);
 await assert.rejects(connectDemo(user,credentials,opts),/EXISTING_DEMO_CONNECTION/);
 await assert.rejects(connectDemo(other,{...credentials,environment:'live'},opts),/LIVE_DISABLED/);
});
test('B167 compare order changes after interval without assigning fills',async()=>{
 await assert.rejects(syncDemo(user,id1,opts),/SYNC_INTERVAL_120_SECONDS/);
 time+=120001;change=true;
 const {connection,reconciliation}=await syncDemo(user,id1,opts);
 assert.equal(connection.openOrderCount,0);assert.equal(reconciliation.missingOpenOrders,1);
 assert.equal(reconciliation.cannotInferFillOrClose,true);assert.equal(reconciliation.reviewRequired,true);
 assert.equal(connection.liveExecution,false);
});
test('B167 new account fingerprint cannot hijack existing connection; revocation eliminates encrypted key',async()=>{
 time+=120001;changeIdentity=true;
 await assert.rejects(syncDemo(user,id1,opts),/EXTERNAL_ACCOUNT_CHANGED/);
 const saved=store.rows.get(id1);assert.equal(saved.last_error_code,'EXTERNAL_ACCOUNT_CHANGED');
 await assert.rejects(syncDemo(other,id1,opts),/CONNECTION_NOT_FOUND/);
 const revoked=await revokeDemo(user,id1,opts);assert.equal(revoked.providerRevocationRequired,true);
 const data=store.rows.get(id1);assert.equal(data.status,'revoked');assert.equal(data.credential_box,null);assert.equal(data.snapshot_box,null);
 await assert.rejects(syncDemo(user,id1,opts),/CONNECTION_NOT_FOUND/);
 const again=await revokeDemo(user,id1,opts);assert.equal(again.revoked,true);
});
test('B167 reconnection needs fresh authorization, previous tombstone not reused',async()=>{
 changeIdentity=false;change=false;
 time+=60001;const newer=await connectDemo(user,credentials,{...opts,uuid:()=>id2});
 assert.equal(newer.id,id2);assert.equal(store.rows.has(id1),false);assert.equal(store.rows.get(id2).status,'active');
});
test('B167 production explicitly disabled even with feature flag',()=>{
 assert.equal(demoEnabled({...env,VERCEL_ENV:'production'}),false);
 assert.equal(demoEnabled({...env,JENIOS_DEMO_CONNECTORS_ENABLED:'false'}),false);
 assert.equal(demoEnabled({...env,JENIOS_DEMO_VAULT_KEY_B64:''}),false);
});
const fakeAdmin={auth:{getUser:async token=>({data:{user:{id:token.endsWith('b')?other:user,is_anonymous:false}},error:null})}};
const token='tokenxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
function req(method,url,body,headers={}){return new Request(url,{method,headers:{authorization:'Bearer '+token,origin:'https://jenios.example',...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});}
const dep={env,getAdmin:()=>fakeAdmin,getStore:()=>store,reader,uuid:()=>id1,now:()=>time};
test('B168 HTTP API verifies bearer and origin; returns only scoped summaries',async()=>{
 const url='https://jenios.example/api/platform/broker-connections';
 const r=await demoHttp(req('GET',url),'list',dep);assert.equal(r.status,200);const x=await r.json();assert.ok(x.connections.length===1);assert.ok(!JSON.stringify(x).includes(credentials.secret));
 const anonymous=await demoHttp(new Request(url),'list',dep);assert.equal(anonymous.status,401);
 const foreign=await demoHttp(req('POST',url,credentials,{origin:'https://foreign.example'}),'create',dep);assert.equal(foreign.status,403);
 const forbiddenProd=await demoHttp(req('GET',url),'list',{...dep,env:{...env,VERCEL_ENV:'production'}});assert.equal(forbiddenProd.status,404);
 const malformed=await demoHttp(req('POST',url,credentials,{'content-type':'text/plain'}),'create',dep);assert.equal(malformed.status,415);
});
