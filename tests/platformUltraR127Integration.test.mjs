import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {qualifyScenarioR127,scenariosR127} from '../scripts/platform/ultra/qualify-r127.mjs';
import {parseWorkspaceReport} from '../lib/platform/ultra/client/workspace-report.mjs';

for(const scenario of scenariosR127)test(`R127 composed lifecycle and attributed handoff: ${scenario.id}`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'r127-integrated-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const result=await qualifyScenarioR127(directory,scenario);
 assert.equal(result.latestOperation.state,'closed');assert.equal(result.fixtureSubmissions,1);
 assert.equal(result.realOrdersSent,0);assert.equal(result.externalDemoOrdersSent,0);
 assert.equal(result.recordBatch.evidenceMode,'offline_fixture');
 if(scenario.market==='b3')for(const key of ['requestedQuantity','entryQuantity','exitQuantity'])assert.equal(Number.isInteger(Number(result.latestOperation[key])),true,'mini contracts use whole quantities');
 // The consumer must preserve provenance; no silent import as a legacy report.
 assert.throws(()=>parseWorkspaceReport(result.recordBatch),/INVALID_WORKSPACE_REPORT/);
 const closed=result.recordBatch.records.filter(r=>r.operation.state==='closed');
 assert.ok(closed.some(r=>r.result.status==='awaiting_costs'&&r.result.afterBrokerCosts===null));
 assert.equal(closed.at(-1).result.status,'closed_complete');
 assert.ok(closed.every(r=>r.financialActivationAllowed===false&&r.billingDecisionIncluded===false));
});
