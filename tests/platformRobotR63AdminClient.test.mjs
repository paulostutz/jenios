import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchR63AdminFeed,requireR63AdminFeed,isR63AdminReportView,R63_ADMIN_FEED_URL}
  from '../lib/platform/research/robot-r63-admin-client.mjs';
import {runR63FixtureCycle,createR63FixtureInput} from '../lib/platform/research/robot-r63-fixture-cycle.mjs';
import {rollbackR63Evolution} from '../lib/platform/research/robot-r63-continuous-evolution.mjs';
import {buildR63AdminReport} from '../lib/platform/research/robot-r63-admin-report.mjs';

const session=()=>({data:{session:{access_token:'platform-fixture-token',user:{id:'fixture-admin',is_anonymous:false}}},error:null});
const clone=value=>JSON.parse(JSON.stringify(value));
const feed=report=>({
  schema:'JENIOS_R63_ADMIN_FEED_V1',adminOnly:true,source:'PRIVATE_RESEARCH_JOURNAL',
  evidenceKind:'SYNTHETIC_FIXTURE',revision:report?1:0,reports:report?[report]:[],
  updatedAt:'2026-10-24T12:00:00.000Z',productionIntegrationVerified:false,
  operationalDataDisclosureRequired:true,realOrdersSent:0,externalPaperOrdersSent:0,
});

test('R63 dedicated admin client preserves 404,401,403 and503 without fallback',async()=>{
  for(const status of [404,401,403,503]){
    let calls=0;const expected=Response.json({error:'fixture'},{status});
    const received=await fetchR63AdminFeed({getSession:async()=>session(),fetcher:async()=>{calls++;return expected;}});
    assert.equal(received,expected);assert.equal(received.status,status);assert.equal(calls,1);
  }
});

test('R63 client uses the fixed Platform endpoint with no-store, GET, no redirects and the supplied signal',async()=>{
  const controller=new AbortController();let called=0;
  const response=await fetchR63AdminFeed({getSession:()=>session(),signal:controller.signal,
    fetcher:async(url,options)=>{
      called++;assert.equal(url,R63_ADMIN_FEED_URL);assert.equal(options.method,'GET');
      assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
      assert.equal(options.signal,controller.signal);assert.deepEqual(options.headers,{authorization:'Bearer platform-fixture-token'});
      return Response.json(feed());
    }});
  assert.equal(called,1);assert.equal(response.status,200);
});

test('R63 absent, anonymous, errored or malformed Platform sessions never reach fetch',async()=>{
  let calls=0;
  for(const auth of [undefined,{data:{session:null}},
    {data:{session:{access_token:'fixture',user:{id:'fixture',is_anonymous:true}}}},
    {...session(),error:{message:'Auth failed'}},
    {data:{session:{access_token:'fixture',user:null}}},
    {data:{session:{access_token:'bad\r\nheader',user:{id:'fixture'}}}}]){
    const response=await fetchR63AdminFeed({getSession:()=>auth,fetcher:()=>{calls++;}});
    assert.equal(response.status,401);
  }
  assert.equal((await fetchR63AdminFeed({fetcher:()=>{calls++;}})).status,401);
  assert.equal(calls,0);
});

test('R63 thrown session failure is sanitized and does not consume a Social session',async()=>{
  let calls=0;
  const failed=await fetchR63AdminFeed({getSession:()=>{throw Error('private-session-details');},fetcher:()=>{calls++;}});
  assert.equal(failed.status,401);assert.equal((await failed.text()).includes('private-session-details'),false);
  const response=await fetchR63AdminFeed({getSession:()=>({data:{session:null},socialSession:session().data.session}),
    fetcher:()=>{calls++;}});
  assert.equal(response.status,401);assert.equal(calls,0);
  await assert.rejects(()=>fetchR63AdminFeed({getSession:()=>session(),getSocialSession:()=>session()}),
    {code:'R63_ADMIN_CLIENT_INVALID'});
});

test('R63 already-aborted request does not consult identity or make HTTP calls',async()=>{
  const controller=new AbortController();controller.abort();let calls=0;
  await assert.rejects(()=>fetchR63AdminFeed({signal:controller.signal,getSession:()=>{calls++;},fetcher:()=>{calls++;}}),
    {name:'AbortError'});
  assert.equal(calls,0);
});

test('R63 abort while identity resolves prevents a stale request from starting',async()=>{
  const controller=new AbortController();let resolveSession,calls=0;
  const pending=fetchR63AdminFeed({signal:controller.signal,getSession:()=>new Promise(resolve=>{resolveSession=resolve;}),
    fetcher:()=>{calls++;}});
  controller.abort();resolveSession(session());
  await assert.rejects(()=>pending,{name:'AbortError'});assert.equal(calls,0);
});

