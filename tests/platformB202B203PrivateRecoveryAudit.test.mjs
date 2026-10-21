import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {AlpacaPaperDispatchJournal} from '../lib/platform/connections/alpaca-paper-dispatch-journal.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {auditPaperLedgerOutboxReadOnly} from '../lib/platform/connections/b202-paper-ledger-outbox-audit.mjs';
import {inspectPrivateRestartInventory} from '../lib/platform/connections/b203-private-restart-inventory.mjs';
const nowMs=1792526000000,user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const id='50b85e9d-339c-4d32-b2bf-82c467673832';
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const env={JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true'};
const connectionRow={id,user_id:user,provider:'alpaca',environment:'paper',status:'active',
 external_digest:'d'.repeat(64),identity_verified:true,
 last_sync_at:new Date(nowMs-500).toISOString(),created_at:new Date(nowMs-900).toISOString()};
const source={provider:'alpaca',environment:'paper',accountDigest:connectionRow.external_digest,
 accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,
 prospective:true,liveAccount:false,serverVerified:true};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',
 contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'100',tickSize:'0.01',
 capturedAtMs:nowMs-1000,sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:nowMs-500,
 sourceAtMs:nowMs-750,bid:'99.99',ask:'100.01'};
const costs={roundTripFeeBps:0,slippageBps:0,fundingCost:'0'};
const limits={currency:'USD',ownerRisk:'8',accountRisk:'8',orderRisk:'5',notional:'1500',dailyLoss:'8',maxOrders:6};
const accountDigest=connectionRow.external_digest,proposalDigest='e'.repeat(64);
const clientOrderId='safe-order-one';
const proof={clientOrderId,accountDigest,proposalDigest};
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'jenios-b202-')),ledgerPath=join(dir,'risk.db'),outboxPath=join(dir,'outbox.db');
 let ledger=new PaperLedger(ledgerPath),journal=new AlpacaPaperDispatchJournal(outboxPath);
 const connection=alpacaPaperLedgerConnection(user,connectionRow,{now:nowMs,env});
 ledger.configure(session,connection,limits);
 const reserve=()=>reserveAlpacaPaperProposal({session,storedConnection:connectionRow,mode:'direct',
  signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'direct',side:'buy',
   contextDigest:'a'.repeat(64),reviewStatus:'allow'},
  order:{clientOrderId,mode:'direct',side:'buy',symbol:'AAPL',quantity:'4',entry:'100',stop:'99',target:'103'},
  source,meta,quote,costs,nowMs},{ledger,env});
 const paper=atMs=>({userId:user,connectionId:connection.id,clientOrderId,
  accountDigest,proposalDigest,atMs});
 const prepared=()=>journal.prepare(paper(nowMs));
 const submitting=()=>{ledger.event(session,connection,clientOrderId,
  {id:'local-submitting',kind:'SUBMITTING',atMs:nowMs+1,cumulativeQuantity:'0'});
  return journal.claim(paper(nowMs+1));};
 const audit=(pairedObservation=null,patch={})=>auditPaperLedgerOutboxReadOnly({session,connection,
  clientOrderId,accountDigest,proposalDigest,ledger,journal,pairedObservation,nowMs:nowMs+10,...patch},{env});
 const inventory=(proofs=[proof],patch={})=>inspectPrivateRestartInventory({session,connection,ledger,journal,
  intentProofs:proofs,nowMs:nowMs+10,...patch},{env});
 const restart=()=>{ledger.close();journal.close();ledger=new PaperLedger(ledgerPath);journal=new AlpacaPaperDispatchJournal(outboxPath);};
 try{return fn({get ledger(){return ledger;},get journal(){return journal;},connection,reserve,
  paper,prepared,submitting,audit,inventory,restart});}
 finally{ledger.close();journal.close();rmSync(dir,{recursive:true,force:true});}
}
test('B202 reserved private B152 order without outbox remains unsent and review-only',()=>fixture(c=>{
 c.reserve();const result=c.audit();assert.equal(result.riskState,'RESERVED');
 assert.equal(result.outboxState,'NOT_PREPARED');assert.equal(result.ordersSent,0);
 assert.equal(result.ledgerChanged,false);assert.equal(result.automaticOrderRetryAllowed,false);
 const inventory=c.inventory([]);assert.equal(inventory.reservedOrPreparedCount,1);
 assert.equal(inventory.previousOneShotAttempts,0);assert.equal(inventory.ordersSent,0);
}));
test('B202 prepared B178 outbox does not authorize an automatic first send after restart',()=>fixture(c=>{
 c.reserve();assert.equal(c.prepared().duplicate,false);c.restart();
 const result=c.audit();assert.equal(result.outboxState,'PREPARED');
 const inventory=c.inventory();assert.equal(inventory.reservedOrPreparedCount,1);
 assert.equal(inventory.noAutomaticSubmissionAfterRestart,true);
 assert.equal(inventory.disposition,'MANUAL_REVIEW_BEFORE_RESUME');
}));
test('B202 UNKNOWN with previously claimed dispatch remains ambiguous after restart; no retry',()=>fixture(c=>{
 c.reserve();c.prepared();assert.equal(c.submitting().claimed,true);
 c.ledger.event(session,c.connection,clientOrderId,{id:'transport-unknown',kind:'UNKNOWN',
  atMs:nowMs+2,cumulativeQuantity:'0'});
 c.restart();const audit=c.audit();assert.equal(audit.classification,'UNKNOWN_BROKER_STATE_NO_GO');
 assert.equal(audit.heldRiskUnits,units('4').toString());assert.equal(audit.entryPauseRecommended,true);
 const inventory=c.inventory();assert.ok(inventory.ambiguousCount>0);
 assert.equal(inventory.previousOneShotAttempts,1);
 assert.equal(inventory.liveExecutionAuthorized,false);
 assert.equal(c.journal.claim(c.paper(nowMs+20)).claimed,false);
}));
test('B202 a broker-observed cumulative fill lower than durable PARTIAL is a critical conflict',()=>fixture(c=>{
 c.reserve();c.prepared();c.submitting();
 c.ledger.event(session,c.connection,clientOrderId,{id:'broker-ack',kind:'ACK',atMs:nowMs+2,cumulativeQuantity:'0'});
 c.ledger.event(session,c.connection,clientOrderId,{id:'broker-partial',kind:'PARTIAL',atMs:nowMs+3,cumulativeQuantity:'2'});
 const result=c.audit({schema:'JENIOS_B201_PRIVATE_PAIRED_PAPER_READ',
  assessment:'EVOLVING_OR_AMBIGUOUS',ordersSent:0,independentlyAttested:false,
  lastCumulativeQuantity:'1'});
 assert.equal(result.classification,'INCONSISTENT_EVIDENCE_NO_GO');
 assert.ok(result.conflictCodes.includes('BROKER_REPORTED_FILL_BELOW_DURABLE_LEDGER'));
 assert.equal(c.ledger.snapshot(session,c.connection)[0].filled,units('2').toString());
}));
test('B202 broker 404 never implies rejection even for previously claimed order',()=>fixture(c=>{
 c.reserve();c.prepared();c.submitting();
 const result=c.audit({schema:'JENIOS_B201_PRIVATE_PAIRED_PAPER_READ',
  assessment:'ORDER_NOT_FOUND_IS_UNKNOWN',ordersSent:0,independentlyAttested:false});
 assert.ok(result.conflictCodes.includes('404_IS_NOT_A_REJECTION'));
 assert.equal(result.entryPauseRecommended,true);
 assert.equal(c.ledger.snapshot(session,c.connection)[0].state,'SUBMITTING');
}));
test('B203 duplicate/foreign proofs and wrong-tenant access fail before any state mutation',()=>fixture(c=>{
 c.reserve();c.prepared();
 assert.throws(()=>c.inventory([proof,proof]),/INVALID_OR_DUPLICATE_INTENT_PROOF/);
 assert.throws(()=>c.inventory([{...proof,clientOrderId:'wrong-order'}]),/PROOF_FOR_UNKNOWN_PAPER_INTENT/);
 assert.throws(()=>c.audit(null,{proposalDigest:'a'.repeat(64)}),/DISPATCH_INTENT_NOT_MATCHED/);
 assert.throws(()=>c.inventory([proof],{session:{...session,userId:'other'}}),/PRIVATE_PAPER_OWNER_REQUIRED/);
 assert.equal(c.ledger.snapshot(session,c.connection)[0].state,'RESERVED');
}));
test('B202/B203 public runtime remains fail-closed even with mocked broker replies',()=>fixture(c=>{
 c.reserve();c.prepared();
 assert.throws(()=>auditPaperLedgerOutboxReadOnly({session,connection:c.connection,clientOrderId,
  accountDigest,proposalDigest,ledger:c.ledger,journal:c.journal,nowMs:nowMs+10},
  {env:{...env,VERCEL_ENV:'preview'}}),/ISOLATED_PAPER_AUDIT_DISABLED/);
 assert.throws(()=>inspectPrivateRestartInventory({session,connection:c.connection,
  ledger:c.ledger,journal:c.journal,intentProofs:[proof],nowMs:nowMs+10},
  {env:{...env,VERCEL_ENV:'production'}}),/PRIVATE_RESTART_AUDIT_DISABLED/);
}));
