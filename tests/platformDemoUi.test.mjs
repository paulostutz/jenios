import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('B169 demo form compiled only behind explicit QA-only flag, production remains closed on server',()=>{
 const page=readFileSync('app/integracoes/page.js','utf8');
 assert.match(page,/NEXT_PUBLIC_JENIOS_DEMO_CONNECTORS_UI==='true'/);
 assert.match(page,/DemoBrokerConnector/);
 const form=readFileSync('app/components/platform/DemoBrokerConnector.js','utf8');
 assert.match(form,/type="password"/);assert.match(form,/READ_ONLY_DEMO_NO_ORDERS/);
 assert.match(form,/platformSupabase/);assert.match(form,/credentials:'omit'/);
 assert.doesNotMatch(form,/localStorage|sessionStorage|console\.log|\bfetch\(['"]https:\/\//);
 const route=readFileSync('lib/platform/connections/demo-service.mjs','utf8');
 assert.match(route,/env\.VERCEL_ENV!=='production'/);
});
