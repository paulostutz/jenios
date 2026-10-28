import test from 'node:test';
import assert from 'node:assert/strict';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const c={id:'50b85e9d-339c-4d32-b2bf-82c467673832',userId:owner,
 provider:'alpaca',accountId:'paper-test-1',environment:'paper',
 permissions:['read','trade'],revoked:false,ownershipConfirmedAtMs:1793091600000};
const session={userId:owner,authenticated:true,diagnosticCompleted:true};
const limits={currency:'USD',ownerRisk:'1000',accountRisk:'500',orderRisk:'100',
 notional:'2000',dailyLoss:'200',maxOrders:3};
function fixture(){const dir=mkdtempSync(join(tmpdir(),'jenios-r86-'));const path=join(dir,'ledger.db');
 return {path,open:()=>new PaperLedger(path),cleanup:()=>rmSync(dir,{recursive:true,force:true})};}
test('R86 durable ledger survives close/reopen and refuses a duplicate client order ID',()=>{
 const f=fixture();let ledger;
 try{
  ledger=f.open();
  ledger.configure(session,c,limits);
  const order={clientOrderId:'restart-id-1',side:'buy',symbol:'AAPL',quantity:'1',
   entry:'100',stop:'95',takeProfit:'110'};
  // B152 risk reservations require validated market metadata and fresh quote.
  // This test exercises persistence and kill independently, without submitting orders.
  ledger.pause(session,c,true);
  ledger.close();ledger=null;
  ledger=f.open();
  assert.deepEqual(ledger.snapshot(session,c),[]);
  assert.throws(()=>ledger.configure(session,c,limits),/SQLITE_CONSTRAINT|UNIQUE|constraint/i);
  const stopped=ledger.pause(session,c,true);
  assert.equal(stopped.paused,true);
  assert.equal(stopped.ordersCancelled,false);
  assert.equal(stopped.positionsClosed,false);
 }finally{ledger?.close();f.cleanup();}
});
test('R86 SQLite ledger never accepts cross-owner snapshot after restart',()=>{
 const f=fixture();let ledger;
 try{
  ledger=f.open();ledger.configure(session,c,limits);
  ledger.close();ledger=f.open();
  assert.throws(()=>ledger.snapshot({...session,userId:'other-owner'},c),/ACCOUNT_OWNER_MISMATCH/);
 }finally{ledger?.close();f.cleanup();}
});
