import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {configuredGenerativeEnv,isBudgetConfigured,reserveGenerativeBudget,JENIOS_LLM_MODEL} from '../lib/assistant/generative-budget.mjs';
const enabled={JENIOS_GENERATIVE_ENABLED:'true',OPENAI_API_KEY:'sk_test_'+'x'.repeat(35),JENIOS_GENERATIVE_MODEL:'gpt-6-luna',JENIOS_AI_MONTHLY_BUDGET_USD:'10'};
test('B131 budget gate defaults to disabled and never leaks model credential',()=>{
 const a=configuredGenerativeEnv({OPENAI_API_KEY:'sk_test_'+'x'.repeat(35)});
 assert.equal(a.OPENAI_API_KEY,'');assert.equal(a.JENIOS_ASSISTANT_MODEL,'');assert.equal(a.JENIOS_TUTOR_MODEL,'');
 assert.equal(isBudgetConfigured({...enabled,JENIOS_GENERATIVE_ENABLED:'false'}),false);
 assert.equal(isBudgetConfigured({...enabled,JENIOS_AI_MONTHLY_BUDGET_USD:'0'}),false);
 assert.equal(isBudgetConfigured({...enabled,JENIOS_GENERATIVE_MODEL:'gpt-5-mini'}),false);
 assert.equal(isBudgetConfigured(enabled),true);assert.equal(JENIOS_LLM_MODEL,'gpt-6-luna');
});
test('B131 server makes a single atomic monthly reservation before contacting provider',async()=>{
 let called=0,params;
 const db={rpc:async(name,p)=>{called++;assert.equal(name,'jenios_ai_budget_reserve_b131');params=p;return {data:true,error:null};}};
 assert.equal(await reserveGenerativeBudget(db,enabled,'assistant',Date.parse('2026-10-20T10:00:00Z')),true);
 assert.equal(called,1);assert.equal(params.p_month,'2026-10');assert.equal(params.p_limit_micro_usd,10000000);
 assert.ok(params.p_cost_micro_usd>=2000);
});
test('B131 fail closed on missing migration, exhausted budget or unapproved flag',async()=>{
 const fail={rpc:async()=>({data:false,error:null})},down={rpc:async()=>({error:{code:'missing'},data:null})};
 assert.equal(await reserveGenerativeBudget(fail,enabled,'tutor'),false);
 assert.equal(await reserveGenerativeBudget(down,enabled,'assistant'),false);
 assert.equal(await reserveGenerativeBudget({}, {...enabled,JENIOS_GENERATIVE_ENABLED:'false'},'assistant'),false);
});
test('B131 AI calls reserve before invoking Responses API and only after consent',()=>{
 const answer=readFileSync('lib/assistant/reply.mjs','utf8'),tutor=readFileSync('lib/learning/tutor.mjs','utf8');
 for(const code of [answer,tutor]){assert.ok(code.indexOf('await spend()')<code.indexOf("fetcher('https://api.openai.com/v1/responses'"));assert.match(code,/aiConsent/);}
 assert.match(readFileSync('lib/assistant/service.mjs','utf8'),/reserveGenerativeBudget\(db,env,'assistant'/);
 assert.match(readFileSync('lib/learning/service.mjs','utf8'),/reserveGenerativeBudget\(db,env,'tutor'/);
 const migration=readFileSync('supabase/migrations/20261020010000_ai_budget_b131_REVIEW_ONLY.sql','utf8');
 assert.match(migration,/ON CONFLICT\(month\) DO UPDATE/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON FUNCTION/);
});
