import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text=p=>readFileSync(p,'utf8');
test('B90 Platform laboratory requests only allowlisted read-only public candle API',()=>{
 const ui=text('app/components/platform/PlatformStrategyLab.js');
 assert.match(ui,/fetch\('\/api\/platform\/market-observation\?'/);
 assert.match(ui,/method:'GET'/);
 assert.match(ui,/sourceLoading/);
 assert.match(ui,/publicCapture\.lastCompleteCandle/);
 assert.match(ui,/setPublicCapture\(null\)/);
 assert.doesNotMatch(ui,/\/api\/platform\/checkout|method:'POST'|service_role|orderAuthorized:true/);
});
test('B90 prospective paper ledger cannot be recorded before verified source and account',()=>{
 const ui=text('app/components/platform/PlatformStrategyLab.js');
 assert.match(ui,/if\(!userId\|\|!publicCapture\)/);
 assert.match(ui,/captureProspectiveObservation\(window\.sessionStorage,userId,publicCapture\)/);
 assert.match(ui,/readProspectiveObservations\(window\.sessionStorage,userId,publicProduct,publicInterval\)/);
 assert.match(ui,/requestVersion\.current!==rev/);
 assert.match(ui,/prospectiveRows\.length/);
});
test('B90 chart orientation and public data feed do not affect BankScore PAY or original bot execution',()=>{
 const chart=text('app/components/platform/ResponsiveTradingViewChart.js');
 assert.match(chart,/autosize:true/);
 assert.match(chart,/setMode\('horizontal'\)/);
 const route=text('app/api/platform/market-observation/route.js');
 assert.match(route,/export async function GET/);
 assert.doesNotMatch(route,/POST|\/api\/broker|service_role|checkoutService/);
});
