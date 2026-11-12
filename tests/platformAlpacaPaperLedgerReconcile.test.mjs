import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {reconcileOwnAlpacaPaperLedger,resubmitAmbiguousPaperOrder} from '../lib/platform/connections/alpaca-paper-ledger-reconcile.mjs';
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',now=1792526000000;
const env={VERCEL_ENV:'preview',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'};
const storedConnection={id:'50b85e9d-339c-4d32-b2bf-82c467673832',user_id:user,provider:'alpaca',environment:'paper',status:'active',
 external_digest:'f'.repeat(64),last_sync_at:new Date(now-800).toISOString(),created_at:new Date(now-100).toISOString(),identity_verified:true};
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const order={clientOrderId:'ord_b176',mode:'direct',side:'buy',symbol:'AAPL',quantity:'1',entry:'100',stop:'98',target:'104'};
const proposal={session,storedConnection,mode:'direct',order,nowMs:now,
 signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'direct',side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
 source:{provider:'alpaca',environment:'paper',accountDigest:storedConnection.external_digest,
  accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,prospective:true,liveAccount:false,serverVerified:true},
 meta:{provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'10',
  tickSize:'0.01',capturedAtMs:now-250,sourceSha256:'b'.repeat(64),quantityUnit:'base'},
 quote:{provider:'alpaca',instrument:'AAPL',receivedAtMs:now-200,sourceAtMs:now-200,bid:'99.98',ask:'100.02'},
 costs:{roundTripFeeBps:0,slippageBps:0,fundingCost:'0'}};
const limits={currency:'USD',ownerRisk:'5',accountRisk:'5',orderRisk:'4',notional:'1000',dailyLoss:'5',maxOrders:2};
async function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'jenios-paper-recon-')),db=new PaperLedger(join(dir,'ledger.db'));
 try{const c=alpacaPaperLedgerConnection(user,storedConnection,{now,env});db.configure(session,c,limits);
  reserveAlpacaPaperProposal(proposal,{ledger:db,env});db.event(session,c,order.clientOrderId,{id:'submitted_once',kind:'SUBMITTING',atMs:now,cumulativeQuantity:'0'});return await fn(db,c);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}}
const observation=(kind,quantity,id='receipt_'+kind)=>({found:true,state:kind,manualReview:false,
 event:{id,kind,cumulativeQuantity:quantity}});
const reconcile=(db,lookup,patch={})=>reconcileOwnAlpacaPaperLedger({session,storedConnection,
 clientOrderId:order.clientOrderId,symbol:order.symbol,nowMs:now+1,credentials:{apiKey:'fixtureonly'},...patch},
 {ledger:db,env,lookup});

