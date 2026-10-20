import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(p,'utf8');
test('B139 Pro plan endpoint requires identity and never claims unpaid wallet credits',()=>{
 const route=src('app/api/assistant/pro/access/route.js');
 assert.match(route,/requirePayUser/);assert.match(route,/verifiedPlatformPlan/);
 assert.match(route,/proPlanAccess/);assert.match(route,/paidGenerationEnabled:false/);
 assert.match(route,/paymentStatus:'not_enabled'/);
 assert.match(route,/paid_retail_micro_usd,reserved_retail_micro_usd/);
});
test('B139 customer sees honest payment status and existing University access',()=>{
 const page=src('app/genios-pro/page.js');
 assert.match(page,/Contratação ainda não habilitada/);
 assert.match(page,/duas vezes o custo/);
 assert.match(page,/href="\/platform\/aprender"/);
 assert.match(page,/sem cadastro/);
 assert.doesNotMatch(page,/fetch\('\/api\/jenios-pay\/checkout'/);
});
test('B139 both free Social and existing authenticated Platform chat link to Pro information',()=>{
 assert.match(src('app/components/assistant/FreeAssistantRoom.js'),/href="\/genios-pro"/);
 assert.match(src('app/components/assistant/AssistantEntry.js'),/href="\/genios-pro"/);
 assert.equal(src('app/api/assistant/free/route.js').includes('OPENAI_API_KEY'),false);
});
