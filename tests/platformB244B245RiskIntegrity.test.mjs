import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {exerciseThreeModesInPrivateLedger} from '../lib/platform/launch/b224-three-mode-ledger-lab.mjs';
import {replayAdversarialPaper} from '../lib/platform/connections/b192-adversarial-paper-replay.mjs';
const now=1792540000000,user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',id='50b85e9d-339c-4d32-b2bf-82c467673832';
const session={userId:user,authenticated:true,diagnosticCompleted:true},env={VERCEL_ENV:'preview',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'};
const storedConnection={id,user_id:user,provider:'alpaca',environment:'paper',status:'active',identity_verified:true,
 external_digest:'e'.repeat(64),created_at:new Date(now-1000).toISOString(),last_sync_at:new Date(now-500).toISOString()};
const connection=alpacaPaperLedgerConnection(user,storedConnection,{env,now});
const source={provider:'alpaca',environment:'paper',accountDigest:storedConnection.external_digest,
 accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,prospective:true,
 liveAccount:false,serverVerified:true};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'100',tickSize:'0.01',capturedAtMs:now-100,sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:now-50,sourceAtMs:now-80,bid:'99.99',ask:'100.01'};
const costs={roundTripFeeBps:0,slippageBps:0,fundingCost:'0'};
const limits={currency:'USD',ownerRisk:'8',accountRisk:'8',orderRisk:'5',notional:'1500',dailyLoss:'8',maxOrders:6};
const make=fn=>{const d=mkdtempSync(join(tmpdir(),'jenios-b244-'));let ledger=new PaperLedger(join(d,'risk.sqlite'));
 try{ledger.configure(session,connection,limits);return fn({ledger,restart:()=>{ledger.close();ledger=new PaperLedger(join(d,'risk.sqlite'));return ledger;}});}finally{ledger.close();rmSync(d,{recursive:true,force:true});}};
const template={clientOrderId:'candidate',mode:'direct',side:'buy',symbol:'AAPL',quantity:'4',entry:'100',stop:'99',target:'103'};
test('B244 direct reverse hybrid all share the same exact B152 capital budget',()=>make(({ledger})=>{
 const r=exerciseThreeModesInPrivateLedger({session,storedConnection,ledger,orderTemplate:template,source,meta,quote,costs,nowMs:now},{env});
 assert.deepEqual(r.modes.map(x=>x.mode),['direct','reverse','hybrid']);
 assert.equal(r.newLedgerIntents,2);assert.equal(r.modes[2].decision,'BLOCKED_BY_ORIGINAL_RISK_ENGINE');
 assert.equal(r.ordersSent,0);assert.equal(r.originalPrivateRobotDecisionsExecuted,false);
}));
test('B245 partial then timeout survives restart and blocks another order',()=>make(({ledger,restart})=>{
 const order={...template,clientOrderId:'partial-case'};
 const signal={originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'direct',side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'};
 reserveAlpacaPaperProposal({session,storedConnection,mode:'direct',order,signal,source,meta,quote,costs,nowMs:now},{ledger,env});
 const r=replayAdversarialPaper({ledger,session,connection,clientOrderId:'partial-case',quantity:'4',scenario:'partial_then_timeout',atMs:now+1});
 assert.equal(r.state,'UNKNOWN');assert.equal(r.ordersSent,0);assert.equal(r.needsIndependentReconciliation,true);
 const db=restart(),s=db.snapshot(session,connection).find(x=>x.client_id==='partial-case');
 assert.equal(s.state,'UNKNOWN');assert.ok(BigInt(s.held)>0n);
 assert.throws(()=>reserveAlpacaPaperProposal({session,storedConnection,mode:'direct',order:{...order,clientOrderId:'new-id'},signal,source,meta,quote,costs,nowMs:now},{ledger:db,env}),/RECONCILIATION_REQUIRED/);
}));
test('B245 an out-of-order broker filled receipt does not release risk',()=>make(({ledger})=>{
 const order={...template,clientOrderId:'out-of-order-case'};
 const signal={originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'direct',side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'};
 reserveAlpacaPaperProposal({session,storedConnection,mode:'direct',order,signal,source,meta,quote,costs,nowMs:now},{ledger,env});
 const r=replayAdversarialPaper({ledger,session,connection,clientOrderId:'out-of-order-case',quantity:'4',scenario:'reordered_fill_blocked',atMs:now+1});
 assert.equal(r.blockedInvalidReceipt,'OUT_OF_ORDER_EVENT');assert.equal(r.ordersSent,0);
 assert.ok(BigInt(ledger.snapshot(session,connection)[0].held)>0n);
}));
