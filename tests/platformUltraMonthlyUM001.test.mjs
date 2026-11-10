import test from 'node:test';
import assert from 'node:assert/strict';
import {initialOperation} from '../lib/platform/ultra/operation.mjs';
import {monthlyPeriod,monthInZone,monthlyReportView,consolidateMonthlyReports,assessMonthlyPerformance} from '../lib/platform/ultra/client/monthly-report-um001.mjs';

// Only local fixtures: these flags, hashes and identifiers are fictitious,
// never attestations from a broker, platform wallet or the Letter central.
const NOW=Date.parse('2026-11-12T12:00:00Z');
const fingerprint='a'.repeat(64);
const clone=value=>structuredClone(value);
function closed(id,patch={}){
 const closedAt=patch.closedAt??'2026-10-21T15:00:00Z';
 const openedAt=patch.openedAt??new Date(Date.parse(closedAt)-60000).toISOString();
 const createdAt=patch.createdAt??new Date(Date.parse(openedAt)-1000).toISOString();
 return {...initialOperation({market:'b3',symbol:'WINZ26',currency:'BRL',side:'buy',quantity:'1'},id,Date.parse(createdAt)),
  state:'closed',openedAt,closedAt,updatedAt:closedAt,entryQuantity:'1',exitQuantity:'1',entryPrice:'100',exitPrice:'110',
  gross:'100',fees:'0',financing:'0',costsComplete:true,brokerRefs:[`fixture:${id}`],...patch};
}
const report=(operations,patch={})=>({schema:'JENIOS_ULTRA_OPERATIONS_V1',provider:'profit',environment:'demo',connectionLabel:'Conta fictícia UM001',generatedAt:'2026-11-03T12:00:00Z',accountFingerprint:fingerprint,operations,...patch});
const view=(r,options={})=>monthlyReportView(r,{month:'2026-10',timeZone:'America/Bahia',now:NOW,...options});
const source=(id,r,platform='jenios')=>({sourceId:id,report:r,platform});
const policy=(patch={})=>({version:'fixture-policy-um001',mode:'individual',planId:'fixture-plan',eligibilityReference:'fixture-plan-confirmation',aggregationScope:'single_account_confirmed',timeZone:'America/Bahia',timezoneReference:'fixture-calendar',...patch});
const evidence=(patch={})=>({sourceComplete:true,brokerReconciled:true,identityConfirmed:true,ultraAttributionConfirmed:true,settlementScopeComplete:true,
 platformCosts:{complete:true,treatmentReference:'fixture-platform-costs',eligibleAmount:'0'},priorLosses:{status:'none_confirmed',reference:'fixture-full-prior-history'},sha256:'b'.repeat(64),...patch});
const assess=(v,options={})=>assessMonthlyPerformance(v.groups[0],{period:v,policy:policy(),evidence:evidence(),syntheticOnly:true,...options});
const profitable=()=>view(report([closed('gain',{gross:'1500',fees:'200'}),closed('loss',{gross:'-300'})]));

test('UM001 monthly net includes both winning and losing trades before 20%/10%',()=>{
 const v=profitable(),g=v.groups[0];
 assert.deepEqual(g.confirmed,{gains:'1500.00000000',losses:'300.00000000',gross:'1200.00000000',fees:'200.00000000',financing:'0.00000000',net:'1000.00000000'});
 for(const [mode,rate,fee] of [['individual',2000,20000],['included',1000,10000]]){
  const a=assess(v,{policy:policy({mode})});
  assert.equal(a.status,'ready');assert.equal(a.complete,true);assert.equal(a.eligible_profit_minor,100000);assert.equal(a.rate_bps,rate);assert.equal(a.performance_minor,fee);
  assert.equal(a.calculation.subscriptionSeparate,true);assert.equal(a.calculation.annualSubscriptionWaivesPerformance,false);assert.equal(a.calculation.defiPerformanceSeparate,true);
  assert.equal(a.billable,false);assert.equal(a.chargeCreated,false);assert.equal(a.debitExecuted,false);assert.equal(a.realIntegration,false);
 }
});

test('UM001 negative month preserves loss and creates no performance obligation',()=>{
 const v=view(report([closed('loss',{gross:'-100',fees:'5'})]));
 const a=assess(v,{evidence:evidence({priorLosses:{status:'unknown'}})});
 assert.equal(a.status,'no_performance_due');assert.equal(a.eligible_profit_minor,-10500);assert.equal(a.performance_minor,0);
 assert.equal(a.calculation.eligibleProfit,'-105.00000000');assert.equal(a.chargeCreated,false);
});

