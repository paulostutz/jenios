/** Fixture-only crash simulator. Never use with real credentials or accounts. */
import assert from 'node:assert/strict';
import {resolve,dirname,basename,join} from 'node:path';
import {openR94PrivateJournal} from '../../lib/platform/connections/private-host-preflight-r94.mjs';
import {inspectR98CrashRecovery} from '../../lib/platform/connections/private-journal-restart-r98.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {CORE_SHA} from '../../lib/platform/pilot-prep/contracts.mjs';

const fail=()=>{process.stderr.write('R98_FIXTURE_REFUSED\n');process.exitCode=1;};
const [mode,volumePath]=process.argv.slice(2);
const dir=typeof volumePath==='string'?resolve(volumePath):'';
const root=dirname(dir);
if(process.env.JENIOS_R98_FIXTURE_ONLY!=='true'||
   process.env.VERCEL!==undefined||process.env.VERCEL_ENV!==undefined||
   !['seed','resume','verify'].includes(mode)||
   basename(dir)!=='private'||dirname(root)!==process.cwd()||
   !basename(root).startsWith('.jenios-r98-crash-'))fail();
else{
 const env={...process.env};
 const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
 const connectionId='50b85e9d-339c-4d32-b2bf-82c467673832';
 const now=1793091600000;
 const row={id:connectionId,user_id:owner,provider:'alpaca',
  environment:'paper',status:'active',identity_verified:true,
  external_digest:'a'.repeat(64),
  last_sync_at:new Date(now-1000).toISOString(),
  created_at:new Date(now-100000).toISOString()};
 const session={userId:owner,authenticated:true,diagnosticCompleted:true};
 const order={clientOrderId:'r98-pending-synthetic',mode:'direct',
  side:'buy',symbol:'AAPL',quantity:'1',entry:'100',stop:'98',target:'104'};
 const draft={session,storedConnection:row,mode:'direct',order,nowMs:now,
  signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,
   mode:'direct',side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
  source:{provider:'alpaca',environment:'paper',accountDigest:row.external_digest,
   accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,
   marketDataVerified:true,prospective:true,liveAccount:false,serverVerified:true},
  meta:{provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',
   settlement:'USD',contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'10',
   tickSize:'0.01',capturedAtMs:now-500,
   sourceSha256:'b'.repeat(64),quantityUnit:'base'},
  quote:{provider:'alpaca',instrument:'AAPL',receivedAtMs:now-200,
   sourceAtMs:now-200,bid:'99.98',ask:'100.02'},
  costs:{roundTripFeeBps:0,slippageBps:0,fundingCost:'0'}};
 const limits={currency:'USD',ownerRisk:'5',accountRisk:'5',orderRisk:'4',
  notional:'1000',dailyLoss:'5',maxOrders:3};
 let opened;
 try{
  opened=openR94PrivateJournal({env,volumePath:dir,connectionId});
  const ledger=opened.journal;
  const bound=alpacaPaperLedgerConnection(owner,row,{env,now});
  if(mode==='seed'){
   ledger.configure(session,bound,limits);
   const reserved=reserveAlpacaPaperProposal(draft,{ledger,env});
   assert.equal(reserved.ordersSent,0);
   ledger.event(session,bound,order.clientOrderId,
    {id:'simulated-interruption',kind:'SUBMITTING',
     atMs:now,cumulativeQuantity:'0'});
   // Simulate sudden power loss of the Node process: no SQLite .close().
   process.kill(process.pid,'SIGKILL');
  }
  const before=inspectR98CrashRecovery({
   session,storedConnection:row,ledger,nowMs:now
  },{env});
  assert.equal(before.recoveryPendingCount,1);
  assert.notEqual(before.heldRiskUnits,'0');
  if(mode==='resume'){
   assert.equal(before.unknownCount,0);
   ledger.event(session,bound,order.clientOrderId,{
    id:'post-crash-no-receipt',kind:'UNKNOWN',
    atMs:now+1,cumulativeQuantity:'0'});
   // An unrelated new intent cannot bypass the unresolved UNKNOWN.
   assert.throws(()=>reserveAlpacaPaperProposal({
    ...draft,order:{...order,clientOrderId:'second-after-crash'}
   },{ledger,env}),/RECONCILIATION_REQUIRED/);
  }
  const after=inspectR98CrashRecovery({
   session,storedConnection:row,ledger,nowMs:now
  },{env});
  assert.equal(after.unknownCount,1);
  assert.notEqual(after.heldRiskUnits,'0');
  assert.equal(after.automaticResubmissionAllowed,false);
  assert.equal(after.providerOrdersSent,0);
  assert.throws(()=>ledger.snapshot(
   {...session,userId:'untrusted-other-user'},bound
  ),/ACCOUNT_OWNER_MISMATCH/);
  opened.close();opened=null;
  process.stdout.write(JSON.stringify({
   phase:mode,unknown:after.unknownCount,held:true,
   brokerCalls:0,ordersSent:0,liveExecution:false,
   restoredFromBackup:mode==='verify'
  })+'\n');
 }catch{
  try{opened?.close();}catch{}
  fail();
 }
}
