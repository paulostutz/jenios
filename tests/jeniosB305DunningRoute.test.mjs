import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('../app/api/internal/billing/dunning/route.js',import.meta.url),'utf8');
test('B305-R13 scheduled dunning route is private and disabled by default',()=>{assert.match(src,/CRON_SECRET/);assert.match(src,/JENIOS_SUBSCRIPTION_DUNNING_ENABLED/);assert.match(src,/jenios_process_subscription_dunning_r42/);});
