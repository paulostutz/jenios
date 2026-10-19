import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const r=p=>readFileSync(p,'utf8');
test('B87 original TradingView charts are unified without removing market or risk controls',()=>{
 const dash=r('app/dashboard/page.js'),mesa=r('app/mesa-operacoes/page.js');
 for(const source of [dash,mesa]){
  assert.match(source,/ResponsiveTradingViewChart symbol=\{ativoSelecionado\} label=\{nomeAtivoExibicao\}/);
  assert.doesNotMatch(source,/new window\.TradingView\.widget/);
  assert.doesNotMatch(source,/container_id.*tradingview_/);
  assert.match(source,/PlatformStrategyLab/);
  assert.match(source,/appendSimIntention/);
 }
});
test('B87 mobile portrait and landscape have accessible click controls and CSS rotation fallback',()=>{
 const widget=r('app/components/platform/ResponsiveTradingViewChart.js');
 const css=r('app/components/platform/ResponsiveTradingViewChart.module.css');
 assert.match(widget,/aria-label="Orientação do gráfico"/);
 assert.match(widget,/data-tv-horizontal/);
 assert.match(widget,/data-tv-vertical/);
 assert.match(widget,/aria-pressed=\{mode==='horizontal'\}/);
 assert.match(css,/orientation:portrait/);
 assert.match(css,/orientation:landscape/);
 assert.match(css,/transform:rotate\(90deg\)/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/\.shell\[data-mode="horizontal"\]/);
 assert.match(widget,/aria-label="Retornar ao gráfico vertical"/);
});
test('B87 resize runs on orientation and visual viewport, not repeated external chart loading',()=>{
 const widget=r('app/components/platform/ResponsiveTradingViewChart.js');
 assert.match(widget,/window\.visualViewport\?\.addEventListener\('resize'/);
 assert.match(widget,/window\.addEventListener\('orientationchange'/);
 assert.match(widget,/setMode\('vertical'\)/);
 assert.match(widget,/new tv\.widget\(tradingViewWidgetOptions/);
 assert.match(widget,/if\(loadingPromise\)return loadingPromise/);
 assert.match(widget,/WIDGET_TIMEOUT/);
 assert.match(widget,/target\.replaceChildren\(\)/);
});
test('B87 external TradingView remains read-only and no brokerage execution is wired',()=>{
 const src=r('app/components/platform/ResponsiveTradingViewChart.js');
 assert.match(src,/https:\/\/s3\.tradingview\.com\/tv\.js/);
 assert.match(src,/autosize:true/);
 assert.match(src,/enable_publishing:false/);
 assert.doesNotMatch(src,/service_role|\/api\/broker|executeTrade|placeOrder|postMessage\(/);
});
