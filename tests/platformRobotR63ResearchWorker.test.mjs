import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runR63ResearchWorker,runR63ScheduledFixtureWorker} from '../lib/platform/research/robot-r63-research-worker.mjs';
import {readR63Journal} from '../lib/platform/research/robot-r63-durable-journal.mjs';
import {createR63FixtureInput,R63_FIXTURE_REPORT_AT} from '../lib/platform/research/robot-r63-fixture-cycle.mjs';
import {createR63AdminReportHandler} from '../lib/platform/research/robot-r63-admin-access.mjs';

const key='b'.repeat(64),env={VERCEL_ENV:'preview',JENIOS_QA_CANDIDATE_ENABLED:'true',
  JENIOS_ROBOT_QA_ENABLED:'true',JENIOS_ROBOT_EVOLUTION_ENABLED:'true',
  JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false'};
async function withJournal(run){const directory=mkdtempSync(join(tmpdir(),'jenios-r63-worker-'));try{return await run({directory,key,env});}finally{rmSync(directory,{recursive:true,force:true});}}
test('worker persists actual study, automatic application and report; admin reads the same stored result',async()=>withJournal(async config=>{
  const result=await runR63ResearchWorker({...config,input:createR63FixtureInput()});
  assert.equal(result.status,'STORED_LOCAL_RESEARCH_REPORT');assert.equal(result.record.evolution.activeVersion.maxAgeMs,500);
  assert.equal(result.record.report.improvements.period.automaticallyApplied,1);assert.equal(result.providerCalls,0);
  const GET=createR63AdminReportHandler({env:{...env,JENIOS_ROBOT_EVOLUTION_JOURNAL_DIR:config.directory,JENIOS_ROBOT_EVOLUTION_JOURNAL_KEY:key},
    getDb:()=>({auth:{getUser:async()=>({data:{user:{id:'fixture-admin',app_metadata:{platform_role:'admin'}}}})}}),readJournal:readR63Journal});
  const response=await GET(new Request('https://qa.invalid/api/platform/admin/robot-evolution',{headers:{authorization:'Bearer fixture'}}));
  assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.reports[0],result.record.report);
}));
test('identical retries do not reapply a version or spend a provider call',async()=>withJournal(async config=>{
  const input=createR63FixtureInput();await runR63ResearchWorker({...config,input});let calls=0;
  const repeat=await runR63ResearchWorker({...config,input,generativeEnabled:true,provider:()=>{calls++;},budget:{reserve:()=>true}});
  assert.equal(repeat.status,'ALREADY_STORED');assert.equal(repeat.revision,1);assert.equal(calls,0);
}));
test('daily driver waits until 09 Sao Paulo and emits once per closed day',async()=>withJournal(async config=>{
  const before=await runR63ScheduledFixtureWorker({...config,nowMs:R63_FIXTURE_REPORT_AT-1});
  assert.equal(before.status,'NOT_DUE');assert.equal(readR63Journal(config).revision,0);
  assert.equal((await runR63ScheduledFixtureWorker({...config,nowMs:R63_FIXTURE_REPORT_AT})).status,'STORED_LOCAL_RESEARCH_REPORT');
  assert.equal((await runR63ScheduledFixtureWorker({...config,nowMs:R63_FIXTURE_REPORT_AT+1000})).status,'PERIOD_ALREADY_STORED');
  assert.equal(readR63Journal(config).revision,1);
}));
test('next day retains the active version and records no invented additional improvement',async()=>withJournal(async config=>{
  await runR63ScheduledFixtureWorker({...config,nowMs:R63_FIXTURE_REPORT_AT});
  const next=await runR63ScheduledFixtureWorker({...config,nowMs:R63_FIXTURE_REPORT_AT+86400000});
  assert.equal(next.revision,2);assert.equal(next.record.evolution.activeVersion.maxAgeMs,500);
  assert.equal(next.record.report.improvements.period.automaticallyApplied,0);
  assert.equal(next.record.report.improvements.cumulative.automaticallyApplied,1);
  assert.equal(next.record.report.maturity.completionCeilingKnown,false);
}));
test('disabled worker and production cannot read or write even a configured local journal',async()=>withJournal(async config=>{
  for(const blocked of [{},{...env,VERCEL_ENV:'production'},{...env,JENIOS_REAL_EXECUTION_ENABLED:'true'}])
    await assert.rejects(runR63ResearchWorker({...config,env:blocked,input:createR63FixtureInput()}),/R63_RESEARCH_WORKER_DISABLED/);
  assert.equal(readR63Journal(config).revision,0);
}));
test('generative analysis requires reserved budget and its hypothesis still passes independent evaluation',async()=>withJournal(async config=>{
  let calls=0,reserved=false;
  const result=await runR63ResearchWorker({...config,input:createR63FixtureInput(),generativeEnabled:true,
    budget:{reserve:async()=>{reserved=true;return true;}},provider:async request=>{
      assert.equal(reserved,true);calls++;assert.equal(request.mayPromote,false);
      const ids=request.context.events.filter(event=>event.issue==='STALE_CONTEXT').map(event=>event.eventId);
      return {schema:'JENIOS_R63_ANALYST_RESPONSE_V1',assessment:'HYPOTHESIS_ONLY',findings:[],proposals:[{kind:'TIGHTEN_MARKET_FRESHNESS',maxAgeMs:500,evidenceEventIds:ids}]};
    }});
  assert.equal(calls,1);assert.equal(result.analystStatus,'ANALYZED');assert.equal(result.evaluation.status,'AUTO_APPLIED');
  assert.equal(result.analysis.mayPromote,false);assert.equal(result.record.report.actualBrokerPnl,null);
}));
test('a model cannot promote a regression even when it proposes the authorized kind',async()=>withJournal(async config=>{
  const result=await runR63ResearchWorker({...config,input:createR63FixtureInput({scenario:'regression'}),generativeEnabled:true,
    budget:{reserve:async()=>true},provider:async request=>({schema:'JENIOS_R63_ANALYST_RESPONSE_V1',assessment:'HYPOTHESIS_ONLY',findings:[],
      proposals:[{kind:'TIGHTEN_MARKET_FRESHNESS',maxAgeMs:500,evidenceEventIds:request.context.events.filter(event=>event.issue==='STALE_CONTEXT').map(event=>event.eventId)}]})});
  assert.equal(result.evaluation.status,'REJECTED');assert.equal(result.record.evolution.activeVersion.maxAgeMs,750);
}));
test('budget denial retains baseline with no fabricated improvement',async()=>withJournal(async config=>{
  let calls=0;const result=await runR63ResearchWorker({...config,input:createR63FixtureInput(),generativeEnabled:true,
    budget:{reserve:()=>false},provider:()=>{calls++;}});
  assert.equal(calls,0);assert.equal(result.analystStatus,'BUDGET_DENIED');assert.equal(result.record.evolution.activeVersion.maxAgeMs,750);
  assert.equal(result.record.report.improvements.period.automaticallyApplied,0);
}));
test('operational source claims or extra input data cannot enter a saved cycle',async()=>withJournal(async config=>{
  const extra={...createR63FixtureInput(),customerEmail:'private@example.invalid'};
  await assert.rejects(runR63ResearchWorker({...config,input:extra}),/R63_INVALID_WORKER_INPUT/);
  const real=createR63FixtureInput();real.events[0].evidenceKind='VERIFIED_OPERATIONAL_EVENT';
  await assert.rejects(runR63ResearchWorker({...config,input:real}),/R63_UNVERIFIED_OBSERVATION_SOURCE/);
  assert.equal(readR63Journal(config).revision,0);
}));
test('reordered equivalent input is idempotent while changed data in the same period is refused',async()=>withJournal(async config=>{
  const input=createR63FixtureInput();await runR63ResearchWorker({...config,input});
  const reordered=Object.fromEntries(Object.entries(input).reverse());
  assert.equal((await runR63ResearchWorker({...config,input:reordered})).status,'ALREADY_STORED');
  const changed={...input,reportAtMs:input.reportAtMs+1000};
  await assert.rejects(runR63ResearchWorker({...config,input:changed}),/R63_WORKER_PERIOD_ALREADY_STORED/);
  assert.equal(readR63Journal(config).revision,1);
}));
test('input accessors and inherited serialization hooks are rejected before execution',async()=>withJournal(async config=>{
  let invoked=0;const input=createR63FixtureInput();
  Object.defineProperty(input,'events',{enumerable:true,get(){invoked++;return [];}});
  await assert.rejects(runR63ResearchWorker({...config,input}),/R63_INVALID_WORKER_INPUT/);assert.equal(invoked,0);
  const inherited=createR63FixtureInput();Object.setPrototypeOf(inherited,{toJSON(){invoked++;return {};}});
  await assert.rejects(runR63ResearchWorker({...config,input:inherited}),/R63_INVALID_WORKER_INPUT/);assert.equal(invoked,0);
}));
test('provider await cannot mutate the input snapshot or its frozen validation protocol',async()=>withJournal(async config=>{
  const input=createR63FixtureInput();
  const result=await runR63ResearchWorker({...config,input,generativeEnabled:true,budget:{reserve:()=>true},provider:async request=>{
    input.plan.caseDefinitions[2].expectedAllow=true;input.validationCases[2].expectedAllow=true;
    return {schema:'JENIOS_R63_ANALYST_RESPONSE_V1',assessment:'HYPOTHESIS_ONLY',findings:[],proposals:[{
      kind:'TIGHTEN_MARKET_FRESHNESS',maxAgeMs:500,evidenceEventIds:request.context.events.filter(event=>event.issue==='STALE_CONTEXT').map(event=>event.eventId)}]};
  }});
  assert.equal(result.evaluation.status,'AUTO_APPLIED');assert.equal(result.evaluation.candidate.falseBlocks,0);
}));
