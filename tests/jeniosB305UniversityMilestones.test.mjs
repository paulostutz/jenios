import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('B305-R23 university milestones are derived only from official lesson ids',()=>{
 const sql=readFileSync('supabase/migrations/20261023012300_jenios_b305_university_milestones.sql','utf8');
 assert.match(sql,/ARRAY\[5,10,15\]/);
 assert.match(sql,/r26\.1/);
 assert.match(sql,/count\(DISTINCT e\.value\)/);
 assert.match(sql,/university_milestone/);
 for(const id of ['mercado','day-swing','risco','candles','tempo','contexto','ordens','tamanho','plano','rompimentos','correcoes','indicadores','estatistica','backtest','automacao'])
  assert.match(sql,new RegExp("'"+id+"'"));
 assert.doesNotMatch(sql,/score|passed|placement|api\.resend\.com|RESEND_API_KEY/);
});
