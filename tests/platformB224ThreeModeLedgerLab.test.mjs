import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {PaperLedger} from '../lib/platform/pilot-prep/paper-ledger.mjs';
import {alpacaPaperLedgerConnection} from '../lib/platform/connections/alpaca-paper-risk-rehearsal.mjs';
import {exerciseThreeModesInPrivateLedger} from '../lib/platform/launch/b224-three-mode-ledger-lab.mjs';
const userId='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',id='50b85e9d-339c-4d32-b2bf-82c467673832',nowMs=1792530000000;
const session={userId,authenticated:true,diagnosticCompleted:true};
const storedConnection={id,user_id:userId,provider:'alpaca',environment:'paper',status:'active',
 external_digest:'d'.repeat(64),identity_verified:true,last_sync_at:new Date(nowMs-1000).toISOString(),
 created_at:new Date(nowMs-500).toISOString()};
const source={provider:'alpaca',environment:'paper',accountDigest:storedConnection.external_digest,
 accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,
 prospective:true,liveAccount:false,serverVerified:true};
const meta={provider:'alpaca',id:'AAPL',marketType:'spot',base:'AAPL',quote:'USD',settlement:'USD',contractSize:'1',
 qtyStep:'1',minQty:'1',maxQty:'100',tickSize:'0.01',capturedAtMs:nowMs-1000,sourceSha256:'b'.repeat(64),quantityUnit:'base'};
const quote={provider:'alpaca',instrument:'AAPL',receivedAtMs:nowMs-250,sourceAtMs:nowMs-500,bid:'99.99',ask:'100.01'};
const orderTemplate={clientOrderId:'rsk-modes',side:'buy',symbol:'AAPL',quantity:'4',entry:'100',stop:'99',target:'103'};
test('B224 3 original mode contracts hit the same B152 aggregate risk reserve',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-b224-'));const db=new PaperLedger(join(dir,'risk.sqlite'));
 const env={JENIOS_PRIVATE_PAPER_REHEARSAL:'true',VERCEL_ENV:'preview'};
 try{const connection=alpacaPaperLedgerConnection(userId,storedConnection,{env,now:nowMs});
  db.configure(session,connection,{currency:'USD',ownerRisk:'8',accountRisk:'8',orderRisk:'5',notional:'1500',dailyLoss:'8',maxOrders:6});
  const result=exerciseThreeModesInPrivateLedger({session,storedConnection,ledger:db,orderTemplate,source,meta,quote,costs:{roundTripFeeBps:0,slippageBps:0,fundingCost:'0'},nowMs},{env});
  assert.deepEqual(result.modes.map(x=>x.decision),['RESERVED_IN_SANDBOX','RESERVED_IN_SANDBOX','BLOCKED_BY_ORIGINAL_RISK_ENGINE']);
  assert.equal(result.newLedgerIntents,2);assert.equal(result.ordersSent,0);
  assert.equal(result.originalPrivateRobotDecisionsExecuted,false);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('B224 rejects live path before ledger mutation',()=>assert.throws(()=>exerciseThreeModesInPrivateLedger({session,storedConnection,orderTemplate},{env:{VERCEL_ENV:'production',JENIOS_PRIVATE_PAPER_REHEARSAL:'true'}}),/B224_SIMULATED_RISK_SCOPE_REQUIRED/));
