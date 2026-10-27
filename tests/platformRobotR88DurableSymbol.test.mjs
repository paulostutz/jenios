import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA} from '../lib/platform/pilot-prep/contracts.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',now=1793091600000;
const env={VERCEL_ENV:'preview',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'};
const connection={id:'50b85e9d-339c-4d32-b2bf-82c467673832',user_id:owner,
 provider:'alpaca',environment:'paper',status:'active',identity_verified:true,
 external_digest:'a'.repeat(64),last_sync_at:new Date(now-1000).toISOString(),
 created_at:new Date(now-100000).toISOString()};
const session={userId:owner,authenticated:true,diagnosticCompleted:true};
const order={clientOrderId:'r88-durable-symbol',mode:'direct',side:'buy',symbol:'AAPL',
 quantity:'1',entry:'100',stop:'98',target:'104'};
const draft={session,storedConnection:connection,mode:'direct',order,nowMs:now,
 signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'direct',
  side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
 source:{provider:'alpaca',environment:'paper',accountDigest:connection.external_digest,
  accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,
  marketDataVerified:true,prospective:true,liveAccount:false,serverVerified:true},
 meta:{provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',
  settlement:'USD',contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'10',
  tickSize:'0.01',capturedAtMs:now-500,sourceSha256:'b'.repeat(64),quantityUnit:'base'},
 quote:{provider:'alpaca',instrument:'AAPL',receivedAtMs:now-200,
  sourceAtMs:now-200,bid:'99.98',ask:'100.02'},
 costs:{roundTripFeeBps:0,slippageBps:0,fundingCost:'0'}};
const limits={currency:'USD',ownerRisk:'5',accountRisk:'5',orderRisk:'4',
 notional:'1000',dailyLoss:'5',maxOrders:3};
test('R88 symbol and reservation survive restart, UNKNOWN blocks resubmission',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-r88-'));const path=join(dir,'ledger.db');let db;
 try{
  db=new PaperLedger(path);const bound=alpacaPaperLedgerConnection(owner,connection,{env,now});
  db.configure(session,bound,limits);
  reserveAlpacaPaperProposal(draft,{ledger:db,env});
  db.event(session,bound,order.clientOrderId,{id:'attempt-once',
   kind:'SUBMITTING',atMs:now,cumulativeQuantity:'0'});
  db.close();db=new PaperLedger(path);
  assert.deepEqual(db.pendingRecovery(session,bound),[{clientOrderId:order.clientOrderId,
   symbol:'AAPL',previousState:'SUBMITTING'}]);
  db.event(session,bound,order.clientOrderId,{id:'timeout',
   kind:'UNKNOWN',atMs:now+1,cumulativeQuantity:'0'});
  assert.equal(db.pendingRecovery(session,bound)[0].previousState,'UNKNOWN');
  const repeated=reserveAlpacaPaperProposal(draft,{ledger:db,env});
  assert.equal(repeated.duplicate,true);
  assert.equal(repeated.ordersSent,0);
  assert.throws(()=>reserveAlpacaPaperProposal({...draft,order:{...order,
   clientOrderId:'another-order'}},{ledger:db,env}),/RECONCILIATION_REQUIRED/);
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});
