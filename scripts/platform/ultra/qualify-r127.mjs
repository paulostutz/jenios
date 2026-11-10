/** Offline integration only: no credentials, SDK, HTTP client or native-order option. */
import assert from 'node:assert/strict';
import {mkdirSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {digest} from '../../../lib/platform/ultra/client/journal.mjs';
import {AttributedExecutionLedgerR127} from '../../../lib/platform/ultra/client/operation-records-r127.mjs';
import {UltraExecutionRuntimeR127} from '../../../lib/platform/ultra/client/execution-runtime-r127.mjs';
import {OfflineFixtureBrokerR127} from '../../../lib/platform/ultra/client/runtime-fixture-r127.mjs';
import {quantityText} from '../../../lib/platform/ultra/client/fixture-broker.mjs';
import {units12,operationNet} from '../../../lib/platform/ultra/operation.mjs';

const initialTime=Date.parse('2026-11-10T12:00:00Z');
export const scenariosR127=Object.freeze([
 {id:'jenios-spot',sourcePlatform:'jenios',provider:'binance',market:'crypto',product:'spot',symbol:'FIXTUREUSDT',currency:'USDT'},
 {id:'flow-futures',sourcePlatform:'flow',provider:'binance',market:'crypto',product:'usds_m_futures',symbol:'FIXTUREUSDT',currency:'USDT'},
 {id:'jenios-mini-index',sourcePlatform:'jenios',provider:'profit',market:'b3',product:'b3_mini',symbol:'WINZ99',currency:'BRL'},
 {id:'flow-mini-usd',sourcePlatform:'flow',provider:'profit',market:'b3',product:'b3_mini',symbol:'WDOZ99',currency:'BRL'}
].map(Object.freeze));

export async function qualifyScenarioR127(directory,scenario){
 if(!scenariosR127.includes(scenario))throw Error('R127_FIXED_FIXTURE_SCENARIO_REQUIRED');
 const clock={now:initialTime};
 const binding={account:'synthetic-'+scenario.id,environment:'demo',provider:scenario.provider};
 const config={markets:[{id:scenario.market,provider:scenario.provider,currency:scenario.currency,capital:1000,leverage:20}],
  sessionMinutes:60,maxPositions:3,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
 const context={sourcePlatform:scenario.sourcePlatform,connectionId:'fixture-'+scenario.id,ownerScope:'synthetic-owner-'+scenario.id,
  sessionId:'synthetic-session-'+scenario.id,strategy:{id:'ultrafast-r18-r53',version:'R113-R125',configDigest:digest(config)},
  product:scenario.product==='b3_mini'?'b3':scenario.product,evidenceMode:'offline_fixture'};
 const path=join(directory,scenario.id+'.sqlite');
 let ledger=new AttributedExecutionLedgerR127(path,binding,context);
 const scope={provider:scenario.provider,environment:'demo',product:scenario.product,accountFingerprint:ledger.binding};
 const adapter=new OfflineFixtureBrokerR127({scope,binding:ledger.binding,market:scenario.market,currency:scenario.currency,
  now:()=>clock.now,entry:'partial',symbol:scenario.symbol,freeMargin:1000});
 const runtimeFor=()=>new UltraExecutionRuntimeR127({config,market:scenario.market,ledger,adapter,scope,now:()=>clock.now,onWarning:async()=>true});
 let runtime=runtimeFor();const observations=[];
 const record=(phase,value)=>observations.push({phase,...value});
 try{
  await runtime.start();adapter.failAfterSubmit=true;
  const uncertain=await runtime.tick();assert.equal(uncertain.state,'reconciliation_required');
  const id=uncertain.clientOrderId;assert.equal(ledger.operation(id).state,'unknown');assert.equal(adapter.submissions,1);
  record('response_lost',{operationState:ledger.operation(id).state,fixtureSubmissions:adapter.submissions});
  assert.ok(ledger.recordBatch({now:clock.now}).records.some(r=>r.operation.state==='unknown'));
  ledger.close();clock.now+=100;
  ledger=new AttributedExecutionLedgerR127(path,binding,context);runtime=runtimeFor();await runtime.start({recover:true});
  assert.equal(adapter.submissions,1);assert.equal(ledger.operation(id).state,'open');
  assert.ok(units12(ledger.operation(id).entryQuantity)<units12(ledger.operation(id).requestedQuantity));
  record('recovered_partial_entry',{operationState:ledger.operation(id).state,fixtureSubmissions:adapter.submissions});
  runtime.pause();clock.now+=100;
  assert.equal((await runtime.cancel(id)).state,'confirmed');assert.equal(ledger.operation(id).state,'open');
  const half=quantityText(units12(ledger.operation(id).entryQuantity)/2n);clock.now+=100;
  assert.equal((await runtime.close(id,half)).state,'confirmed');assert.equal(ledger.operation(id).state,'partially_closed');
  assert.equal(operationNet(ledger.operation(id)),null);record('partial_exit',{operationState:ledger.operation(id).state,net:null});
  const remaining=quantityText(units12(ledger.operation(id).entryQuantity)-units12(ledger.operation(id).exitQuantity));clock.now+=100;
  assert.equal((await runtime.close(id,remaining)).state,'confirmed');assert.equal(ledger.operation(id).state,'closed');
  assert.equal(operationNet(ledger.operation(id)),null);record('closed_costs_pending',{operationState:ledger.operation(id).state,net:null});
  clock.now+=100;adapter.completeCosts(id);await runtime.reconcile();
  const operation=ledger.operation(id),batch=ledger.recordBatch({now:clock.now});
  const latest=batch.records.filter(r=>r.operation.id===id).at(-1);
  assert.equal(latest.result.status,'closed_complete');assert.equal(latest.result.afterBrokerCosts,operationNet(operation));
  assert.equal(latest.origin.strategy.id,context.strategy.id);assert.equal(latest.origin.sourcePlatform,scenario.sourcePlatform);
  assert.equal(latest.origin.sessionId,context.sessionId);assert.equal(latest.evidence.brokerAuthenticated,false);
  assert.equal(latest.evidence.nativeValidated,false);assert.equal(batch.financialActivationAllowed,false);
  assert.equal(batch.billingDecisionIncluded,false);assert.equal(new Set(batch.records.map(r=>r.eventId)).size,batch.records.length);
  assert.deepEqual(ledger.recordBatch({now:clock.now}),batch);
  assert.deepEqual(ledger.recordBatch({cursor:batch.nextCursor,now:clock.now}).records,[]);assert.equal(adapter.submissions,1);
  record('late_costs_recorded',{operationState:operation.state,net:operationNet(operation),fixtureSubmissions:adapter.submissions});
  return {scenario:scenario.id,sourcePlatform:scenario.sourcePlatform,provider:scenario.provider,product:scenario.product,
   symbol:scenario.symbol,environment:'demo',evidenceMode:'offline_fixture',observations,fixtureSubmissions:adapter.submissions,
   fixtureCommandSubmissions:adapter.commandSubmissions,realOrdersSent:0,externalDemoOrdersSent:0,nativeValidated:false,
   billingDecisionIncluded:false,latestOperation:operation,recordBatch:batch};
 }finally{try{ledger.close();}catch{}}
}

export async function qualifyR127(outputDirectory){
 const directory=resolve(outputDirectory);mkdirSync(directory,{recursive:true,mode:0o700});
 if(readdirSync(directory).length)throw Error('R127_QUALIFICATION_DIRECTORY_MUST_BE_EMPTY');
 const results=[];for(const scenario of scenariosR127)results.push(await qualifyScenarioR127(directory,scenario));
 const report={schema:'JENIOS_ULTRA_OFFLINE_QUALIFICATION_R127',syntheticClock:new Date(initialTime).toISOString(),
  evidenceMode:'offline_fixture',nativeValidated:false,externalDemoTested:false,liveExecutionAllowed:false,
  productionPublished:false,billingActivated:false,realOrdersSent:0,externalDemoOrdersSent:0,results};
 const reportPath=join(directory,'R127-OFFLINE-INTEGRATION.json');
 writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});return {report,reportPath};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==3)throw Error('USAGE: node qualify-r127.mjs EMPTY_OUTPUT_DIRECTORY');
 const {report,reportPath}=await qualifyR127(process.argv[2]);
 console.log(JSON.stringify({reportPath,scenarios:report.results.length,evidenceMode:report.evidenceMode,
  nativeValidated:false,externalDemoTested:false,realOrdersSent:0,externalDemoOrdersSent:0}));
}
