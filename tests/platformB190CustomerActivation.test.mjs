import test from 'node:test';import assert from 'node:assert/strict';
import {customerBrokerActivation,brokerActivationCatalog} from '../lib/platform/connections/b190-customer-activation.mjs';
const now=1792526000000;
const base={id:'aa',provider:'alpaca',environment:'paper',status:'active',connectedForReadOnlyDemo:true,
 identityVerified:true,lastSyncedAt:new Date(now-1000).toISOString(),
 permissionsVerified:true,brokerApiReadOnlyPermissionVerified:true,liveExecution:true,realExecutionAuthorized:true};
test('B190 exactly twelve official integration routes and only two read-only test adapters',()=>{
 const c=brokerActivationCatalog();assert.equal(c.length,12);assert.equal(c.filter(x=>x.availableReadOnlyTestAdapter).length,2);
 assert.ok(c.every(x=>!x.executableConnectorCertified&&!x.liveOrdersAllowed&&!x.custody));
});
for(const provider of ['alpaca','binance'])test('B190 '+provider+' authentic read is not trading permission even when browser claims it',()=>{
 const b=provider==='binance'?{...base,provider,environment:'testnet'}:base;
 const r=customerBrokerActivation({provider,connection:b,nowMs:now});
 assert.equal(r.code,'READ_ONLY_DEMO_LINKED');assert.equal(r.authenticatedAccount,true);
 assert.equal(r.permissionsVerified,false);assert.equal(r.paperOrdersCertified,false);
 assert.equal(r.civilAccountOwnershipVerified,false);
 assert.equal(r.realExecutionAuthorized,false);assert.equal(r.liveOrdersAllowed,false);assert.equal(r.ordersSubmittedByThisAssessment,0);
 assert.ok(r.actions.includes('VERIFY_BROKER_PERMISSIONS_INDEPENDENTLY'));
});
test('B190 stale, revoked, wrong provider and account identity missing fail closed',()=>{
 for(const [patch,code] of [[{lastSyncedAt:new Date(now-300001).toISOString()},'READ_STALE_OR_UNCONFIRMED'],
  [{status:'revoked'},'NO_ACCOUNT_LINKED'],[{provider:'binance'},'NO_ACCOUNT_LINKED'],
  [{identityVerified:false},'ACCOUNT_IDENTITY_UNCONFIRMED']]){
  const r=customerBrokerActivation({provider:'alpaca',connection:{...base,...patch},nowMs:now});
  assert.equal(r.code,code);assert.equal(r.realExecutionAuthorized,false);
 }
});
test('B190 non-implemented providers show guides, never executable integration',()=>{
 for(const id of ['profit','genial','clear','xp','btg','mt5','ctrader','ibkr','mercado-bitcoin','kraken']){
  const r=customerBrokerActivation({provider:id,connection:{...base,provider:id},nowMs:now});
  assert.equal(r.code,'GUIDE_ONLY');assert.equal(r.realExecutionAuthorized,false);
 }
 assert.throws(()=>customerBrokerActivation({provider:'invented',nowMs:now}),/UNLISTED_BROKER/);
});
test('B190 active platform UI uses the server-read-only status without ever exposing credentials',()=>{
 const src=readFileSync('app/components/platform/DemoBrokerConnector.js','utf8');
 assert.match(src,/customerBrokerActivation/);assert.match(src,/data-b190-activation-status/);
 assert.doesNotMatch(src,/console\.log|localStorage|sessionStorage/);
});
import {readFileSync} from 'node:fs';
