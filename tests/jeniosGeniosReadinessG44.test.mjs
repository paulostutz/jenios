import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INITIAL_ASSISTANT_STATE,projectAssistant} from '../lib/assistant/contracts.mjs';
import {handleAssistant} from '../lib/assistant/service.mjs';
import {salesModelReady} from '../lib/assistant/sales-provider.mjs';
import {handlePro} from '../lib/assistant/pro-service.mjs';

const userId='44000000-0000-4000-8000-000000000003';
const now=Date.parse('2026-10-24T23:00:00Z');
const key='g44-local-readiness-fixture-not-a-credential';
const contextual={JENIOS_ASSISTANT_MEMORY_ENABLED:'true',JENIOS_SALES_GENERATIVE_ENABLED:'true',
 OPENAI_API_KEY:key,JENIOS_SALES_MODEL:'gpt-6-luna',
 JENIOS_SALES_VISITOR_SALT:'g44-readiness-local-salt-never-deployed',
 JENIOS_AI_MONTHLY_BUDGET_MODE:'capped',JENIOS_AI_MONTHLY_BUDGET_USD:'10'};
const assistantRow=()=>({revision:0,state:INITIAL_ASSISTANT_STATE()});
const supportRequest=()=>new Request('https://fixture.invalid/api/platform/assistant',{
 headers:{authorization:'Bearer local-readiness-fixture'}});
const supportOptions=env=>({db:{},env,now,authorize:async()=>({id:userId,is_anonymous:false}),
 repository:()=>({read:async()=>assistantRow()})});

for(const [label,env,expected] of [
 ['provider key alone',{OPENAI_API_KEY:key},false],
 ['key and memory flag',{OPENAI_API_KEY:key,JENIOS_ASSISTANT_MEMORY_ENABLED:'true'},false],
 ['generation disabled',{...contextual,JENIOS_SALES_GENERATIVE_ENABLED:'false'},false],
 ['missing key',{...contextual,OPENAI_API_KEY:''},false],
 ['short key',{...contextual,OPENAI_API_KEY:'fixture'},false],
 ['missing model',{...contextual,JENIOS_SALES_MODEL:''},false],
 ['unapproved model',{...contextual,JENIOS_SALES_MODEL:'unapproved-model'},false],
 ['missing visitor salt',{...contextual,JENIOS_SALES_VISITOR_SALT:''},false],
 ['missing authorized budget',{...contextual,JENIOS_AI_MONTHLY_BUDGET_USD:''},false],
 ['contextual memory path disabled',{...contextual,JENIOS_ASSISTANT_MEMORY_ENABLED:'false'},false],
 ['ready capped configuration',contextual,true],
 ['ready explicit uncapped configuration',{...contextual,JENIOS_AI_MONTHLY_BUDGET_MODE:'uncapped',JENIOS_AI_MONTHLY_BUDGET_USD:undefined},true]
])test('G44 protected support readiness follows the actual contextual provider gate: '+label,async()=>{
 const response=await handleAssistant(supportRequest(),supportOptions(env));
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.assistant.aiConfigured,expected);
 assert.equal(body.assistant.aiConfigured,env.JENIOS_ASSISTANT_MEMORY_ENABLED==='true'&&salesModelReady(env));
 assert.equal(body.assistant.executionEnabled,false);assert.equal(body.assistant.whatsappEnabled,false);
 assert.equal(body.result,null);assert.doesNotMatch(JSON.stringify(body),/g44-local-readiness|g44-readiness-local-salt/);
});