test('R63 abort while a provider ignores cancellation still discards its late response',async()=>{
  const controller=new AbortController();let resolveFetch;
  const started=new Promise(resolve=>{
    resolveFetch={started:resolve};
  });
  const pending=fetchR63AdminFeed({getSession:()=>session(),signal:controller.signal,
    fetcher:()=>new Promise(resolve=>{resolveFetch.finish=resolve;resolveFetch.started();})});
  await started;controller.abort();resolveFetch.finish(Response.json(feed()));
  await assert.rejects(()=>pending,{name:'AbortError'});
});

test('R63 feed validator accepts real synthetic reports including rejection, no-change and rollback',()=>{
  assert.equal(requireR63AdminFeed(feed()).reports.length,0);
  for(const scenario of ['improve','regression','insufficient','control_violation']){
    const cycle=runR63FixtureCycle(createR63FixtureInput({scenario}));
    assert.equal(isR63AdminReportView(cycle.report),true,scenario);
    assert.equal(requireR63AdminFeed(feed(cycle.report)).reports[0],cycle.report);
  }
  const cycle=runR63FixtureCycle();
  const evolution=rollbackR63Evolution({state:cycle.evolution,reason:'REGRESSION_DETECTED',nowMs:cycle.evolution.updatedAtMs+1000});
  const report=buildR63AdminReport({study:cycle.study,evolution,period:cycle.report.period,generatedAtMs:cycle.report.generatedAtMs});
  assert.equal(isR63AdminReportView(report),true);
});

test('R63 schema-only report or absent nested rendering fields become a controlled contract error',()=>{
  assert.throws(()=>requireR63AdminFeed(feed({schema:'JENIOS_R63_ADMIN_EVOLUTION_REPORT_V1'})),{code:'R63_ADMIN_FEED_INVALID'});
  const original=runR63FixtureCycle().report;
  for(const field of ['improvements','maturity','observations','activeVersion','robots','pending','period','generatedAtMs']){
    const bad=clone(original);delete bad[field];
    assert.equal(isR63AdminReportView(bad),false,field);
    assert.throws(()=>requireR63AdminFeed(feed(bad)),{code:'R63_ADMIN_FEED_INVALID'});
  }
});

test('R63 view validator rejects missing or duplicated robots and inconsistent counts',()=>{
  for(const mutate of [r=>r.robots.pop(),r=>{r.robots[1]=r.robots[0];},
    r=>{r.robots[0].observations++;},r=>{r.observations.eventCount++;},r=>{r.observations.byIssue.NONE++;}]){
    const bad=clone(runR63FixtureCycle().report);mutate(bad);
    assert.equal(isR63AdminReportView(bad),false);
  }
});

test('R63 view validator rejects operational or financial claims in synthetic reports',()=>{
  for(const change of [{evidenceKind:'LIVE'},{realOrdersSent:1},{externalPaperOrdersSent:1},
    {actualBrokerPnl:100},{actualLossesAvoided:100},{realTradeAccuracy:.9},
    {operationalDataDisclosureRequired:false},{scheduledDeliveryActive:true},{adminOnly:false}]){
    const bad={...runR63FixtureCycle().report,...change};
    assert.equal(isR63AdminReportView(bad),false);
  }
});

test('R63 feed validator rejects malformed timestamps, fake origins and non-finite counters',()=>{
  for(const change of [{updatedAt:'not-a-date'},{source:'SOCIAL_ACCOUNT'},{adminOnly:false},
    {productionIntegrationVerified:true},{revision:NaN},{reports:null}]){
    assert.throws(()=>requireR63AdminFeed({...feed(),...change}),{code:'R63_ADMIN_FEED_INVALID'});
  }
});

test('R63 feed validator refuses getters and sparse payloads without executing supplied code',()=>{
  let calls=0;const data=feed(clone(runR63FixtureCycle().report));
  Object.defineProperty(data.reports[0].maturity,'label',{enumerable:true,get(){calls++;return 'fake';}});
  assert.throws(()=>requireR63AdminFeed(data),{code:'R63_ADMIN_FEED_INVALID'});assert.equal(calls,0);
  const sparse=feed();sparse.revision=1;sparse.reports=new Array(1);
  assert.throws(()=>requireR63AdminFeed(sparse),{code:'R63_ADMIN_FEED_INVALID'});
});
