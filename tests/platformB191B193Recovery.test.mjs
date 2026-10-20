import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {replayAdversarialPaper} from '../lib/platform/connections/b192-adversarial-paper-replay.mjs';
import {inspectPrivatePaperRecovery,pausePrivatePaperEntries} from '../lib/platform/connections/b191-private-recovery-runbook.mjs';
import {inspectPaperProtectionRisk} from '../lib/platform/connections/b193-paper-protection-gate.mjs';
import {inspectPaperBracketReply} from '../lib/platform/connections/alpaca-paper-bracket-audit.mjs';
const nowMs=1792525000000,user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const env={VERCEL_ENV:'preview',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'};
const storedConnection={id:'50b85e9d-339c-4d32-b2bf-82c467673832',user_id:user,provider:'alpaca',
 environment:'paper',status:'active',external_digest:'d'.repeat(64),
 last_sync_at:new Date(nowMs-1000).toISOString(),created_at:new Date(nowMs-500).toISOString(),identity_verified:true};
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const source={provider:'alpaca',environment:'paper',accountDigest:storedConnection.external_digest,
 accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,
 prospective:true,liveAccount:false,serverVerified:true};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',
 contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'100',tickSize:'0.01',capturedAtMs:nowMs-1000,
 sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const costs={roundTripFeeBps:0,slippageBps:0,fundingCost:'0'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:nowMs-500,sourceAtMs:nowMs-750,bid:'99.99',ask:'100.01'};
const limits={currency:'USD',ownerRisk:'12',accountRisk:'12',orderRisk:'5',notional:'1500',dailyLoss:'12',maxOrders:6};
function fixture(run){
 const dir=mkdtempSync(join(tmpdir(),'jenios-b191-')),file=join(dir,'risk.db');
 let ledger=new PaperLedger(file);
 const connection=alpacaPaperLedgerConnection(user,storedConnection,{env,now:nowMs});
 ledger.configure(session,connection,limits);
 const reserve=(mode,id)=>reserveAlpacaPaperProposal({session,storedConnection,mode,
  signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode,side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
  order:{clientOrderId:id,mode,side:'buy',symbol:'AAPL',quantity:'4',entry:'100',stop:'99',target:'103'},
  source,meta,quote,costs,nowMs},{ledger,env});
 const replay=(id,scenario)=>replayAdversarialPaper({ledger,session,connection,
  clientOrderId:id,quantity:'4',scenario,atMs:nowMs+1});
 const snapshot=id=>ledger.snapshot(session,connection).find(r=>r.client_id===id);
 try{return run({ledger,connection,reserve,replay,snapshot,
  restart:()=>{ledger.close();ledger=new PaperLedger(file);},current:()=>ledger});}
 finally{ledger.close();rmSync(dir,{recursive:true,force:true});}
}
for(const mode of ['direct','reverse','hybrid'])for(const [scenario,expectedState,expectedFill] of [
 ['ack_then_timeout','UNKNOWN','0'],['partial_then_timeout','UNKNOWN',units('2').toString()],
 ['duplicate_ack_then_fill','FILLED',units('4').toString()],
 ['stale_rejection_after_fill','FILLED',units('4').toString()],
 ['reordered_fill_blocked','ACK','0']
]){
 test('B192 SQLite '+mode+' '+scenario+' respects durable risk',()=>fixture(({reserve,replay,snapshot})=>{
  const id=mode+'-'+scenario;reserve(mode,id);
  const r=replay(id,scenario);const row=snapshot(id);
  assert.equal(r.state,expectedState);assert.equal(r.filledUnits,expectedFill);
  assert.equal(r.heldRiskUnits,units('4').toString());assert.equal(row.held,r.heldRiskUnits);
  assert.equal(r.ordersSent,0);assert.equal(r.networkCalls,0);
  assert.equal(r.needsIndependentReconciliation,scenario.includes('timeout'));
  if(scenario==='duplicate_ack_then_fill')assert.ok(r.events.some(e=>e.duplicate===true));
  if(scenario==='stale_rejection_after_fill')assert.equal(r.blockedInvalidReceipt,'INVALID_STATE_TRANSITION');
  if(scenario==='reordered_fill_blocked')assert.equal(r.blockedInvalidReceipt,'OUT_OF_ORDER_EVENT');
  assert.throws(()=>replay(id,scenario),/FRESH_RESERVED_INTENT_REQUIRED/);
 }));
}
test('B191 unknown remains held across restart; explicit operator pause is not a broker cancellation',()=>fixture(({reserve,replay,connection,restart,current})=>{
 reserve('direct','unknown-b191');replay('unknown-b191','partial_then_timeout');restart();
 const risk=inspectPrivatePaperRecovery({ledger:current(),session,connection,nowMs:nowMs+20},{env});
 assert.equal(risk.states.UNKNOWN,1);assert.equal(risk.heldRiskUnits,units('4').toString());
 assert.equal(risk.filledQuantityUnits,units('2').toString());
 assert.equal(risk.independentBrokerLookupRequired,true);assert.equal(risk.entryPauseRecommended,true);
 assert.equal(risk.automaticOrderRetry,false);assert.equal(risk.ordersSent,0);
 const stopped=pausePrivatePaperEntries({ledger:current(),session,connection},{env});
 assert.equal(stopped.paused,true);assert.equal(stopped.ordersCancelled,false);assert.equal(stopped.positionsClosed,false);
 assert.throws(()=>reserve('reverse','blocked-after-pause'),/ACCOUNT_PAUSED|RECONCILIATION_REQUIRED/);
}));
test('B191 cross-account, production and unauthorized controls refuse risk inspection and pause',()=>fixture(({reserve,connection,current})=>{
 reserve('direct','owned-only');
 const other={...session,userId:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'};
 assert.throws(()=>inspectPrivatePaperRecovery({ledger:current(),session:other,connection,nowMs},{env}),/PRIVATE_PAPER_OWNER_REQUIRED/);
 assert.throws(()=>pausePrivatePaperEntries({ledger:current(),session:other,connection},{env}),/PRIVATE_PAPER_OWNER_REQUIRED/);
 assert.throws(()=>inspectPrivatePaperRecovery({ledger:current(),session,connection,nowMs},
  {env:{...env,VERCEL_ENV:'production'}}),/PRIVATE_PAPER_REHEARSAL_REQUIRED/);
}));
test('B193 broker ACK/UNKNOWN does not certify stop or claim an open position is protected',()=>fixture(({reserve,replay,snapshot})=>{
 const proposal=reserve('direct','protect-b193').nativeProposal.body;
 replay('protect-b193','partial_then_timeout');
 const row=snapshot('protect-b193');
 const unknown=inspectPaperProtectionRisk({riskRow:row});
 assert.equal(unknown.disposition,'UNKNOWN_REQUIRES_BROKER_LOOKUP');
 assert.equal(unknown.stopExecutionGuaranteed,false);
 const brokerOrderId='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
 const parent={id:brokerOrderId,client_order_id:proposal.client_order_id,
 symbol:proposal.symbol,side:'buy',qty:proposal.qty,order_class:'bracket',group_id:'g1',legs:[
  {symbol:'AAPL',side:'sell',type:'limit',qty:'4',limit_price:'103',group_id:'g1',group_role:'take_profit'},
  {symbol:'AAPL',side:'sell',type:'stop',qty:'4',stop_price:'99',group_id:'g1',group_role:'stop_loss'}]};
 const audit=inspectPaperBracketReply({parent,body:proposal,brokerOrderId});
 assert.equal(audit.bracketConfirmed,true);
 const view=inspectPaperProtectionRisk({riskRow:row,bracketAudit:audit});
 assert.equal(view.stopExecutionGuaranteed,false);
 assert.equal(view.actualStopsCertified,false);
 assert.equal(view.realOrderPermission,false);
 assert.equal(view.disposition,'UNKNOWN_REQUIRES_BROKER_LOOKUP');
}));
test('B193 filled ledger + both mocked legs still requires manual protection review',()=>fixture(({reserve,replay,snapshot})=>{
 reserve('hybrid','filled-b193');replay('filled-b193','duplicate_ack_then_fill');
 const row=snapshot('filled-b193');
 const status=inspectPaperProtectionRisk({riskRow:row,bracketAudit:{bracketConfirmed:true,reviewRequired:false,stopFillGuaranteed:false}});
 assert.equal(status.disposition,'REVIEW_VERIFIED_BRACKET_STILL_AT_RISK');
 assert.equal(status.manualPositionProtectionReviewRequired,true);
 assert.equal(status.actualStopsCertified,false);
 const absent=inspectPaperProtectionRisk({riskRow:row,bracketAudit:{bracketConfirmed:false,reviewRequired:true,stopFillGuaranteed:false}});
 assert.equal(absent.disposition,'EXPOSED_UNVERIFIED_PROTECTION');
}));
