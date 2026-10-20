import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal,transmitReservedAlpacaPaperOrder} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const nowMs=1792525000000;
const env={VERCEL_ENV:'preview',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'};
const storedConnection={id:'50b85e9d-339c-4d32-b2bf-82c467673832',user_id:user,provider:'alpaca',environment:'paper',status:'active',
 external_digest:'d'.repeat(64),last_sync_at:new Date(nowMs-1000).toISOString(),identity_verified:true};
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const mode='direct';
const signal={originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode,side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'};
const order={clientOrderId:'paper-entry-001',mode,side:'buy',symbol:'AAPL',quantity:'1',entry:'100',stop:'99',target:'103'};
const source={provider:'alpaca',environment:'paper',accountDigest:storedConnection.external_digest,
 accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,
 prospective:true,liveAccount:false,serverVerified:true};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',contractSize:'1',qtyStep:'1',minQty:'1',
 maxQty:'100',tickSize:'0.01',capturedAtMs:nowMs-1000,sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:nowMs-500,sourceAtMs:nowMs-750,bid:'99.99',ask:'100.01'};
const costs={roundTripFeeBps:0,slippageBps:0,fundingCost:'0'};
const input={session,storedConnection,mode,signal,order,source,meta,quote,costs,nowMs};
const limits={currency:'USD',ownerRisk:'6',accountRisk:'5',orderRisk:'3',notional:'1000',dailyLoss:'6',maxOrders:4};
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'jenios-alpaca-risk-')),ledger=new PaperLedger(join(dir,'ledger.db'));
 try{const conn=alpacaPaperLedgerConnection(user,storedConnection,{env,now:nowMs});ledger.configure(session,conn,limits);return fn(ledger,conn);}
 finally{ledger.close();rmSync(dir,{recursive:true,force:true});}}
const reserve=(ledger,patch={})=>reserveAlpacaPaperProposal({...input,...patch},{ledger,env});

test('B175 Alpaca PAPER is the sole added B152 provider without weakening Live gates',()=>{
 const b=alpacaPaperLedgerConnection(user,storedConnection,{env,now:nowMs});
 assert.equal(b.provider,'alpaca');assert.equal(b.environment,'paper');assert.deepEqual(b.permissions,['read']);
 for(const c of [{...storedConnection,environment:'live'}, {...storedConnection,environment:'demo'},
   {...storedConnection,user_id:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'}, {...storedConnection,status:'revoked'},
   {...storedConnection,identity_verified:false}, {...storedConnection,last_sync_at:new Date(nowMs-300001).toISOString()}]){
  assert.throws(()=>alpacaPaperLedgerConnection(user,c,{env,now:nowMs}));
 }
 assert.throws(()=>alpacaPaperLedgerConnection(user,storedConnection,{env:{...env,VERCEL_ENV:'production'},now:nowMs}),/PRIVATE_REHEARSAL_DISABLED/);
 assert.throws(()=>alpacaPaperLedgerConnection(user,storedConnection,{env:{...env,JENIOS_PRIVATE_PAPER_REHEARSAL:'false'},now:nowMs}),/PRIVATE_REHEARSAL_DISABLED/);
});
test('B175 original risk ledger reserves protected Alpaca Paper draft with no broker API transport',()=>fixture((ledger,c)=>{
 const r=reserve(ledger);
 assert.equal(r.riskState,'RESERVED');assert.equal(r.duplicate,false);
 assert.equal(r.nativeProposal.body.order_class,'bracket');assert.equal(r.nativeProposal.body.client_order_id,order.clientOrderId);
 assert.equal(r.nativeProposal.canSubmit,false);assert.equal(r.ordersSent,0);assert.equal(r.realExecution,false);
 assert.equal(r.risk.risk,'1');assert.equal(ledger.snapshot(session,c)[0].held,units('1').toString());
 assert.throws(()=>transmitReservedAlpacaPaperOrder(),/PAPER_TRANSPORT_NOT_CERTIFIED/);
}));
test('B175 duplicate client_order_id is idempotent; never yields an order that could be resubmitted',()=>fixture((ledger,c)=>{
 reserve(ledger);const r=reserve(ledger);
 assert.equal(r.duplicate,true);assert.equal(r.nativeProposal,null);assert.equal(r.ordersSent,0);
 assert.equal(ledger.snapshot(session,c).length,1);
 assert.throws(()=>reserve(ledger,{order:{...order,quantity:'2'}}),/IDEMPOTENCY_CONFLICT/);
}));
test('B175 invalid permissions, stale quotes, wrong mode or untrusted market inputs are blocked before booking',()=>fixture((ledger,c)=>{
 const invalid=[{source:{...source,serverVerified:false}}, {source:{...source,permissionsVerified:false}},
  {source:{...source,accountDigest:'e'.repeat(64)}}, {storedConnection:{...storedConnection,user_id:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'}},
  {meta:{...meta,provider:'ctrader'}},{meta:{...meta,marketType:'linear'}},{quote:{...quote,receivedAtMs:nowMs-6500}},
  {mode:'reverse'}, {session:{...session,diagnosticCompleted:false}}, {order:{...order,side:'sell',stop:'101',target:'97'},signal:{...signal,side:'sell'}}];
 for(const patch of invalid)assert.throws(()=>reserve(ledger,patch),JSON.stringify(Object.keys(patch)));
 assert.equal(ledger.snapshot(session,c).length,0);
}));
test('B175 live, missing ledger and wrong owner never reserve risk',()=>fixture((ledger,c)=>{
 assert.throws(()=>reserveAlpacaPaperProposal(input,{ledger,env:{...env,VERCEL_ENV:'production'}}),/PRIVATE_REHEARSAL_DISABLED/);
 assert.throws(()=>reserveAlpacaPaperProposal(input,{env}),/DURABLE_LEDGER_REQUIRED/);
 assert.throws(()=>reserve(ledger,{session:{...session,userId:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'}}),/BROKER_OWNER_MISMATCH/);
 assert.equal(ledger.snapshot(session,c).length,0);
}));
test('B175 reserved exposure persists across a SQLite worker restart with no orders submitted',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-alpaca-restart-')),path=join(dir,'ledger.db');let ledger=new PaperLedger(path);
 try{
  const c=alpacaPaperLedgerConnection(user,storedConnection,{env,now:nowMs});ledger.configure(session,c,limits);reserve(ledger);
  ledger.close();ledger=new PaperLedger(path);assert.equal(ledger.snapshot(session,c).length,1);assert.equal(ledger.snapshot(session,c)[0].state,'RESERVED');
 }finally{ledger.close();rmSync(dir,{recursive:true,force:true});}
});
