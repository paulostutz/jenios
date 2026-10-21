import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {AlpacaPaperDispatchJournal} from '../lib/platform/connections/alpaca-paper-dispatch-journal.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {encryptDemo,digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {readDemoBroker} from '../lib/platform/connections/demo-broker-reader.mjs';
import {issuePrivatePaperReadGrant} from '../lib/platform/connections/b206-private-read-boundary.mjs';
import {PrivatePaperReadAuditStore} from '../lib/platform/connections/b207-durable-read-audit.mjs';
import {observePrivatePaperOnce} from '../lib/platform/connections/b208-private-paper-observer.mjs';
const now=1792526000000,start=now+100;
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const id='50b85e9d-339c-4d32-b2bf-82c467673832';
const clientOrderId='worker-paper-1',accountRef='account-12345678-1234-4234-8234-123456789012';
const apiKey='private_fake_key_123456',secret='private_fake_secret_123456';
const env={JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,8).toString('base64'),
 JENIOS_PAPER_OBSERVER_KEY_B64:Buffer.alloc(32,9).toString('base64'),
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'true',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false'};
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const accountDigest=digestDemoAccount(accountRef,{userId:user,provider:'alpaca',environment:'paper'},env);
const proposalDigest='a'.repeat(64);
const credential_box=encryptDemo({apiKey,secret},
 {userId:user,id,provider:'alpaca',environment:'paper',kind:'credentials'},env);
const storedConnection={id,user_id:user,provider:'alpaca',environment:'paper',status:'active',
 identity_verified:true,created_at:new Date(now-40000).toISOString(),
 last_sync_at:new Date(now-1000).toISOString(),external_digest:accountDigest,credential_box};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',
 contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'100',tickSize:'0.01',capturedAtMs:now-1000,
 sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:now-500,
 sourceAtMs:now-700,bid:'99.99',ask:'100.01'};
const limits={currency:'USD',ownerRisk:'8',accountRisk:'8',orderRisk:'5',
 notional:'1500',dailyLoss:'8',maxOrders:6};
const order={clientOrderId,mode:'hybrid',side:'buy',symbol:'AAPL',quantity:'4',
 entry:'100',stop:'99',target:'103'};
const paperOrder={id:'paper-official-fixture-1',client_order_id:clientOrderId,
 symbol:'AAPL',qty:'4',filled_qty:'4',status:'filled'};
const makeGrant=(auditId)=>issuePrivatePaperReadGrant({v:1,kind:'ALPACA_PAPER_READ_ONLY',
 operatorApproval:'PRIVATE_MANUAL_READ_APPROVED',userId:user,connectionId:id,
 clientOrderId,auditId,accountDigest,issuedAtMs:start-1000,expiresAtMs:start+60000},{env});
