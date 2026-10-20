import test from 'node:test';import assert from 'node:assert/strict';
import {join} from 'node:path';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA,units} from '../lib/platform/pilot-prep/contracts.mjs';
import {alpacaPaperLedgerConnection} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {AlpacaPaperDispatchJournal,paperDispatchHash} from '../lib/platform/connections/alpaca-paper-dispatch-journal.mjs';
import {issuePaperGrant} from '../lib/platform/connections/alpaca-paper-dispatch-grant.mjs';
import {encryptDemo,digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {nativeCustomerBinding,strategyToNativePaperProposal} from '../lib/platform/connections/native-broker-bridge.mjs';
import {executePrivateAlpacaPaperOnce,retryUncertainPaperOrder,executeLiveAlpacaOrder} from '../lib/platform/connections/alpaca-paper-private-executor.mjs';
const userId='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',id='50b85e9d-339c-4d32-b2bf-82c467673832', nowMs=1792526000000;
const env={JENIOS_PRIVATE_PAPER_EXECUTOR:'true',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true',JENIOS_PRIVATE_PAPER_REHEARSAL:'true',
 JENIOS_PAPER_WORKER_SIGNING_KEY_B64:Buffer.alloc(32,17).toString('base64'),JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,14).toString('base64')};
const credentials={apiKey:'paper_test_key_12345678',secret:'paper_test_secret_12345678'};
const accountRef='account-fixture-alpaca-paper-54321';
const digest=digestDemoAccount(accountRef,{userId,provider:'alpaca',environment:'paper'},env);
const storedConnection={id,user_id:userId,provider:'alpaca',environment:'paper',status:'active',external_digest:digest,
 created_at:new Date(nowMs-10000).toISOString(),last_sync_at:new Date(nowMs-500).toISOString(),identity_verified:true,
 credential_box:encryptDemo(credentials,{userId,id,provider:'alpaca',environment:'paper',kind:'credentials'},env)};
const session={userId,authenticated:true,diagnosticCompleted:true};
const order={clientOrderId:'paper-demo-e2e-1',mode:'direct',side:'buy',symbol:'AAPL',quantity:'1',entry:'100',stop:'98',target:'104'};
const source={provider:'alpaca',environment:'paper',accountDigest:digest,accountAuthenticated:true,ownershipVerified:true,
 permissionsVerified:true,marketDataVerified:true,prospective:true,liveAccount:false,serverVerified:true};
const signal={originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'direct',side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'10',tickSize:'0.01',capturedAtMs:nowMs-1000,sourceSha256:'b'.repeat(64),quantityUnit:'base'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:nowMs-100,sourceAtMs:nowMs-100,bid:'99.99',ask:'100.01'};
const costs={roundTripFeeBps:0,slippageBps:0,fundingCost:'0'};
const riskLimits={currency:'USD',ownerRisk:'5',accountRisk:'5',orderRisk:'4',notional:'1000',dailyLoss:'5',maxOrders:2};
const input={session,storedConnection,mode:'direct',signal,order,source,meta,quote,costs,nowMs};
const body=strategyToNativePaperProposal({binding:nativeCustomerBinding(userId,storedConnection),userId,mode:'direct',signal,order,source}).body;
const payload={v:1,userId,connectionId:id,accountDigest:digest,clientOrderId:order.clientOrderId,
 orderBodyDigest:paperDispatchHash(body),mode:'direct',issuedAtMs:nowMs-1000,expiresAtMs:nowMs+30000,
 customerPaperConsent:'verified_in_private_worker',brokerPermissions:'independently_audited_for_paper',
 bracketReview:'independently_reviewed',operatorReview:'human_paper_qa_authorized',evidenceDigest:'c'.repeat(64)};
const grant=issuePaperGrant(payload,{env});
const fakeRead=async(raw)=>({accountRef,identityVerified:true,snapshot:{accountReadConfirmed:true},observation:{ok:true}});
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'jenios-paper-exec-'));const ledger=new PaperLedger(join(dir,'risk.db')),journal=new AlpacaPaperDispatchJournal(join(dir,'outbox.db'));
 const connection=alpacaPaperLedgerConnection(userId,storedConnection,{now:nowMs,env});ledger.configure(session,connection,riskLimits);
 const opts={ledger,journal,env,readAccount:fakeRead,refreshConnection:async()=>storedConnection};
 return Promise.resolve().then(()=>fn(opts,ledger,journal,connection,dir)).finally(()=>{ledger.close();journal.close();rmSync(dir,{recursive:true,force:true});});}
