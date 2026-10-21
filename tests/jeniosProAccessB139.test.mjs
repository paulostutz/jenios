import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handlePro} from '../lib/assistant/pro-service.mjs';
const src=p=>readFileSync(p,'utf8');
test('B139 Pro plan endpoint requires identity and never claims unpaid wallet credits',async()=>{
 const route=src('app/api/assistant/pro/access/route.js');
 assert.match(route,/requirePayToken\(request\)/);assert.match(route,/handlePro\(request/);
 let ledgerReads=0;
 const options={action:'access',db:{},env:{},authorize:async()=>({id:'verified-test-account'}),planResolver:async()=>null,passResolver:async()=>null,repository:()=>({config:async()=>({installed:false,generationEnabled:false}),status:async()=>{ledgerReads++;throw Error('Must not read uninstalled ledger');}})};
 const request=new Request('https://jenios.test/api/assistant/pro/access');
 let response=await handlePro(request,options),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.paidGenerationEnabled,false);assert.equal(body.paymentStatus,'not_enabled');
 assert.equal(body.wallet.status,'not_provisioned');assert.equal(body.wallet.totalNanoUsd,null);assert.equal(body.allowance.totalNanoUsd,null);assert.equal(ledgerReads,0);
 response=await handlePro(request,{...options,authorize:async()=>({id:'guest',is_anonymous:true})});body=await response.json();
 assert.equal(response.status,401);assert.equal(body.wallet,undefined);assert.equal(body.answer,undefined);
});
test('B139 customer sees honest payment status and existing University access',()=>{
 const page=src('app/genios-pro/page.js');
 const credits=src('app/genios-pro/ProCredits.js');
 assert.doesNotMatch(page,/<ProCredits /);
 assert.match(page,/Sem venda de créditos individuais/);
 assert.match(credits,/Contratação ainda não habilitada/);
 assert.match(credits,/duas vezes o custo/);
 assert.match(page,/href="\/platform\/aprender"/);
 assert.match(page,/sem cadastro/);
 assert.doesNotMatch(page,/fetch\('\/api\/jenios-pay\/checkout'/);
});
test('B139 both free Social and existing authenticated Platform chat link to Pro information',()=>{
 assert.match(src('app/components/assistant/FreeAssistantRoom.js'),/href="\/genios-pro"/);
 assert.match(src('app/components/assistant/AssistantEntry.js'),/href="\/genios-pro"/);
 assert.equal(src('app/api/assistant/free/route.js').includes('OPENAI_API_KEY'),false);
});