async function fixture(fn,{fetchResponses=[Response.json(paperOrder),Response.json(paperOrder)],
 refresh=null,reader=null,auditId='manual-1',beginUnknown=true}={}){
 const dir=mkdtempSync(join(tmpdir(),'jenios-b208-'));
 let ledger=new PaperLedger(join(dir,'risk.sqlite')),
  journal=new AlpacaPaperDispatchJournal(join(dir,'dispatch.sqlite')),
  auditStore=new PrivatePaperReadAuditStore(join(dir,'audit.sqlite'),{env});
 const c=alpacaPaperLedgerConnection(user,storedConnection,{env,now});
 const paper={userId:user,connectionId:id,clientOrderId,accountDigest,proposalDigest,atMs:now};
 let clock=start,networkCalls=0;
 const fetcher=async (url,options)=>{
  networkCalls++;
  assert.equal(options.method,'GET');assert.ok(url.startsWith('https://paper-api.alpaca.markets/'));
  return fetchResponses[Math.min(networkCalls-1,fetchResponses.length-1)];
 };
 const obsReader=reader|| (async value=>{
  assert.deepEqual(value,{provider:'alpaca',environment:'paper',apiKey,secret});
  return {identityVerified:true,accountRef,
   observation:{summary:{permissionsVerified:false},liveExecution:false,ordersSent:0},
   snapshot:{provider:'alpaca',environment:'paper',complete:true,accountReadConfirmed:true,
    observedAtMs:start,positions:[],openOrders:[]}};
 });
 const input={session,storedConnection,clientOrderId,symbol:'AAPL',expectedQuantity:'4',
  accountDigest,proposalDigest,auditId,
  intentProofs:[{clientOrderId,accountDigest,proposalDigest}],grant:makeGrant(auditId),nowMs:start};
 const deps={env,ledger,journal,auditStore,refreshConnection:async()=>refresh?refresh():storedConnection,
  reader:obsReader,fetcher,now:()=>clock,delay:async ms=>{clock+=ms;}};
 try{
  ledger.configure(session,c,limits);
  reserveAlpacaPaperProposal({session,storedConnection,mode:'hybrid',order,
   signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'hybrid',
    side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
   source:{provider:'alpaca',environment:'paper',accountDigest,
    accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,
    marketDataVerified:true,prospective:true,liveAccount:false,serverVerified:true},
   meta,quote,costs:{roundTripFeeBps:0,slippageBps:0,fundingCost:'0'},nowMs:now},{ledger,env});
  journal.prepare(paper);
  ledger.event(session,c,clientOrderId,{id:'submit-once',kind:'SUBMITTING',atMs:now+1,cumulativeQuantity:'0'});
  journal.claim({...paper,atMs:now+1});
  if(beginUnknown)ledger.event(session,c,clientOrderId,{id:'unknown-after-timeout',kind:'UNKNOWN',
   atMs:now+2,cumulativeQuantity:'0'});
  ledger.close();journal.close();auditStore.close();
  ledger=new PaperLedger(join(dir,'risk.sqlite'));
  journal=new AlpacaPaperDispatchJournal(join(dir,'dispatch.sqlite'));
  auditStore=new PrivatePaperReadAuditStore(join(dir,'audit.sqlite'),{env});
  return await fn({input,deps:{...deps,ledger,journal,auditStore},ledger,journal,auditStore,c,
   get networkCalls(){return networkCalls;},get clock(){return clock;}});
 }finally{ledger.close();journal.close();auditStore.close();rmSync(dir,{recursive:true,force:true});}
}
test('B208 full SQLite + outbox restart -> TWO GETs -> REDACTED review; no broker POST',()=>fixture(async kit=>{
 const result=await observePrivatePaperOnce(kit.input,kit.deps);
 assert.equal(result.assessment,'REVIEW_RECORDED');
 assert.equal(result.entryPausedLocally,true);assert.equal(result.officialReadCalls,2);
 assert.equal(result.report.severity,'CRITICAL');assert.equal(result.report.readyForBrokerPaperPilot,false);
 assert.equal(result.ordersSent,0);assert.equal(result.liveExecution,false);
 assert.equal(kit.networkCalls,2);
 const snap=kit.ledger.snapshot(session,kit.c)[0];
 assert.equal(snap.state,'UNKNOWN');assert.equal(snap.held,units('4').toString());
 const again=await observePrivatePaperOnce(kit.input,kit.deps);
 assert.equal(again.assessment,'DUPLICATE_OR_EXPIRED_AUDIT_NO_AUTOMATIC_RETRY');
 assert.equal(again.entryPausedLocally,true);
 assert.equal(kit.networkCalls,2);
 for(const secretValue of [apiKey,secret,clientOrderId,accountRef,id,accountDigest])
  assert.equal(JSON.stringify(result).includes(secretValue),false);
}));
test('B208 404 is UNKNOWN, never rejects or releases the original risk',()=>fixture(async kit=>{
 const r=await observePrivatePaperOnce(kit.input,kit.deps);
 assert.equal(r.assessment,'REVIEW_RECORDED');
 assert.equal(r.report.pairedAssessment,'ORDER_NOT_FOUND_IS_UNKNOWN');
 assert.ok(r.report.issueCodes.includes('404_IS_NOT_A_REJECTION'));
 assert.equal(kit.networkCalls,1);
 assert.equal(kit.ledger.snapshot(session,kit.c)[0].held,units('4').toString());
}, {fetchResponses:[new Response(null,{status:404})]}));
test('B208 provider error fails closed, marks audit FAILED_CLOSED, pauses locally and never retries',()=>fixture(async kit=>{
 const r=await observePrivatePaperOnce(kit.input,kit.deps);
 assert.equal(r.assessment,'HALT_PRIVATE_OPERATOR_REVIEW');
 assert.equal(r.entryPausedLocally,true);
 assert.equal(kit.auditStore.inspect({userId:user,connectionId:id,clientOrderId,auditId:'manual-1'}).state,'FAILED_CLOSED');
 const again=await observePrivatePaperOnce(kit.input,kit.deps);
 assert.equal(again.assessment,'DUPLICATE_OR_EXPIRED_AUDIT_NO_AUTOMATIC_RETRY');
 assert.equal(kit.networkCalls,1);
}, {fetchResponses:[new Response('upstream private secret',{status:503})]}));
test('B208 owner revocation or credential rotation before GET closes and blocks external request',()=>fixture(async kit=>{
 const r=await observePrivatePaperOnce(kit.input,kit.deps);
 assert.equal(r.assessment,'HALT_PRIVATE_OPERATOR_REVIEW');
 assert.equal(kit.networkCalls,0);assert.equal(r.entryPausedLocally,true);
}, {refresh:()=>({...storedConnection,status:'revoked'})}));
test('B208 cross-account/tampered grant fails BEFORE audit claim and broker GET',()=>fixture(async kit=>{
 await assert.rejects(observePrivatePaperOnce({...kit.input,grant:{...kit.input.grant,
   hmacSha256:'0'.repeat(64)}},kit.deps),/READ_GRANT_SIGNATURE_INVALID/);
 assert.equal(kit.networkCalls,0);
 assert.equal(kit.auditStore.inspect({userId:user,connectionId:id,clientOrderId,auditId:'manual-1'}),null);
}));
test('B208 prevents unsigned or forged client-provided account evidence from becoming a reader grant',()=>fixture(async kit=>{
 await assert.rejects(observePrivatePaperOnce({...kit.input,accountDigest:'f'.repeat(64)},kit.deps),
  /PRIVATE_PAPER_WORKER_ACCOUNT_CHANGED/);
 await assert.rejects(observePrivatePaperOnce({...kit.input,intentProofs:[]},kit.deps),
  /PRIVATE_PAPER_WORKER_INTENT_PROOF_REQUIRED/);
 assert.equal(kit.networkCalls,0);
}));

test('B208 integrated B166 official reader + B201 paired order only issues five allowlisted GETs',()=>fixture(async kit=>{
 const r=await observePrivatePaperOnce(kit.input,kit.deps);
 assert.equal(r.assessment,'REVIEW_RECORDED');
 assert.equal(r.officialReadCalls,5);assert.equal(kit.networkCalls,5);
 assert.equal(r.entryPausedLocally,true);assert.equal(r.ordersSent,0);
 assert.equal(kit.ledger.snapshot(session,kit.c)[0].state,'UNKNOWN');
},{reader:readDemoBroker,fetchResponses:[
 Response.json({id:'12345678-1234-4234-8234-123456789012',status:'ACTIVE',
  trading_blocked:false,cash:'1000',equity:'1000'}),
 Response.json([]),Response.json([]),Response.json(paperOrder),Response.json(paperOrder)
]}));
