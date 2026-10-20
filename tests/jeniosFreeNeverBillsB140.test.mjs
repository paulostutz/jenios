import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(p,'utf8');
test('B140 free assistants and University can never bill a generative model even if Pro keys exist',()=>{
 const routes=['app/api/platform/assistant/route.js','app/api/platform/learning/route.js'];
 for(const path of routes){
  const code=src(path);
  assert.match(code,/OPENAI_API_KEY:''/);
  assert.doesNotMatch(code,/configuredGenerativeEnv\(process\.env\)/);
 }
 const guest=src('app/api/assistant/free/route.js');
 assert.doesNotMatch(guest,/OPENAI_API_KEY|api\.openai\.com/);
});
test('B140 paid usage is restricted to separate Pro service with verified balance',()=>{
 const wallet=src('supabase/migrations/20261020025500_jenios_pro_credits_b138_REVIEW_ONLY.sql');
 assert.match(wallet,/jenios_pro_reserve/);
 assert.match(wallet,/jenios_pro_settle/);
 assert.match(wallet,/REVOKE ALL ON FUNCTION/);
});