const fakeReceipt={kind:'broker_receipt',brokerEvent:{id:'paper-ack-1',kind:'ACK',atMs:nowMs,cumulativeQuantity:'0'}};
test('B181 one reviewed private PAPER intent goes through B152 risk, one-shot outbox and broker native method',()=>fixture(async(opts,ledger,journal,c)=>{
 let sends=0;const post=async()=>{sends++;return fakeReceipt;};
 const r=await executePrivateAlpacaPaperOnce({...input,grant},{...opts,post});
 assert.equal(r.status,'BROKER_PAPER_RECEIPT');assert.equal(r.brokerStatus,'ACK');assert.equal(r.liveOrdersSent,0);
 assert.equal(sends,1);assert.equal(journal.inspect({userId,connectionId:id,clientOrderId:order.clientOrderId,accountDigest:digest,proposalDigest:paperDispatchHash(body),atMs:nowMs}).attempts,1);
 assert.equal(ledger.snapshot(session,c)[0].state,'ACK');assert.ok(BigInt(ledger.snapshot(session,c)[0].held)>0n);
 await assert.rejects(executePrivateAlpacaPaperOnce({...input,grant},{...opts,post}),/PAPER_DUPLICATE_RESERVATION/);
 assert.equal(sends,1);
}));
test('B181 PAPER provider timeout is UNKNOWN and blocks risk after restart; never resends',()=>fixture(async(opts,ledger,journal,c,dir)=>{
 let sends=0;const post=async()=>{sends++;throw Error('socket reset');};
 const result=await executePrivateAlpacaPaperOnce({...input,grant},{...opts,post});
 assert.equal(result.status,'AMBIGUOUS_BROKER_POST');assert.equal(journal.inspect({userId,connectionId:id,clientOrderId:order.clientOrderId,accountDigest:digest,proposalDigest:paperDispatchHash(body),atMs:nowMs}).state,'AMBIGUOUS');
 assert.equal(ledger.snapshot(session,c)[0].state,'UNKNOWN');
 await assert.rejects(executePrivateAlpacaPaperOnce({...input,grant},{...opts,post}),/PAPER_DUPLICATE_RESERVATION/);
 assert.equal(sends,1);assert.ok(BigInt(ledger.snapshot(session,c)[0].held)>0n);
}));
test('B181 forged/expired grant and changed account cannot send even PAPER',()=>fixture(async(opts,ledger,journal)=>{
 let sends=0;const post=async()=>{sends++;return fakeReceipt;};
 await assert.rejects(executePrivateAlpacaPaperOnce({...input,grant:{...grant,payload:{...grant.payload,userId:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'}}},{...opts,post}),/PAPER_GRANT_SIGNATURE_INVALID/);
 await assert.rejects(executePrivateAlpacaPaperOnce({...input,grant,nowMs:nowMs+90000},{...opts,post}),/PAPER_GRANT_EXPIRED|STALE_ALPACA_ACCOUNT/);
 await assert.rejects(executePrivateAlpacaPaperOnce({...input,grant},{...opts,post,readAccount:async()=>({accountRef:'changed-account',identityVerified:true,snapshot:{accountReadConfirmed:true}})}),/PAPER_ACCOUNT_CHANGED/);
 await assert.rejects(executePrivateAlpacaPaperOnce({...input,grant},{...opts,env:{...env,VERCEL_ENV:'production'},post}),/PRIVATE_PAPER_TRANSPORT_DISABLED/);
 assert.equal(sends,0);assert.deepEqual(ledger.snapshot(session,alpacaPaperLedgerConnection(userId,storedConnection,{now:nowMs,env})),[]);
}));
test('B181 live and retry functions are hard-coded fail closed',()=>{
 assert.throws(()=>executeLiveAlpacaOrder(),/REAL_EXECUTION_NOT_AUTHORIZED/);
 assert.throws(()=>retryUncertainPaperOrder(),/AUTOMATIC_PAPER_RETRY_FORBIDDEN/);
});
test('B181 broker-native end to end uses three authenticated PAPER GETs and one native POST only',()=>fixture(async(opts,ledger,journal,c)=>{
 const calls=[];
 const fetcher=async(url,request)=>{
  calls.push({url,method:request.method});
  if(url==='https://paper-api.alpaca.markets/v2/account')return Response.json({id:accountRef.slice('account-'.length),status:'ACTIVE',trading_blocked:false,cash:'1000',equity:'1000'});
  if(url==='https://paper-api.alpaca.markets/v2/positions')return Response.json([]);
  if(url==='https://paper-api.alpaca.markets/v2/orders?status=open&limit=500')return Response.json([]);
  if(url==='https://paper-api.alpaca.markets/v2/orders'&&request.method==='POST')return Response.json({
   id:'4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',client_order_id:order.clientOrderId,symbol:'AAPL',status:'new',qty:'1',filled_qty:'0'});
  throw Error('blocked request '+url);
 };
 const r=await executePrivateAlpacaPaperOnce({...input,grant},{ledger,journal,env,fetcher,refreshConnection:async()=>storedConnection});
 assert.equal(r.status,'BROKER_PAPER_RECEIPT');assert.equal(calls.length,4);
 assert.equal(calls.filter(x=>x.method==='POST').length,1);assert.equal(calls.filter(x=>x.method==='GET').length,3);
 assert.equal(ledger.snapshot(session,c)[0].state,'ACK');assert.equal(r.automaticResubmissionAllowed,false);
}));

test('B181 private worker must recheck current revoked/rotated broker connection',()=>fixture(async(opts)=>{
 let sent=0;const post=async()=>{sent++;return fakeReceipt;};
 await assert.rejects(executePrivateAlpacaPaperOnce({...input,grant},{...opts,refreshConnection:async()=>({...storedConnection,status:'revoked'}),post}),/BROKER_ACCESS_REVOKED_OR_ROTATED/);
 await assert.rejects(executePrivateAlpacaPaperOnce({...input,grant},{...opts,refreshConnection:async()=>({...storedConnection,external_digest:'b'.repeat(64)}),post}),/BROKER_ACCESS_REVOKED_OR_ROTATED/);
 await assert.rejects(executePrivateAlpacaPaperOnce({...input,grant},{...opts,refreshConnection:null,post}),/ACCOUNT_REVOCATION_FENCE_REQUIRED/);
 assert.equal(sent,0);
}));