test('G44 pure public contract cannot infer contextual readiness from environment or expose server imports',()=>{
 assert.equal(projectAssistant(assistantRow(),contextual).aiConfigured,false);
 assert.equal(projectAssistant(assistantRow(),contextual,{contextualAiReady:true}).aiConfigured,true);
 assert.equal(projectAssistant(assistantRow(),{...contextual,JENIOS_ASSISTANT_MEMORY_ENABLED:'false'},{contextualAiReady:true}).aiConfigured,false);
 const source=readFileSync(new URL('../lib/assistant/contracts.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/^\s*import\s|\bimport\s*\(|\bexport\b[^;]*\bfrom\s*['"]/m);
 assert.doesNotMatch(source,/node:crypto|\bBuffer\b|process\.env/);
});

test('G44 preserves the legacy key and model contract without allowing a key alone to enable it',async()=>{
 const env={OPENAI_API_KEY:'legacy-fixture',JENIOS_ASSISTANT_MODEL:'legacy-model'};
 assert.equal(projectAssistant(assistantRow(),env).aiConfigured,true);
 assert.equal(projectAssistant(assistantRow(),{OPENAI_API_KEY:env.OPENAI_API_KEY}).aiConfigured,false);
 const response=await handleAssistant(supportRequest(),supportOptions(env));
 assert.equal((await response.json()).assistant.aiConfigured,true);
});

const proEnv={OPENAI_API_KEY:key,JENIOS_PRO_GENERATION_ENABLED:'true',
 JENIOS_PRO_QUOTE_SECRET:'g44-local-readiness-signing-material-not-a-secret'};
const config=()=>({installed:true,generationEnabled:true,requiresReconciliation:false,
 allowedModels:['gpt-6-luna'],allowances:{'platform-global-crypto':2_000_000_000}});
const plan={code:'platform-global-crypto',periodStart:'2026-10-24T00:00:00Z',periodEnd:'2026-11-24T00:00:00Z'};
function proOptions(env=proEnv,policy=config()){
 const calls={status:0,reserve:0,provider:0};
 return {calls,options:{action:'access',db:{},env,now,planOnly:true,
  authorize:async()=>({id:userId,is_anonymous:false}),planResolver:async()=>plan,passResolver:async()=>null,
  repository:()=>({config:async()=>policy,status:async()=>{calls.status++;return {ok:true,pendingRequests:0,
   wallet:{status:'verified',totalNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:0},
   allowance:{status:'configured',totalNanoUsd:2_000_000_000,spentNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:2_000_000_000,periodEnd:plan.periodEnd}};},
   reserve:async()=>{calls.reserve++;throw Error('Readiness must not reserve consumption.');}}),
  provider:async()=>{calls.provider++;throw Error('External generation forbidden.');}}};
}
const proRequest=()=>new Request('https://fixture.invalid/api/assistant/pro/access');
const inactiveMessage='A IA Pro aguarda ativação neste ambiente. O atendimento gratuito permanece disponível.';
for(const [label,env,policy] of [
 ['missing provider key',{...proEnv,OPENAI_API_KEY:''},config()],
 ['runtime generation disabled',{...proEnv,JENIOS_PRO_GENERATION_ENABLED:'false'},config()],
 ['missing signing secret',{...proEnv,JENIOS_PRO_QUOTE_SECRET:''},config()],
 ['database generation disabled',proEnv,{...config(),generationEnabled:false}]
])test('G44 inactive Pro avoids attributing an unknown cause to allowances: '+label,async()=>{
 const fixture=proOptions(env,policy),response=await handlePro(proRequest(),fixture.options),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.proIncluded,true);
 assert.equal(body.paidGenerationEnabled,false);assert.equal(body.readinessMessage,inactiveMessage);
 assert.ok(body.tasks.length>0);assert.ok(body.tasks.every(t=>t.available===false&&t.reason===inactiveMessage));
 assert.equal(body.creditsOffer.enabled,false);assert.equal(body.paymentStatus,'not_enabled');
 assert.equal(fixture.calls.provider,0);assert.equal(fixture.calls.reserve,0);
 assert.doesNotMatch(body.readinessMessage,/franquia|orçamento|OPENAI|secret/i);
});

test('G44 preserves specific provisioning and reconciliation explanations',async()=>{
 for(const [policy,reason,reads] of [
  [{...config(),installed:false},'O Pro está em preparação. O atendimento gratuito permanece disponível.',0],
  [{...config(),requiresReconciliation:true},'Novas consultas estão pausadas para conferência de consumo.',1]
 ]){
  const fixture=proOptions(proEnv,policy),body=await (await handlePro(proRequest(),fixture.options)).json();
  assert.equal(body.paidGenerationEnabled,false);assert.equal(body.readinessMessage,reason);
  assert.equal(fixture.calls.status,reads);assert.equal(fixture.calls.provider,0);assert.equal(fixture.calls.reserve,0);
 }
});

test('G44 ready Pro keeps the existing paidGenerationEnabled and task gates without consuming credit',async()=>{
 const fixture=proOptions(),response=await handlePro(proRequest(),fixture.options),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.paidGenerationEnabled,true);
 assert.equal(body.tasks.find(t=>t.id==='advanced_question').available,true);
 assert.equal(body.creditsOffer.enabled,false);assert.equal(fixture.calls.provider,0);assert.equal(fixture.calls.reserve,0);
});

test('G44 quote without provider credential stops before balance reservation and returns the same honest activation reason',async()=>{
 const fixture=proOptions({...proEnv,OPENAI_API_KEY:''});
 const request=new Request('https://fixture.invalid/api/assistant/pro/quote',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify({persona:'genia',task:'advanced_question',prompt:'Como organizar meus estudos?',source:'included'})});
 const response=await handlePro(request,{...fixture.options,action:'quote'}),body=await response.json();
 assert.equal(response.status,503);assert.equal(body.code,'PRO_DISABLED');assert.equal(body.state,'not_started');
 assert.equal(body.error,inactiveMessage);assert.equal(body.quote,undefined);
 assert.deepEqual(fixture.calls,{status:0,reserve:0,provider:0});
});
