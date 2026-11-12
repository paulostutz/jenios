import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,readdirSync,appendFileSync,symlinkSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {CORE_SHA} from '../lib/platform/pilot-prep/contracts.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {createR99OfflineSnapshot,restoreR99OfflineSnapshot} from '../lib/platform/connections/private-journal-hot-backup-r99.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const other='b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496';
const id='50b85e9d-339c-4d32-b2bf-82c467673832',now=1793091600000;
const qaEnv={VERCEL_ENV:'preview',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'};
const offlineEnv={
 JENIOS_R99_OFFLINE_HOT_BACKUP_ONLY:'true',
 JENIOS_R99_OFFLINE_COLD_RESTORE_ONLY:'true',
 JENIOS_R94_PRIVATE_WORKER_ENABLED:'false',
 JENIOS_R94_READONLY_ONLY:'true',
 JENIOS_R93_PRIVATE_NODE_WORKER:'false',
 JENIOS_R93_READONLY_RECOVERY_ENABLED:'false',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
 JENIOS_R80_PRIVATE_ISSUER_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_PRIVATE_NODE_WORKER:'false',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',
 JENIOS_INTER_CHARGES_ENABLED:'false'};
const stored={id,user_id:owner,provider:'alpaca',environment:'paper',
 status:'active',identity_verified:true,external_digest:'a'.repeat(64),
 last_sync_at:new Date(now-1000).toISOString(),
 created_at:new Date(now-100000).toISOString()};
const session={userId:owner,authenticated:true,diagnosticCompleted:true};
const order={clientOrderId:'r99-hot-backup-synthetic',mode:'direct',side:'buy',
 symbol:'AAPL',quantity:'1',entry:'100',stop:'98',target:'104'};
const proposal={session,storedConnection:stored,mode:'direct',order,nowMs:now,
 signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,
  mode:'direct',side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
 source:{provider:'alpaca',environment:'paper',accountDigest:stored.external_digest,
  accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,
  marketDataVerified:true,prospective:true,liveAccount:false,serverVerified:true},
 meta:{provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',
  settlement:'USD',contractSize:'1',qtyStep:'1',minQty:'1',maxQty:'10',
  tickSize:'0.01',capturedAtMs:now-500,sourceSha256:'b'.repeat(64),quantityUnit:'base'},
 quote:{provider:'alpaca',instrument:'AAPL',receivedAtMs:now-200,
  sourceAtMs:now-200,bid:'99.98',ask:'100.02'},
 costs:{roundTripFeeBps:0,slippageBps:0,fundingCost:'0'}};
const limits={currency:'USD',ownerRisk:'5',accountRisk:'5',
 orderRisk:'4',notional:'1000',dailyLoss:'5',maxOrders:3};
function fixture(){
 const root=mkdtempSync(join(process.cwd(),'.jenios-r99-'));
 const source=join(root,'source'),backup=join(root,'backup'),restore=join(root,'restore');
 for(const path of [source,backup,restore])mkdirSync(path,{mode:0o700});
 let ledger;
 return {root,source,backup,restore,
  open(){ledger=new PaperLedger(join(source,'paper-'+id+'.sqlite'));return ledger;},
  close(){ledger?.close();ledger=null;},
  cleanup(){ledger?.close();rmSync(root,{recursive:true,force:true});}
 };
}
function seed(ledger){
 const bound=alpacaPaperLedgerConnection(owner,stored,{now,env:qaEnv});
 ledger.configure(session,bound,limits);
 const reserve=reserveAlpacaPaperProposal(proposal,{ledger,env:qaEnv});
 assert.equal(reserve.ordersSent,0);
 ledger.event(session,bound,order.clientOrderId,{id:'before-backup',
  kind:'SUBMITTING',atMs:now,cumulativeQuantity:'0'});
 ledger.event(session,bound,order.clientOrderId,{id:'ambiguous-after-timeout',
  kind:'UNKNOWN',atMs:now+1,cumulativeQuantity:'0'});
 return bound;
}
function back(f,env=offlineEnv){return createR99OfflineSnapshot({env,
 sourceVolumePath:f.source,backupVolumePath:f.backup,connectionId:id});}
function recover(f,proof,env=offlineEnv){return restoreR99OfflineSnapshot({env,
 backupVolumePath:f.backup,restoreVolumePath:f.restore,
 connectionId:id,backupFileName:proof.backupFileName,
 expectedSha256:proof.backupSha256});}

test('R99 online backup includes uncheckpointed WAL and restores held UNKNOWN risk into a new B152',async()=>{
 const f=fixture();
 try{
  const ledger=f.open(),bound=seed(ledger);
  assert.equal(ledger.pendingRecovery(session,bound)[0].previousState,'UNKNOWN');
  const proof=await back(f);
  assert.equal(proof.consistentLocalSqliteSnapshotVerified,true);
  assert.equal(proof.ordersSent,0);
  assert.equal(proof.offsiteBackupVerified,false);
  assert.equal(proof.restoreAfterDeploymentCertified,false);
  assert.equal(proof.backupPages>0,true);
  assert.match(proof.backupSha256,/^[0-9a-f]{64}$/);
  // The source ledger is still open in WAL mode during the hot backup.
  assert.equal(ledger.pendingRecovery(session,bound)[0].previousState,'UNKNOWN');
  const restored=await recover(f,proof);
  assert.equal(restored.coldRestoreVerified,true);
  assert.equal(restored.operatorDisasterRecoveryCertified,false);
  f.close();
  const copy=new PaperLedger(join(f.restore,'paper-'+id+'.sqlite'));
  try{
   assert.equal(copy.pendingRecovery(session,bound)[0].previousState,'UNKNOWN');
   assert.notEqual(copy.snapshot(session,bound)[0].held,'0');
   assert.throws(()=>reserveAlpacaPaperProposal({
    ...proposal,order:{...order,clientOrderId:'r99-duplicate-attempt'}
   },{ledger:copy,env:qaEnv}),/RECONCILIATION_REQUIRED/);
   assert.throws(()=>copy.snapshot({...session,userId:other},bound),/ACCOUNT_OWNER_MISMATCH/);
  }finally{copy.close();}
 }finally{f.cleanup();}
});

test('R99 does not overwrite an existing restored journal',async()=>{
 const f=fixture();
 try{
  seed(f.open());const proof=await back(f);
  await recover(f,proof);
  await assert.rejects(recover(f,proof),/R99_RESTORE_TARGET_ALREADY_EXISTS/);
  assert.equal(readdirSync(f.restore).filter(x=>x.endsWith('.sqlite')).length,1);
 }finally{f.cleanup();}
});

test('R99 rejects corrupt snapshots, incorrect proofs and traversal before restoring',async()=>{
 const f=fixture();
 try{
  seed(f.open());const proof=await back(f);
  await assert.rejects(recover(f,{...proof,backupFileName:'../production.sqlite'}),
   /R99_RESTORE_PROOF_REQUIRED/);
  await assert.rejects(recover(f,{...proof,backupSha256:'f'.repeat(64)}),
   /R99_BACKUP_DIGEST_MISMATCH/);
  appendFileSync(join(f.backup,proof.backupFileName),'tampered');
  await assert.rejects(recover(f,proof),/R99_BACKUP_DIGEST_MISMATCH/);
  assert.deepEqual(readdirSync(f.restore),[]);
 }finally{f.cleanup();}
});

test('R99 refuses public Vercel, Live, weak-volume permissions, and same-destination backup',async()=>{
 const f=fixture();
 try{
  seed(f.open());
  for(const mutation of [
   {VERCEL:'1'}, {VERCEL_ENV:'preview'},
   {JENIOS_REAL_EXECUTION_ENABLED:'true'},
   {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},
   {JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true'},
   {JENIOS_PAY_PAYMENTS_ENABLED:'true'},
   {JENIOS_R99_OFFLINE_HOT_BACKUP_ONLY:'false'}
  ])await assert.rejects(back(f,{...offlineEnv,...mutation}),/R99_OFFLINE_NO_ORDERS_ONLY/);
  assert.deepEqual(readdirSync(f.backup),[]);
  await assert.rejects(createR99OfflineSnapshot({env:offlineEnv,
   sourceVolumePath:f.source,backupVolumePath:f.source,connectionId:id}),
   /R99_BACKUP_VOLUME_MUST_BE_DISTINCT/);
  chmodSync(f.backup,0o755);
  await assert.rejects(back(f),/R94_VOLUME_OWNERSHIP_REQUIRED/);
 }finally{f.cleanup();}
});
test('R103 cancellation claim survives WAL backup and cold restore without permitting a repeat',async()=>{
 const f=fixture();
 try{
  const ledger=f.open(),bound=seed(ledger);
  ledger.event(session,bound,order.clientOrderId,{id:'found-before-cancel',kind:'RECONCILED',reconciledState:'ACK',atMs:now+2,cumulativeQuantity:'0'});
  const details=ledger.orderDetails(session,bound,order.clientOrderId);
  const claim={fingerprint:details.fingerprint,updatedAtMs:details.updatedAtMs,brokerDigest:'b'.repeat(64),nowMs:now+3};
  assert.equal(ledger.claimCancellation(session,bound,order.clientOrderId,claim).claimed,true);
  const proof=await back(f);await recover(f,proof);f.close();
  const restored=new PaperLedger(join(f.restore,'paper-'+id+'.sqlite'));
  try{
   assert.equal(restored.orderDetails(session,bound,order.clientOrderId).cancellationAttempted,true);
   assert.equal(restored.snapshot(session,bound)[0].state,'UNKNOWN');
   assert.notEqual(restored.snapshot(session,bound)[0].held,'0');
   assert.equal(restored.claimCancellation(session,bound,order.clientOrderId,claim).claimed,false);
  }finally{restored.close();}
 }finally{f.cleanup();}
});
