import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('B90 Chromium validates both phone orientations without certifying external prices',()=>{
 const s=readFileSync('scripts/platform/cp69-browser-smoke.mjs','utf8');
 for(const label of ['tradingview-horizontal-portrait','tradingview-phone-landscape',
  'data-tv-horizontal','data-jenios-tv-chart','Retornar ao gráfico vertical',
  'width:844,height:390','width:390,height:844'])assert.ok(s.includes(label),label);
 assert.doesNotMatch(s,/TradingView price verified|Real trading enabled by TradingView/);
});
test('B90 release restrictions include rollback and exact public market scope',()=>{
 const s=readFileSync('docs/platform/R45-B87-B90-PLANEJAMENTO.md','utf8');
 assert.match(s,/B86 continua ponto de rollback/);
 assert.match(s,/Coinbase Exchange/);
 assert.match(s,/execução real permanecem desabilitados/);
});
