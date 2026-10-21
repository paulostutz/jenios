import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {buildLaunchQaPacket} from '../lib/platform/launch/b229-release-package.mjs';
test('B229 QA packet preserves twelve brokers, three prices, and no-go original research',()=>{
 const r=buildLaunchQaPacket({nowMs:1792530000000});assert.equal(r.brokerCount,12);
 assert.equal(r.readOnlyTestAdapterCount,2);assert.equal(r.plans.length,3);
 assert.equal(r.historicalResearch.economicAdvantageCertified,false);
 assert.equal(r.productionReleaseAuthorized,false);assert.equal(r.paymentsCreated,0);
});
test('B229 CLI emits sanitized offline-only JSON',()=>{
 const path=new URL('../scripts/platform/launch/b229-offline-release-report.mjs',import.meta.url);
 const r=spawnSync(process.execPath,[path.pathname,'--offline'],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(r.status,0);const j=JSON.parse(r.stdout);assert.equal(j.schema,'JENIOS_B229_LAUNCH_QA_PACKET');
 assert.equal(j.productionReleaseAuthorized,false);assert.equal(j.realOrdersSent,0);
 const denied=spawnSync(process.execPath,[path.pathname,'--deploy'],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(denied.status,1);assert.equal(JSON.parse(denied.stdout).productionReleaseAuthorized,false);
});