test('UM001 missing costs remain null and cannot disappear behind a known subtotal',()=>{
 const pending=closed('pending-costs',{gross:'900',fees:null,costsComplete:false});
 const v=view(report([closed('known',{gross:'100'}),pending]));
 const g=v.groups[0];assert.equal(g.confirmed.net,'100.00000000');assert.equal(g.counts.awaitingCosts,1);assert.equal(g.provisional.gross,'900.00000000');assert.equal(g.provisional.fees,null);assert.equal(g.provisional.net,null);assert.equal(g.finalNet,null);
 const a=assess(v);assert.equal(a.status,'pending');assert.ok(a.pending_reasons.includes('COSTS_PENDING'));assert.equal(a.chargeCreated,false);
 const onlyPending=view(report([pending]));assert.equal(onlyPending.groups[0].confirmed.net,null);assert.equal(assess(onlyPending).eligible_profit_minor,null);
});

test('UM001 Bahia calendar uses half-open month boundaries instead of UTC calendar dates',()=>{
 const p=monthlyPeriod('2026-10','America/Bahia');
 assert.deepEqual(p,{month:'2026-10',timeZone:'America/Bahia',periodStart:'2026-10-01T03:00:00.000Z',periodEnd:'2026-11-01T03:00:00.000Z'});
 assert.equal(monthInZone('2026-11-01T02:59:59Z','America/Bahia'),'2026-10');
 assert.equal(monthInZone('2026-11-01T03:00:00Z','America/Bahia'),'2026-11');
 const v=view(report([closed('before',{closedAt:'2026-10-01T02:59:59Z'}),closed('start',{closedAt:p.periodStart}),closed('last',{closedAt:'2026-11-01T02:59:59Z'}),closed('next',{closedAt:p.periodEnd})]));
 assert.equal(v.groups[0].confirmed.net,'200.00000000');assert.equal(v.groups[0].counts.closed,2);
 assert.deepEqual(v.groups[0].operations.filter(o=>o.classification==='closed').map(o=>o.id).sort(),['last','start']);
});

test('UM001 open month stays pending despite complete fictitious evidence',()=>{
 const v=view(report([closed('november',{closedAt:'2026-11-02T15:00:00Z'})]),{month:'2026-11'});
 assert.equal(v.periodClosed,false);const a=assess(v);assert.equal(a.status,'pending');assert.ok(a.pending_reasons.includes('MONTH_OPEN'));
});

test('UM001 empty report provides no invented zero balance or zero result',()=>{
 const v=view(report([]));assert.deepEqual(v.groups,[]);assert.equal(v.walletBalance,null);assert.equal(v.sourceComplete,false);assert.equal(v.billable,false);
});

test('UM001 demo/live, account and currency partitions do not share a total',()=>{
 const sources=[source('demo',report([closed('brl'),closed('usd',{currency:'USD',gross:'7'})])),source('live',report([closed('brl',{gross:'9'})],{environment:'live'}),'flow'),source('other-account',report([closed('brl',{gross:'11'})],{accountFingerprint:'c'.repeat(64)}))];
 const v=consolidateMonthlyReports(sources,{month:'2026-10',now:NOW});assert.equal(v.groups.length,4);
 assert.equal(v.groups.find(g=>g.environment==='live').confirmed.net,'9.00000000');
 assert.equal(v.groups.find(g=>g.currency==='USD').confirmed.net,'7.00000000');
 assert.equal(v.groups.find(g=>g.accountFingerprint==='c'.repeat(64)).confirmed.net,'11.00000000');
 assert.equal(Object.hasOwn(v,'total'),false);assert.equal(Object.hasOwn(v,'net'),false);
});

test('UM001 mirror from JENIOS/Flow counts one operation and retains both sources',()=>{
 const r=report([closed('shared',{gross:'20'})]);const before=JSON.stringify(r);
 const v=consolidateMonthlyReports([source('jenios-export',r),source('flow-export',clone(r),'flow')],{month:'2026-10',now:NOW});
 assert.equal(v.groups.length,1);const g=v.groups[0];assert.equal(g.counts.closed,1);assert.equal(g.counts.duplicates,1);assert.equal(g.confirmed.net,'20.00000000');
 assert.equal(g.operations.length,1);assert.equal(g.operations[0].provenance.length,2);assert.deepEqual(g.sourceIds,['flow-export','jenios-export']);assert.equal(JSON.stringify(r),before);
});

test('UM001 divergent revisions stay pending instead of selecting the latest amount',()=>{
 const v=consolidateMonthlyReports([source('old',report([closed('same',{revision:1,gross:'20'})])),source('new',report([closed('same',{revision:2,gross:'200'})]),'flow')],{month:'2026-10',now:NOW});
 const g=v.groups[0];assert.equal(g.counts.conflicts,1);assert.equal(g.confirmed.net,null);assert.equal(g.operations[0].net,null);assert.equal(g.conflicts[0].variants.length,2);assert.ok(assess(v).pending_reasons.includes('DUPLICATE_CONFLICT'));
});

