import test from 'node:test';
import assert from 'node:assert/strict';
import {createR63AdminReportHandler,isRobotR63EvolutionEnabled} from '../lib/platform/research/robot-r63-admin-access.mjs';
import {runR63FixtureCycle,createR63FixtureInput} from '../lib/platform/research/robot-r63-fixture-cycle.mjs';

const enabled=()=>({VERCEL_ENV:'preview',JENIOS_QA_CANDIDATE_ENABLED:'true',JENIOS_ROBOT_QA_ENABLED:'true',
  JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_ROBOT_EVOLUTION_ENABLED:'true',
  JENIOS_ROBOT_EVOLUTION_JOURNAL_DIR:'/tmp/r63-private-fixture',JENIOS_ROBOT_EVOLUTION_JOURNAL_KEY:'a'.repeat(64)});
const request=(token='fixture-token',method='GET')=>new Request('https://qa.invalid/api/platform/admin/robot-evolution',{
  method,headers:token?{authorization:'Bearer '+token}:{}});
const user=(role='admin')=>({id:'r63-fixture-user',is_anonymous:false,app_metadata:{platform_role:role}});
const database=person=>({auth:{getUser:async()=>({data:{user:person},error:null})},
  from:()=>({select:()=>({eq:async()=>({data:[],error:null})})})});

test('R63 reporting requires all original gates and its own explicit enable flag',()=>{
  assert.equal(isRobotR63EvolutionEnabled(enabled()),true);
  for(const name of Object.keys(enabled()).filter(key=>!key.includes('JOURNAL'))){
    const env=enabled();delete env[name];assert.equal(isRobotR63EvolutionEnabled(env),false,name);
  }
  assert.equal(isRobotR63EvolutionEnabled({...enabled(),VERCEL_ENV:'production'}),false);
});
test('disabled access denies before resolving identity or touching report storage',async()=>{
  let calls=0;const GET=createR63AdminReportHandler({env:{},getDb:()=>{calls++;},readJournal:()=>{calls++;}});
  assert.equal((await GET(request())).status,404);assert.equal(calls,0);
});
test('missing bearer denies before database and journal access',async()=>{
  let calls=0;const GET=createR63AdminReportHandler({env:enabled(),getDb:()=>{calls++;},readJournal:()=>{calls++;}});
  assert.equal((await GET(request(null))).status,401);assert.equal(calls,0);
});
test('a customer cannot read the administrative report',async()=>{
  let reads=0;const GET=createR63AdminReportHandler({env:enabled(),getDb:()=>database(user('customer')),readJournal:()=>{reads++;}});
  assert.equal((await GET(request())).status,403);assert.equal(reads,0);
});
test('user-editable role metadata does not grant access',async()=>{
  let reads=0;const person={id:'r63-customer',is_anonymous:false,user_metadata:{platform_role:'admin'}};
  const GET=createR63AdminReportHandler({env:enabled(),getDb:()=>database(person),readJournal:()=>{reads++;}});
  assert.equal((await GET(request())).status,403);assert.equal(reads,0);
});
test('anonymous or invalid sessions cannot read the journal',async()=>{
  for(const person of [null,{...user(),is_anonymous:true}]){
    let reads=0;const GET=createR63AdminReportHandler({env:enabled(),getDb:()=>database(person),readJournal:()=>{reads++;}});
    assert.equal((await GET(request())).status,401);assert.equal(reads,0);
  }
});
test('verified administrator receives stored report only, never journal state or key',async()=>{
  const cycle=runR63FixtureCycle(),env=enabled();let reads=0;
  const GET=createR63AdminReportHandler({env,getDb:()=>database(user()),readJournal:args=>{
    reads++;assert.equal(args.directory,env.JENIOS_ROBOT_EVOLUTION_JOURNAL_DIR);
    return {schema:'JENIOS_R63_DURABLE_JOURNAL_V1',revision:1,entries:[{study:cycle.study,evolution:cycle.evolution,report:cycle.report}]};
  }});
  const response=await GET(request()),body=await response.json();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(body.reports[0].improvements.period.automaticallyApplied,1);assert.equal(reads,1);
  assert.equal(JSON.stringify(body).includes(env.JENIOS_ROBOT_EVOLUTION_JOURNAL_KEY),false);
  assert.equal(Object.hasOwn(body,'entries'),false);assert.equal(Object.hasOwn(body,'evolution'),false);
});
test('journal failure is sanitized and never replaced by synthetic success',async()=>{
  const GET=createR63AdminReportHandler({env:enabled(),getDb:()=>database(user()),readJournal:()=>{throw Error('secret-path-and-key');}});
  const response=await GET(request()),body=await response.json();
  assert.equal(response.status,503);assert.equal(JSON.stringify(body).includes('secret-path-and-key'),false);
  assert.equal(Object.hasOwn(body,'reports'),false);
});
test('read boundary cannot perform a mutation',async()=>{
  let calls=0;const GET=createR63AdminReportHandler({env:enabled(),getDb:()=>{calls++;},readJournal:()=>{calls++;}});
  assert.equal((await GET(request('fixture-token','POST'))).status,405);assert.equal(calls,0);
});
test('complete fixture flow applies only the evaluated candidate and refuses regression',()=>{
  const ok=runR63FixtureCycle();assert.equal(ok.before.allow,true);assert.equal(ok.after.allow,false);
  assert.equal(ok.report.improvements.period.automaticallyApplied,1);assert.equal(ok.evolution.activeVersion.maxAgeMs,500);
  const rejected=runR63FixtureCycle(createR63FixtureInput({scenario:'regression'}));
  assert.equal(rejected.evolution.activeVersion.maxAgeMs,750);assert.equal(rejected.report.improvements.period.rejected,1);
  for(const scenario of ['insufficient','control_violation']){
    const cycle=runR63FixtureCycle(createR63FixtureInput({scenario}));
    assert.equal(cycle.evolution.activeVersion.maxAgeMs,750);assert.equal(cycle.report.improvements.period.automaticallyApplied,0);
  }
});
