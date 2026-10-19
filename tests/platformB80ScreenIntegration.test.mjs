import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text=p=>readFileSync(p,'utf8');
test('B78 verified diagnostics and simulated journal observations render without bypass',()=>{
 const screen=text('app/dashboard-logado/page.js');
 const ui=text('app/components/platform/PlatformBehaviorReview.js');
 assert.match(screen,/PlatformBehaviorReview/);
 assert.match(screen,/diagnostic=\{socialSession\?null:diagnostic\}/);
 assert.match(ui,/readSimJournal\(window\.sessionStorage,userId\)/);
 assert.match(ui,/readSimulationPaused\(window\.sessionStorage,userId\)/);
 assert.doesNotMatch(ui,/\/api\/broker|executeTrade\(/);
});
test('B79 market study is reachable from both original trading panels without replacing them',()=>{
 for(const name of ['app/dashboard/page.js','app/mesa-operacoes/page.js']){
  const source=text(name);
  assert.match(source,/PlatformStrategyLab/);
  assert.match(source,/userId=\{operadorId\} balance=\{saldoSimulado\}/);
  assert.match(source,/appendSimIntention\(window\.sessionStorage,operadorId/);
 }
});
test('B80 laboratory does not request broker credentials or authorize money execution',()=>{
 const ui=text('app/components/platform/PlatformStrategyLab.js');
 for(const token of ['studyHistoricalCandles','simulationModeLabels','assessPaperStrategy',
  'readSimulationPaused','readSimulatedBalance','CSV','JSON','Analisar amostra'])assert.ok(ui.includes(token),token);
 assert.doesNotMatch(ui,/\/api\/platform\/checkout|fetch\(|signInWithPassword|brokerOrder=/);
 const policy=text('lib/platform/paper-policy.mjs');
 assert.match(policy,/realExecutionAllowed:false/);
 assert.match(policy,/brokerOrder:null/);
});
