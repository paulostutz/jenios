/** Fixed offline harness. No credentials, network, external API or live option. */
import assert from 'node:assert/strict';
import {mkdirSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {digest} from '../../../lib/platform/ultra/client/journal.mjs';
import {AttributedExecutionLedgerR127} from '../../../lib/platform/ultra/client/operation-records-r127.mjs';
import {OfflineFixtureBrokerR127} from '../../../lib/platform/ultra/client/runtime-fixture-r127.mjs';
import {DurableUltraRuntimeR129} from '../../../lib/platform/ultra/client/session-runtime-r129.mjs';
import {quantityText} from '../../../lib/platform/ultra/client/fixture-broker.mjs';
import {operationNet,units12} from '../../../lib/platform/ultra/operation.mjs';
import {createUltraStartFeeLaboratory} from '../../../lib/platform/ultra/fees-um001.mjs';
import {ingestRecordBatchesR129,monthlyRecordsReportR129} from '../../../lib/platform/ultra/client/records-monthly-r129.mjs';
import {createLetterMonthlyR129,monthlyFixtureDigestR129} from '../../../lib/platform/ultra/client/letter-monthly-r129.mjs';

const MONTH='2026-10',TIME_ZONE='America/Bahia';
const INITIAL_TIME=Date.parse('2026-10-20T12:00:00Z');
const CLOSED_TIME=Date.parse('2026-11-01T03:00:01Z');
const planId='synthetic:plan:fixture-chargeable';
const fixtureBinding=client=>Object.freeze({registrationId:'fixture-registration-'+client,clientId:'synthetic:client:'+client,ownerScope:'synthetic:owner:'+client,evidenceMode:'offline_fixture'});
export const scenariosR129=Object.freeze([
 {id:'jenios-spot',sourcePlatform:'jenios',provider:'binance',market:'crypto',product:'spot',symbol:'FIXTUREUSDT',currency:'USDT',client:'spot',capital:1000,trades:3,knownFee:'0.10000000'},
 {id:'flow-futures',sourcePlatform:'flow',provider:'binance',market:'crypto',product:'usds_m_futures',symbol:'FIXTUREUSDT',currency:'USDT',client:'futures',capital:1000,trades:3,knownFee:'0.10000000'},
 // This fixed synthetic account produces a performance above Letter's existing
 // minimum. The inherited minimum and arithmetic are never bypassed.
 {id:'jenios-mini-index',sourcePlatform:'jenios',provider:'profit',market:'b3',product:'b3_mini',symbol:'WINZ99',currency:'BRL',client:'single',capital:48000,trades:3,knownFee:'0.10000000'},
 {id:'flow-mini-usd',sourcePlatform:'flow',provider:'profit',market:'b3',product:'b3_mini',symbol:'WDOZ99',currency:'BRL',client:'general',capital:320,trades:1,knownFee:'0.00000000',lossOnly:true},
 {id:'jenios-mini-index-general',sourcePlatform:'jenios',provider:'profit',market:'b3',product:'b3_mini',symbol:'WINZ99',currency:'BRL',client:'general',capital:1000,trades:3,knownFee:'0.10000000'},
].map(Object.freeze));
// UM001 accountKey identifies the central fixture reservation account. Broker
// accountBinding stays separate in each attributed ledger.
const accountKey=scenario=>'synthetic:billing:'+scenario.client;
const billingIdentity=scenario=>({customer_id:fixtureBinding(scenario.client).clientId,billing_account_id:'synthetic:billing:'+scenario.client,environment:'demo'});
const cycleBinding=(scenario,cycleId)=>({accountKey:accountKey(scenario),ownerKey:fixtureBinding(scenario.client).ownerScope,cycleId});

/** Only fixture observations and known fixture costs differ. The existing
 * selector, sizing, order lifecycle, receipt journal and session remain reused. */
class MonthlyFixtureBroker extends OfflineFixtureBrokerR127 {
 constructor(options){super(options);this.monthlyLoss=false;this.knownFee=options.knownFee;}
 async observations(){return (await super.observations()).map(row=>this.monthlyLoss?{...row,microMomentumBps:-10,orderBookImbalance:-0.7}:row);}
 completeCosts(id){
  super.completeCosts(id);
  const row={...this.orders.get(id),fees:this.knownFee,financing:'0.00000000'};
  this.orders.set(id,row);this.history[this.history.length-1]=row;
 }
}

function createFeeAuthority(clock){
 return createUltraStartFeeLaboratory({syntheticOnly:true,now:()=>new Date(clock.now).toISOString(),fixtureRegistry:{
  syntheticOnly:true,
  plans:[{syntheticOnly:true,planId,label:'Classificação fictícia do ensaio',eligibility:'chargeable',evidenceRef:'synthetic:known-fixture-plan',enabled:true}],
  accounts:[...new Map(scenariosR129.map(scenario=>[accountKey(scenario),{syntheticOnly:true,accountKey:accountKey(scenario),ownerKey:fixtureBinding(scenario.client).ownerScope,planId,currency:'BRL',balanceCents:10000}])).values()],
 }});
}

function monthlyInput(recordEnvelope,{expectedAccountKeys,mode='individual',product='jenios'}={}){
 // The complete fixture inventory is registered before any trade. A shorter
 // feed is not permitted to redefine the accounts expected by this harness.
 assert.ok(Array.isArray(expectedAccountKeys)&&expectedAccountKeys.length>0);
 const keys=[...expectedAccountKeys].sort();
 assert.deepEqual([...recordEnvelope.observedAccountKeys].sort(),keys);
 const clientId=recordEnvelope.fixtureBinding.clientId;
 const currency=recordEnvelope.groups[0]?.scope.currency;
 const settlementScope={company_id:'synthetic-company',customer_id:clientId,billing_account_id:'synthetic:billing:'+clientId.split(':').at(-1),
  receiver_id:'synthetic-letter-receiver',legal_entity_id:'synthetic-letter-entity',environment:'demo',currency,month:MONTH,timezone:TIME_ZONE};
 const period={month:MONTH,timeZone:TIME_ZONE,periodStart:recordEnvelope.periodStart,periodEnd:recordEnvelope.periodEnd};
 const accountBindings=keys.map((key,index)=>({...settlementScope,broker_account_id:'synthetic-broker-'+clientId.split(':').at(-1)+'-'+index,source_account_key:key,period_start:recordEnvelope.periodStart,period_end:recordEnvelope.periodEnd}));
 const fixtureEvidence={schema:'JENIOS_ULTRA_MONTHLY_FIXTURE_EVIDENCE_R129',evidenceMode:'offline_fixture',fixtureBinding:recordEnvelope.fixtureBinding,
  settlementBindingSha256:monthlyFixtureDigestR129({settlementScope,accountBindings}),
  envelopeSha256:monthlyFixtureDigestR129(recordEnvelope),period,accountKeys:keys,reference:'synthetic-known-complete-harness',
  accounts:keys.map(accountKey=>({accountKey,coverageReference:'synthetic-fixed-account-inventory',identityReference:'synthetic-harness-registration',
   attributionReference:'synthetic-durable-intents',executionReference:'synthetic-fixture-receipts',fillDetailLimitationReference:'synthetic-aggregate-only-not-native-fills'})),
  resolvedReasons:['LOCAL_FIXTURE_ONLY','CLIENT_BINDING_UNVERIFIED','SOURCE_COVERAGE_PENDING','ACCOUNT_IDENTITY_PENDING','MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED','ULTRA_ATTRIBUTION_PENDING','FILL_DETAIL_PENDING'],nativeFillDetail:false};
 return {recordEnvelope,month:MONTH,timeZone:TIME_ZONE,now:CLOSED_TIME,settlementScope,expectedAccountKeys:keys,
  accountBindings,
  policy:{version:'synthetic-r129-fixture-policy',mode,planId:'synthetic-fixture-'+mode,eligibilityReference:'synthetic-known-plan-condition',
   aggregationScope:keys.length===1?'single_account_confirmed':'explicit_account_set_confirmed',timeZone:TIME_ZONE,timezoneReference:'synthetic-known-month-boundaries'},
  evidence:{sourceComplete:true,brokerReconciled:true,identityConfirmed:true,ultraAttributionConfirmed:true,settlementScopeComplete:true,
   platformCosts:{complete:true,eligibleAmount:'0',treatmentReference:'synthetic-no-additional-eligible-platform-costs'},
   priorLosses:{status:'none_confirmed',reference:'synthetic-known-history-no-prior-loss'},sha256:monthlyFixtureDigestR129(recordEnvelope),fixtureEvidence},
  product,collectionProduct:product};
}

async function scenarioJourney(directory,scenario,{clock,startAuthority,letter}){
 const registered=fixtureBinding(scenario.client),cycleId='synthetic:cycle:'+scenario.id+':october';
 const cycle=cycleBinding(scenario,cycleId),binding={account:'synthetic-'+scenario.id,environment:'demo',provider:scenario.provider};
 const config={markets:[{id:scenario.market,provider:scenario.provider,currency:scenario.currency,capital:scenario.capital,leverage:20}],sessionMinutes:60,maxPositions:3,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
 const context={sourcePlatform:scenario.sourcePlatform,connectionId:'fixture-'+scenario.id,ownerScope:registered.ownerScope,sessionId:'fixture-session-'+scenario.id,
  strategy:{id:'ultrafast-r18-r53',version:'R113-R125',configDigest:digest(config)},product:scenario.product==='b3_mini'?'b3':scenario.product,evidenceMode:'offline_fixture'};
 const path=join(directory,scenario.id+'.sqlite');
 let ledger=new AttributedExecutionLedgerR127(path,binding,context);
 const scope={provider:scenario.provider,environment:'demo',product:scenario.product,accountFingerprint:ledger.binding};
 const adapter=new MonthlyFixtureBroker({scope,binding:ledger.binding,market:scenario.market,currency:scenario.currency,now:()=>clock.now,entry:'partial',symbol:scenario.symbol,freeMargin:scenario.capital>1000?10000:1000,knownFee:scenario.knownFee});
 const options=()=>({sessionId:context.sessionId,ownerScope:context.ownerScope,connectionScope:context.connectionId,config,market:scenario.market,ledger,adapter,scope,now:()=>clock.now,onWarning:async()=>true,
  fixtureBinding:registered,startFee:{authority:startAuthority,authorityId:'synthetic:um001:r129-shared',...cycle,requestId:'synthetic:start:'+scenario.id+':october'},
  performanceAuthority:letter.createPerformanceAuthority({fixtureBinding:registered,cycleBinding:cycle,gateIdentity:billingIdentity(scenario),now:()=>clock.now})});
 let runtime=new DurableUltraRuntimeR129(options());
 let state=ingestRecordBatchesR129(null,[{fromCursor:null,batch:ledger.recordBatch({now:clock.now})}],{fixtureBinding:registered,now:clock.now});
 const registeredInventory=monthlyRecordsReportR129(state,{month:MONTH,timeZone:TIME_ZONE,now:clock.now}).observedAccountKeys;
 assert.equal(registeredInventory.length,1);const expectedAccountKey=registeredInventory[0];
 const stages=[],operationIds=[];
 function capture(phase,observedAt=clock.now){
  const fromCursor=state?.feeds.find(feed=>feed.feedId===ledger.recordFeedId)?.nextCursor??null;
  const batch=ledger.recordBatch({cursor:fromCursor,limit:1000,now:observedAt});
  state=ingestRecordBatchesR129(state,[{fromCursor,batch}],{fixtureBinding:registered,now:observedAt});
  const report=monthlyRecordsReportR129(state,{month:MONTH,timeZone:TIME_ZONE,now:observedAt}),group=report.groups[0]?.monthly;
  stages.push({phase,operationCount:state.operationCount,revisionCount:state.eventCount,knownNet:group?.confirmed.net??null,
   awaitingCosts:group?.counts.awaitingCosts??null,uncertain:group?.counts.uncertain??null,fixtureSubmissions:adapter.submissions,
   reservations:startAuthority.readReservationJournal().filter(row=>row.accountKey===cycle.accountKey&&row.cycleId===cycleId).length,
   finalNet:report.finalNet,pendingReasons:report.pendingReasons.map(reason=>reason.code)});
  return report;
 }
 try{
  const started=await runtime.start();const expiry=started.session.expiresAtMs;
  await runtime.start();
  assert.equal(startAuthority.readReservationJournal().filter(row=>row.accountKey===cycle.accountKey&&row.cycleId===cycleId).length,1);
  const mirrored=startAuthority.reconnect({syntheticOnly:true,accountKey:cycle.accountKey,cycleId,platform:scenario.sourcePlatform==='jenios'?'flow':'jenios'});
  assert.equal(mirrored.reservation.reservedCents,500);
  for(let index=0;index<scenario.trades;index++){
   adapter.monthlyLoss=scenario.lossOnly===true||index===2;
   adapter.failAfterSubmit=index===0;clock.now+=100;
   const opening=await runtime.tick();const id=opening.clientOrderId;assert.ok(id);operationIds.push(id);
   if(index===0){
    assert.equal(opening.state,'reconciliation_required');assert.equal(ledger.operation(id).state,'unknown');capture('response_lost');
    adapter.connected=false;clock.now+=100;
    await assert.rejects(()=>runtime.tick(),/FIXTURE_DISCONNECTED/);
    assert.equal(adapter.submissions,1);assert.equal(ledger.paused(),true);capture('disconnected');
    adapter.connected=true;
    ledger.close();clock.now+=100;
    ledger=new AttributedExecutionLedgerR127(path,binding,context);runtime=new DurableUltraRuntimeR129(options());
    assert.equal((await runtime.start()).resumeRequired,true);
    await runtime.resume({recover:true});assert.equal(runtime.session().expiresAtMs,expiry);assert.equal(adapter.submissions,1);
    assert.equal(ledger.operation(id).state,'open');capture('recovered_partial_entry');
   }else assert.equal(opening.state,'open');
   adapter.failAfterSubmit=false;clock.now+=100;
   assert.equal((await runtime.cancel(id)).state,'confirmed');
   if(index===0){
    const half=quantityText(units12(ledger.operation(id).entryQuantity)/2n);clock.now+=100;
    assert.equal((await runtime.close(id,half)).state,'confirmed');assert.equal(ledger.operation(id).state,'partially_closed');assert.equal(operationNet(ledger.operation(id)),null);capture('partial_exit');
   }
   const remainder=quantityText(units12(ledger.operation(id).entryQuantity)-units12(ledger.operation(id).exitQuantity));clock.now+=100;
   assert.equal((await runtime.close(id,remainder)).state,'confirmed');assert.equal(ledger.operation(id).state,'closed');assert.equal(operationNet(ledger.operation(id)),null);
   capture('closed_costs_pending');
   clock.now+=100;adapter.completeCosts(id);await runtime.reconcile();capture('late_cost_revision');
   if(index+1<scenario.trades){runtime.pause();clock.now+=100;await runtime.resume();assert.equal(runtime.session().expiresAtMs,expiry);capture('same_cycle_resumed');}
  }
  assert.equal((await runtime.finish()).phase,'ended');
  const report=capture('month_closed',CLOSED_TIME);
  assert.equal(report.operationCount,scenario.trades);assert.equal(report.groups[0].monthly.counts.closed,scenario.trades);
  assert.equal(adapter.submissions,scenario.trades);assert.equal(report.finalNet,null);assert.equal(report.nativeValidated,false);
  const replay=ingestRecordBatchesR129(state,[state.pages[0]],{fixtureBinding:registered,now:CLOSED_TIME});assert.deepEqual(replay,state);
  assert.equal(startAuthority.readReservationJournal().filter(row=>row.accountKey===cycle.accountKey&&row.cycleId===cycleId).length,1);
  writeFileSync(join(directory,scenario.id+'-records.json'),JSON.stringify({state,report},null,2)+'\n',{mode:0o600});
  return {scenario,registered,binding,config,context,scope,path,adapter,state,report,cycle,expectedAccountKey,
   summary:{scenario:scenario.id,sourcePlatform:scenario.sourcePlatform,clientId:registered.clientId,provider:scenario.provider,product:scenario.product,
    environment:'demo',currency:scenario.currency,operationCount:scenario.trades,revisionCount:state.eventCount,
    fixtureSubmissions:adapter.submissions,cycleId,startReservationCount:1,reservedSyntheticCents:500,operationIds,
    knownNet:report.groups[0].monthly.confirmed.net,finalNet:null,stages,nativeValidated:false,realOrdersSent:0,externalDemoOrdersSent:0,realDebitsExecuted:0}};
 }finally{try{ledger.close();}catch{}}
}

async function exerciseLetterGate(single,{clock,startAuthority,letter}){
 const expectedAccountKeys=[single.expectedAccountKey];
 const individual=letter.prepare(monthlyInput(single.report,{expectedAccountKeys})),included=letter.prepare(monthlyInput(single.report,{expectedAccountKeys,mode:'included'}));
 assert.equal(individual.assessment.status,'ready');assert.equal(included.assessment.status,'ready');
 assert.equal(individual.assessment.rate_bps,2000);assert.equal(included.assessment.rate_bps,1000);
 clock.now=CLOSED_TIME+1000;
 const context={...single.context,sessionId:single.context.sessionId+'-november'},cycle=cycleBinding(single.scenario,'synthetic:cycle:'+single.scenario.id+':november');
 const ledger=new AttributedExecutionLedgerR127(single.path,single.binding,context),adapter=single.adapter;
 const authority=letter.createPerformanceAuthority({fixtureBinding:single.registered,cycleBinding:cycle,gateIdentity:billingIdentity(single.scenario),now:()=>clock.now});
 const runtime=new DurableUltraRuntimeR129({sessionId:context.sessionId,ownerScope:context.ownerScope,connectionScope:context.connectionId,config:single.config,market:single.scenario.market,ledger,adapter,scope:single.scope,now:()=>clock.now,onWarning:async()=>true,
  fixtureBinding:single.registered,startFee:{authority:startAuthority,authorityId:'synthetic:um001:r129-shared',...cycle,requestId:'synthetic:start:november:single'},performanceAuthority:authority});
 try{
  await runtime.start({recover:true});adapter.monthlyLoss=false;clock.now+=100;
  const exposure=await runtime.tick();assert.equal(exposure.state,'open');
  const registered=letter.register(individual),obligationId=individual.draft.obligation_id;
  assert.equal(individual.draft.status,'prepared',JSON.stringify(individual.emission));
  assert.equal(individual.emission.eligibleForSyntheticInvoice,true,JSON.stringify(individual.emission));
  assert.ok(obligationId);const repeated=letter.register(individual);assert.equal(repeated.created,false);assert.deepEqual(repeated.obligation,registered.obligation);
  letter.markSyntheticAwaitingPayment(obligationId,'synthetic-invoice-r129');
  const identity=billingIdentity(single.scenario),pending=letter.gate({...identity,action:'open'});assert.equal(pending.allowed_in_simulation,false);
  adapter.symbol='WINX99';const before=adapter.submissions;clock.now+=100;
  const blockedAttempt=await runtime.tick(),afterBlockedAttempt=adapter.submissions;
  assert.equal(afterBlockedAttempt,before);
  assert.equal(blockedAttempt.startPreparation.performanceGate.allowed,false);
  assert.equal(blockedAttempt.startPreparation.performanceGate.reason,'R129_PERFORMANCE_OPENINGS_BLOCKED');
  assert.equal(blockedAttempt.startPreparation.performanceGate.stage,'preflight');
  assert.equal(blockedAttempt.startPreparation.performanceGate.observedAtMs,clock.now);
  const preserved={};for(const action of ['read','reconcile','cancel','reduce_risk']){preserved[action]=letter.gate({...identity,action});assert.equal(preserved[action].allowed_in_simulation,true);}
  assert.equal((await runtime.cancel(exposure.clientOrderId)).state,'confirmed');
  assert.equal((await runtime.closePositions()).state,'confirmed');adapter.completeCosts(exposure.clientOrderId);await runtime.reconcile();
  const fake={status:'paid',amount_minor:individual.assessment.performance_minor};
  assert.throws(()=>letter.confirmSyntheticPayment(obligationId,fake));assert.equal(letter.gate({...identity,action:'open'}).allowed_in_simulation,false);
  clock.now=(Math.floor(clock.now/1000)+1)*1000;
  const receipt={...letter.expectedSyntheticReceipt(obligationId),state:'paid',verified_paid:true,
   proof_sha256:monthlyFixtureDigestR129({syntheticOnly:true,obligationId,fixture:'r129-payment'}),confirmed_at:new Date(clock.now).toISOString().replace('.000Z','Z')};
  const binding=letter.expectedSyntheticBinding(obligationId);
  const snapshot=letter.observeSyntheticLetter({receipt,binding,authority:'letter-synthetic-lab',synthetic_only:true});
  const confirmed=letter.confirmSyntheticPayment(obligationId,snapshot);
  assert.equal(letter.confirmSyntheticPayment(obligationId,snapshot).released_once,false);
  const released=letter.gate({...identity,action:'open'});assert.equal(released.allowed_in_simulation,true);assert.equal(released.actual_execution_authorized,false);
  clock.now+=100;await runtime.resume();const reopened=await runtime.tick();assert.equal(reopened.state,'open');assert.equal(adapter.submissions,before+1);
  assert.equal((await runtime.closePositions()).state,'confirmed');adapter.completeCosts(reopened.clientOrderId);await runtime.reconcile();assert.equal((await runtime.finish()).phase,'ended');
  const reservations=startAuthority.readReservationJournal().filter(row=>row.accountKey===cycle.accountKey);
  assert.equal(reservations.length,2);assert.equal(new Set(reservations.map(row=>row.cycleId)).size,2);
  return {schema:'JENIOS_ULTRA_LETTER_GATE_JOURNEY_R129',individual,included,obligationId,registered,pending,preserved,confirmed,released,
   blockedAttempt,beforeBlockedAttempt:before,afterBlockedAttempt,afterReleasedAttempt:adapter.submissions,
   firstCycleReservations:1,explicitSecondCycleReservations:1,realInvoicesCreated:0,realDebitsExecuted:0,realOrdersSent:0,actual_execution_authorized:false};
 }finally{ledger.close();}
}

export async function qualifyR129(outputDirectory){
 const directory=resolve(outputDirectory);mkdirSync(directory,{recursive:true,mode:0o700});
 if(readdirSync(directory).length)throw Error('R129_QUALIFICATION_DIRECTORY_MUST_BE_EMPTY');
 const clock={now:INITIAL_TIME},startAuthority=createFeeAuthority(clock),letter=createLetterMonthlyR129({syntheticOnly:true}),journeys=[];
 for(const scenario of scenariosR129){journeys.push(await scenarioJourney(directory,scenario,{clock,startAuthority,letter}));clock.now+=1000;}
 const generalJourneys=journeys.filter(journey=>journey.scenario.client==='general');
 const binding=fixtureBinding('general'),pages=generalJourneys.flatMap(journey=>journey.state.pages);
 const generalState=ingestRecordBatchesR129(null,pages,{fixtureBinding:binding,now:CLOSED_TIME});
 const generalReport=monthlyRecordsReportR129(generalState,{month:MONTH,timeZone:TIME_ZONE,now:CLOSED_TIME});
 assert.equal(generalReport.observedAccountKeys.length,2);
 const expectedAccountKeys=generalJourneys.map(journey=>journey.expectedAccountKey);
 const general20=letter.prepare(monthlyInput(generalReport,{expectedAccountKeys})),general10=letter.prepare(monthlyInput(generalReport,{expectedAccountKeys,mode:'included',product:'kivoryn_flow'}));
 assert.equal(general20.generalAssessment.status,'ready',JSON.stringify(general20.generalAssessment));assert.equal(general10.generalAssessment.status,'ready',JSON.stringify(general10.generalAssessment));
 assert.equal(general20.draft,null);assert.equal(general20.emission.obligation_id,null);assert.ok(general20.emission.pendingReasons.includes('LETTER_MULTI_ACCOUNT_CONTRACT_REQUIRED'));
 assert.ok(generalReport.groups.some(group=>Number(group.monthly.confirmed.net)<0));
 assert.ok(generalReport.groups.some(group=>Number(group.monthly.confirmed.net)>0));
 const single=journeys.find(journey=>journey.scenario.client==='single');
 const letterGate=await exerciseLetterGate(single,{clock,startAuthority,letter});
 const report={schema:'JENIOS_ULTRA_MONTHLY_QUALIFICATION_R129',evidenceMode:'offline_fixture',syntheticOnly:true,
  period:{month:MONTH,timeZone:TIME_ZONE,periodStart:generalReport.periodStart,periodEnd:generalReport.periodEnd},
  nativeValidated:false,externalDemoTested:false,liveExecutionAllowed:false,productionPublished:false,billingActivated:false,
  visualQaPerformed:false,realOrdersSent:0,externalDemoOrdersSent:0,realInvoicesCreated:0,realDebitsExecuted:0,
  results:journeys.map(journey=>journey.summary),general:{recordEnvelope:generalReport,individual:general20,included:general10},letterGate,
  reservationJournal:startAuthority.readReservationJournal(),letterAudit:letter.audit()};
 const reportPath=join(directory,'R129-OFFLINE-MONTHLY-INTEGRATION.json');
 writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});return {report,reportPath};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==3)throw Error('USAGE: node qualify-r129.mjs EMPTY_OUTPUT_DIRECTORY');
 const {report,reportPath}=await qualifyR129(process.argv[2]);
 console.log(JSON.stringify({reportPath,scenarios:report.results.length,evidenceMode:report.evidenceMode,nativeValidated:false,
  realOrdersSent:0,externalDemoOrdersSent:0,realInvoicesCreated:0,realDebitsExecuted:0,productionPublished:false}));
}
