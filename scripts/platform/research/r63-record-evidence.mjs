import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createR63FixtureInput,runR63FixtureCycle,R63_FIXTURE_REPORT_AT} from '../../../lib/platform/research/robot-r63-fixture-cycle.mjs';
import {runR63ResearchWorker,runR63ScheduledFixtureWorker} from '../../../lib/platform/research/robot-r63-research-worker.mjs';
import {R63_EVOLUTION_POLICY} from '../../../lib/platform/research/robot-r63-continuous-evolution.mjs';
import {readR63Journal} from '../../../lib/platform/research/robot-r63-durable-journal.mjs';

const output=resolve(process.env.ROBOT_QA_ARTIFACT_DIR||join(tmpdir(),'jenios-r63-evidence'));
const directory=await mkdtemp(join(tmpdir(),'jenios-r63-evidence-journal-'));
const key=randomBytes(32).toString('hex');
const env={VERCEL_ENV:'preview',JENIOS_QA_CANDIDATE_ENABLED:'true',JENIOS_ROBOT_QA_ENABLED:'true',JENIOS_ROBOT_EVOLUTION_ENABLED:'true',
  JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false'};
try{
  const input=createR63FixtureInput();
  const applied=await runR63ResearchWorker({input,directory,key,env});
  const duplicate=await runR63ResearchWorker({input,directory,key,env});
  const nextDay=await runR63ScheduledFixtureWorker({directory,key,env,nowMs:R63_FIXTURE_REPORT_AT+86400000});
  const snapshot=readR63Journal({directory,key});
  assert.equal(applied.evaluation.status,'AUTO_APPLIED');assert.equal(duplicate.status,'ALREADY_STORED');
  assert.equal(snapshot.revision,2);assert.equal(nextDay.record.report.improvements.period.automaticallyApplied,0);
  const cases=Object.fromEntries(['improve','regression','insufficient','control_violation'].map(scenario=>{
    const cycle=runR63FixtureCycle(createR63FixtureInput({scenario}));
    return [scenario,{evaluation:cycle.evaluation,before:cycle.before,after:cycle.after,report:cycle.report}];
  }));
  const evidence={schema:'JENIOS_R63_CONTINUOUS_IMPROVEMENT_EVIDENCE_V1',status:'PASS',commit:process.env.GITHUB_SHA||null,
    capturedAt:new Date().toISOString(),scope:'SYNTHETIC_RESEARCH_ONLY',ownerPreapproval:R63_EVOLUTION_POLICY,
    cases,durability:{entries:snapshot.revision,idempotentRetry:duplicate.status,nextDayImprovements:0,activeMaxAgeMs:nextDay.record.evolution.activeVersion.maxAgeMs},
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,realOrdersSent:0,externalPaperOrdersSent:0,
    paidProviderCalls:0,productionSchedulerStarted:false,productionDeployPerformed:false,commercialPerformanceCertified:false,
    limits:['Virtual-clock fixture preregistration, not external prospective attestation.','Local journal does not prove delivery to a deployed admin.','No real identity, brokerage, customer, provider or production session was exercised.']};
  await mkdir(output,{recursive:true});await writeFile(join(output,'r63-continuous-improvement-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log('R63_CONTINUOUS_IMPROVEMENT '+JSON.stringify(evidence));
}finally{await rm(directory,{recursive:true,force:true});}