test('B177-R2 after a legal account sync the reconciliation uses the same durable connection binding',()=>fixture(async(db,c)=>{
 const refreshed={...storedConnection,last_sync_at:new Date(now-300).toISOString()};
 const r=await reconcile(db,async()=>observation('ACK','0'),{storedConnection:refreshed});
 assert.equal(r.state,'ACK');assert.equal(db.snapshot(session,c)[0].state,'ACK');
 const later=alpacaPaperLedgerConnection(user,refreshed,{now,env});
 assert.deepEqual(c,later);
}));
test('B176 official Paper partial receipt keeps B152 risk reserved',()=>fixture(async(db,c)=>{
 const r=await reconcile(db,async()=>observation('PARTIAL','0.4'));
 assert.equal(r.state,'PARTIAL');assert.equal(r.ordersSent,0);assert.equal(r.automaticResubmissionAllowed,false);
 const saved=db.snapshot(session,c)[0];assert.equal(saved.filled,units('0.4').toString());assert.equal(saved.held,units('2').toString());
 const unchanged=await reconcile(db,async()=>observation('PARTIAL','0.4'),{nowMs:now+2});assert.equal(unchanged.unchanged,true);
}));
test('B176 network ambiguity leaves reservation and prevents new entries across restart',()=>fixture(async(db,c)=>{
 const r=await reconcile(db,async()=>{throw Error('network socket reset');});assert.equal(r.state,'UNKNOWN');assert.equal(r.manualReview,true);
 assert.equal(db.snapshot(session,c)[0].held,units('2').toString());
 const repeated=await reconcile(db,async()=>({found:false}),{nowMs:now+2});assert.equal(repeated.unchanged,true);
 assert.throws(()=>resubmitAmbiguousPaperOrder(),/AUTOMATIC_PAPER_RESUBMISSION_DISABLED/);
 const newProposal={...proposal,order:{...order,clientOrderId:'not_allowed_to_retry'}};
 assert.throws(()=>reserveAlpacaPaperProposal(newProposal,{ledger:db,env}),/RECONCILIATION_REQUIRED/);
 const recovered=await reconcile(db,async()=>observation('FILLED','1'),{nowMs:now+3});
 assert.equal(recovered.state,'FILLED');assert.equal(recovered.brokerConfirmed,true);
 assert.equal(db.snapshot(session,c)[0].held,units('2').toString()); // position still open
}));
test('B176 404 missing order retains UNKNOWN and does not infer broker rejection',()=>fixture(async(db,c)=>{
 const r=await reconcile(db,async()=>({found:false,state:'UNKNOWN'}));
 assert.equal(r.state,'UNKNOWN');assert.equal(db.snapshot(session,c)[0].held,units('2').toString());
}));
test('B176 cancellation with a partial fill never releases reserved capital without closure',()=>fixture(async(db,c)=>{
 await reconcile(db,async()=>observation('PARTIAL','0.6'));
 const r=await reconcile(db,async()=>observation('CANCELLED','0.6'),{nowMs:now+2});
 assert.equal(r.state,'CANCELLED');assert.equal(r.riskHeldUnits,units('2').toString());
 const ignored=await reconcile(db,async()=>observation('ACK','0'),{nowMs:now+3});
 assert.equal(ignored.unchanged,true);assert.equal(db.snapshot(session,c)[0].held,units('2').toString());
}));
test('B176 complete zero-fill rejection releases only that reservation',()=>fixture(async(db,c)=>{
 const r=await reconcile(db,async()=>observation('REJECTED','0'));
 assert.equal(r.state,'REJECTED');assert.equal(db.snapshot(session,c)[0].held,'0');
}));
test('B176 cross-account and production requests do not reach provider lookup',()=>fixture(async(db,c)=>{
 let requests=0;const lookup=async()=>{requests++;return observation('FILLED','1');};
 await assert.rejects(reconcile(db,lookup,{session:{...session,userId:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'}}),/BROKER_OWNER_MISMATCH/);
 await assert.rejects(reconcileOwnAlpacaPaperLedger({session,storedConnection,clientOrderId:order.clientOrderId,symbol:'AAPL',nowMs:now+1},
  {ledger:db,env:{...env,VERCEL_ENV:'production'},lookup}),/PRIVATE_REHEARSAL_DISABLED/);
 assert.equal(requests,0);assert.equal(db.snapshot(session,c)[0].state,'SUBMITTING');
}));
test('B176 refuses external order before an explicit SUBMITTING event in the journal',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-no-submit-')),db=new PaperLedger(join(dir,'ledger.db'));
 try{const c=alpacaPaperLedgerConnection(user,storedConnection,{env,now});db.configure(session,c,limits);
  reserveAlpacaPaperProposal(proposal,{ledger:db,env});let called=false;
  await assert.rejects(reconcileOwnAlpacaPaperLedger({session,storedConnection,clientOrderId:order.clientOrderId,symbol:'AAPL',nowMs:now+1},
   {ledger:db,env,lookup:async()=>{called=true;return observation('FILLED','1');}}),/UNEXPECTED_BROKER_ORDER_BEFORE_SEND/);assert.equal(called,false);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('R103 UNKNOWN observations retain increasing cumulative fills without releasing risk',()=>fixture(async(db,c)=>{
 await reconcile(db,async()=>observation('UNKNOWN','0.2'));
 assert.equal(db.snapshot(session,c)[0].filled,units('0.2').toString());
 await reconcile(db,async()=>observation('UNKNOWN','0.4'),{nowMs:now+2});
 assert.equal(db.snapshot(session,c)[0].filled,units('0.4').toString());
 assert.equal(db.snapshot(session,c)[0].held,units('2').toString());
 await assert.rejects(reconcile(db,async()=>observation('CANCELLED','0'),{nowMs:now+3}),/INVALID_CUMULATIVE_FILL/);
}));
