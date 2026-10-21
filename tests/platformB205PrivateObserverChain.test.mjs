import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {AlpacaPaperDispatchJournal} from '../lib/platform/connections/alpaca-paper-dispatch-journal.mjs';
import {encryptDemo,digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {collectPrivatePaperOrderPair} from '../lib/platform/connections/b201-private-paired-paper-reader.mjs';
import {auditPaperLedgerOutboxReadOnly} from '../lib/platform/connections/b202-paper-ledger-outbox-audit.mjs';
import {inspectPrivateRestartInventory} from '../lib/platform/connections/b203-private-restart-inventory.mjs';
import {compileRedactedPaperReview} from '../lib/platform/connections/b204-redacted-paper-review.mjs';
const nowMs=1792526000000,user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const id='50b85e9d-339c-4d32-b2bf-82c467673832';
const accountRef='account-12345678-1234-4234-8234-123456789012';
const clientOrderId='e2e-paper-id-1';
const apiKey='private_mock_paper_key_12345',secret='private_mock_paper_secret_12345';
const env={JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',
 JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,8).toString('base64')};
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const credential_box=encryptDemo({apiKey,secret},
 {userId:user,id,provider:'alpaca',environment:'paper',kind:'credentials'},env);
const storedConnection={id,user_id:user,provider:'alpaca',environment:'paper',status:'active',
 identity_verified:true,created_at:new Date(nowMs-40000).toISOString(),
 last_sync_at:new Date(nowMs-1000).toISOString(),
 external_digest:digestDemoAccount(accountRef,{userId:user,provider:'alpaca',environment:'paper'},env),
 credential_box};
const order={clientOrderId,mode:'hybrid',side:'buy',symbol:'AAPL',quantity:'4',entry:'100',stop:'99',target:'103'};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',
 contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'100',tickSize:'0.01',
 capturedAtMs:nowMs-1000,sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:nowMs-500,sourceAtMs:nowMs-700,bid:'99.99',ask:'100.01'};
const limits={currency:'USD',ownerRisk:'8',accountRisk:'8',orderRisk:'5',
 notional:'1500',dailyLoss:'8',maxOrders:6};
test('B205 full offline chain: official-URL mock GET pair -> risk/outbox audit -> restart -> redacted dossier, no POST',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-b205-chain-'));
 const riskFile=join(dir,'risk.sqlite'),outboxFile=join(dir,'outbox.sqlite');
 let ledger=new PaperLedger(riskFile),journal=new AlpacaPaperDispatchJournal(outboxFile);
 const c=alpacaPaperLedgerConnection(user,storedConnection,{env,now:nowMs});
 const proposalDigest='a'.repeat(64),accountDigest=storedConnection.external_digest;
 let brokerGets=0,brokerPosts=0,clock=nowMs;
 const fetcher=async(url,options)=>{
  assert.equal(options.method,'GET');brokerGets++;
  if(options.method!=='GET')brokerPosts++;
  assert.ok(url.startsWith('https://paper-api.alpaca.markets/v2/orders:by_client_order_id?'));
  return Response.json({id:'alpaca-mock-parent-1',client_order_id:clientOrderId,
   symbol:'AAPL',qty:'4',filled_qty:brokerGets===1?'2':'4',
   status:brokerGets===1?'partially_filled':'filled'});
 };
 try{
  ledger.configure(session,c,limits);
  reserveAlpacaPaperProposal({session,storedConnection,mode:'hybrid',order,
   signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'hybrid',
    side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
   source:{provider:'alpaca',environment:'paper',accountDigest,
    accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,
    prospective:true,liveAccount:false,serverVerified:true},
   meta,quote,costs:{roundTripFeeBps:0,slippageBps:0,fundingCost:'0'},nowMs},{ledger,env});
  const paper={userId:user,connectionId:id,clientOrderId,accountDigest,
   proposalDigest,atMs:nowMs};
  journal.prepare(paper);
  ledger.event(session,c,clientOrderId,{id:'sent-local',kind:'SUBMITTING',atMs:nowMs+1,cumulativeQuantity:'0'});
  journal.claim({...paper,atMs:nowMs+1});
  ledger.event(session,c,clientOrderId,{id:'ambiguous-transport',kind:'UNKNOWN',atMs:nowMs+2,cumulativeQuantity:'0'});
  ledger.close();journal.close();ledger=new PaperLedger(riskFile);journal=new AlpacaPaperDispatchJournal(outboxFile);
  const pair=await collectPrivatePaperOrderPair({session,storedConnection,clientOrderId,
   symbol:'AAPL',expectedQuantity:'4',nowMs},{env,refreshConnection:async()=>storedConnection,
   reader:async()=>({identityVerified:true,accountRef,
    observation:{summary:{permissionsVerified:false},liveExecution:false,ordersSent:0},
    snapshot:{provider:'alpaca',environment:'paper',complete:true,accountReadConfirmed:true,
     observedAtMs:nowMs,positions:[],openOrders:[]}}),fetcher,now:()=>clock,delay:async ms=>{clock+=ms;}});
  assert.equal(pair.assessment,'EVOLVING_OR_AMBIGUOUS');
  const audit=auditPaperLedgerOutboxReadOnly({session,connection:c,clientOrderId,
   accountDigest,proposalDigest,ledger,journal,pairedObservation:pair,nowMs:clock},{env});
  const restart=inspectPrivateRestartInventory({session,connection:c,ledger,journal,
   intentProofs:[{clientOrderId,accountDigest,proposalDigest}],nowMs:clock},{env});
  const report=compileRedactedPaperReview({pairedRead:pair,ledgerAudit:audit,
   restartInventory:restart,nowMs:clock});
  assert.equal(report.severity,'CRITICAL');assert.equal(report.readyForBrokerPaperPilot,false);
  assert.equal(report.realExecutionAuthorized,false);assert.equal(report.ordersSent,0);
  assert.equal(ledger.snapshot(session,c)[0].state,'UNKNOWN');
  assert.equal(ledger.snapshot(session,c)[0].held,units('4').toString());
  assert.equal(journal.inspect({...paper,atMs:clock}).attempts,1);
  assert.equal(brokerGets,2);assert.equal(brokerPosts,0);
  for(const sensitive of [apiKey,secret,accountRef,clientOrderId,id])
   assert.equal(JSON.stringify(report).includes(sensitive),false);
 }finally{ledger.close();journal.close();rmSync(dir,{recursive:true,force:true});}
});