test('UM001 same broker reference on two IDs cannot double-count a fill',()=>{
 const v=view(report([closed('one',{brokerRefs:['fixture:shared-fill']}),closed('two',{brokerRefs:['fixture:shared-fill']})]));
 const g=v.groups[0];assert.equal(g.counts.conflicts,2);assert.equal(g.counts.closed,0);assert.equal(g.confirmed.net,null);assert.ok(g.operations.every(o=>o.net===null));
});

test('UM001 unidentified accounts stay separate despite equal labels and IDs',()=>{
 const r=report([closed('same')]);delete r.accountFingerprint;
 const v=consolidateMonthlyReports([source('local-one',r),source('local-two',clone(r),'flow')],{month:'2026-10',now:NOW});
 assert.equal(v.groups.length,2);assert.notEqual(v.groups[0].accountKey,v.groups[1].accountKey);assert.ok(v.groups.every(g=>g.counts.duplicates===0&&g.accountFingerprint===null));
});

test('UM001 next-month closing cannot become prior-month realized income or valuation',()=>{
 const r=report([closed('cross-month',{createdAt:'2026-10-31T22:00:00Z',openedAt:'2026-10-31T22:01:00Z',closedAt:'2026-11-01T04:00:00Z',gross:'1500',unrealized:'1400'})]);
 const october=view(r);const o=october.groups[0].operations[0];
 assert.equal(o.classification,'open_at_period_end');assert.equal(o.state,'open');assert.equal(o.closedAt,null);assert.equal(o.observedClosedAt,'2026-11-01T04:00:00Z');
 assert.equal(o.gross,null);assert.equal(o.fees,null);assert.equal(o.financing,null);assert.equal(o.unrealized,null);assert.equal(o.net,null);assert.equal(october.groups[0].confirmed.net,null);
 const november=view(r,{month:'2026-11'});assert.equal(november.groups[0].confirmed.net,'1500.00000000');
});

test('UM001 homogeneous MT5/B3 history preserves R125 compatibility',()=>{
 const v=view(report([closed('b3')],{provider:'mt5'}));assert.equal(v.provider,'mt5');assert.equal(v.groups[0].confirmed.net,'100.00000000');
 const mixed=report([closed('b3'),closed('forex',{market:'forex',symbol:'EURUSD',currency:'USD'})],{provider:'mt5'});
 assert.throws(()=>view(mixed),/INVALID_OPERATION/);
});

test('UM001 prior losses present or unknown keep positive-month performance pending',()=>{
 for(const status of ['present','unknown']){
  const a=assess(profitable(),{evidence:evidence({priorLosses:{status,reference:'fixture-history'}})});
  assert.equal(a.status,'pending');assert.ok(a.pending_reasons.includes('PRIOR_LOSS_POLICY_PENDING'));assert.equal(a.billable,false);
 }
});

test('UM001 cent precision, rate rounding and overflow require an explicit policy',()=>{
 for(const gross of ['10.001','10.01','9007199254740992']){
  const a=assess(view(report([closed('precision',{gross})])));
  assert.equal(a.status,'pending');assert.ok(a.pending_reasons.includes('ROUNDING_POLICY_PENDING'));assert.equal(a.chargeCreated,false);
 }
});

test('UM001 imported authority-shaped flags cannot authorize real billing',()=>{
 const v=profitable();
 const a=assess(v,{syntheticOnly:false,evidence:evidence({authoritative:true,verified:true,letterConfirmed:true})});
 assert.equal(a.status,'pending');assert.ok(a.pending_reasons.includes('AUTHORITATIVE_INTEGRATION_PENDING'));assert.equal(a.synthetic_only,false);assert.equal(a.billable,false);assert.equal(a.chargeCreated,false);
 assert.equal(v.sourceComplete,false);assert.equal(v.independentlyVerified,false);
});

test('UM001 missing plan, platform costs or complete client scope remains an assessment',()=>{
 const cases=[{policy:policy({mode:'unconfirmed'})},{evidence:evidence({platformCosts:{complete:false}})},{evidence:evidence({settlementScopeComplete:false})}];
 for(const options of cases){const a=assess(profitable(),options);assert.equal(a.status,'pending');assert.equal(a.complete,false);assert.equal(a.chargeCreated,false);assert.equal(a.debitExecuted,false);}
});

test('UM001 USD performance never implies a BRL conversion',()=>{
 const v=view(report([closed('usd',{currency:'USD',gross:'1000'})]));const a=assess(v);
 assert.equal(a.status,'pending');assert.ok(a.pending_reasons.includes('CURRENCY_CONVERSION_PENDING'));assert.equal(a.calculation.currency,'USD');assert.equal(a.calculation.eligibleProfit,'1000.00000000');
});

test('UM001 unknown execution and partial realization cannot be finalized',()=>{
 const partial=closed('partial',{state:'partially_closed',closedAt:null,exitQuantity:'0.5',gross:'40'});
 const unknown={...initialOperation({market:'b3',symbol:'WINZ26',currency:'BRL',side:'buy',quantity:'1'},'unknown',Date.parse('2026-10-21T15:00:00Z')),state:'unknown'};
 const v=view(report([closed('closed'),partial,unknown]));const g=v.groups[0];
 assert.equal(g.counts.closed,1);assert.equal(g.counts.open,1);assert.equal(g.counts.provisional,1);assert.equal(g.counts.uncertain,1);assert.equal(g.confirmed.net,'100.00000000');
 const a=assess(v);assert.equal(a.status,'pending');assert.ok(a.pending_reasons.includes('PARTIAL_ALLOCATION_PENDING'));assert.ok(a.pending_reasons.includes('EXECUTION_UNCERTAIN'));
});

test('UM001 a source exported before month end cannot become complete merely because now is later',()=>{
 const v=view(report([closed('early-export-profit',{gross:'1000'})],{generatedAt:'2026-10-22T12:00:00Z'}));
 assert.equal(v.periodClosed,true);
 assert.equal(v.groups[0].confirmed.net,'1000.00000000');
 // Complete fixture declarations cannot extend the source's own earlier cutoff.
 const a=assess(v,{evidence:evidence({sourceComplete:true,brokerReconciled:true})});
 assert.equal(a.status,'pending');assert.equal(a.complete,false);
 assert.ok(a.pending_reasons.includes('SOURCE_CUTOFF_PENDING'));assert.equal(a.chargeCreated,false);
});

test('UM001 known or missing costs on open and cancelled operations prevent a final eligible result',()=>{
 const open=closed('open-costs',{state:'open',closedAt:null,exitQuantity:'0',exitPrice:null,gross:'0',fees:'100',financing:null,costsComplete:false});
 const cancelled={...initialOperation({market:'b3',symbol:'WINZ26',currency:'BRL',side:'buy',quantity:'1'},'cancelled-costs',Date.parse('2026-10-21T15:00:00Z')),
  state:'cancelled',gross:'0',fees:'50',financing:'0',costsComplete:true};
 const nonClosed=[open,cancelled,
  {...open,id:'open-unknown-costs',gross:null,fees:null,financing:null,costsComplete:false},
  {...cancelled,id:'cancelled-unknown-costs',gross:null,fees:null,financing:null,costsComplete:false},
 ];
 for(const observation of nonClosed){
  const v=view(report([closed('closed-profit',{gross:'1000'}),observation]));
  assert.equal(v.groups[0].confirmed.net,'1000.00000000');
  assert.ok(v.groups[0].operations.some(operation=>operation.id===observation.id));
  // Allocation is not established by the closed subtotal or generic evidence.
  const a=assess(v);
  assert.equal(a.status,'pending',observation.id);assert.equal(a.complete,false);
  assert.ok(a.pending_reasons.includes('NON_CLOSED_AMOUNTS_PENDING'),observation.id);
  assert.equal(a.chargeCreated,false);
 }
});

test('UM001 a no-prior-loss fixture cannot contradict a prior losing month visible in the same report',()=>{
 const v=view(report([
  closed('prior-month-loss',{gross:'-500',closedAt:'2026-09-21T15:00:00Z'}),
  closed('current-month-profit',{gross:'1000'}),
 ]));
 assert.equal(v.groups[0].confirmed.net,'1000.00000000');
 const a=assess(v,{evidence:evidence({priorLosses:{status:'none_confirmed',reference:'fixture-contradictory-history'}})});
 assert.equal(a.status,'pending');assert.equal(a.complete,false);
 assert.ok(a.pending_reasons.includes('OBSERVED_PRIOR_LOSS_PENDING'));assert.equal(a.chargeCreated,false);
});

test('UM001 observed multiple accounts prevent isolated performance despite a single-account fixture claim',()=>{
 const v=consolidateMonthlyReports([
  source('profitable-account',report([closed('account-a-profit',{gross:'1000'})])),
  source('losing-account',report([closed('account-b-loss',{gross:'-1000'})],{accountFingerprint:'d'.repeat(64)}),'flow'),
 ],{month:'2026-10',timeZone:'America/Bahia',now:NOW});
 assert.equal(v.groups.length,2);
 assert.deepEqual(v.groups.map(group=>group.confirmed.net).sort(),['-1000.00000000','1000.00000000']);
 for(const group of v.groups){
  const a=assessMonthlyPerformance(group,{period:v,policy:policy({aggregationScope:'single_account_confirmed'}),evidence:evidence({settlementScopeComplete:true}),syntheticOnly:true});
  assert.equal(a.status,'pending');assert.equal(a.complete,false);
  assert.ok(a.pending_reasons.includes('MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED'));assert.equal(a.chargeCreated,false);
 }
});
