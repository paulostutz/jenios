/** Explicit one-off inference test, never imported by the app or normal test/build commands. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {imageVerificationHarness} from './pro-image-g49-harness.mjs';

assert.equal(process.argv[2],'--live','Explicit --live is required.');
assert.equal(process.env.VERCEL_ENV,'production','Use the reviewed production build environment.');
assert.equal(process.env.VERCEL_GIT_COMMIT_REF,'release/jenios-genios-g44-20261024');
assert.match(process.env.OPENAI_API_KEY||'',/^.{21,}$/,'Existing API configuration is required.');
const checks=[];
for(const [persona,task,file] of [['genio','chart_screenshot','chart.png'],['genia','market_moment','chart.png'],['genia','manual_support','not-a-chart.png']]){
 const bytes=readFileSync(new URL('../tests/fixtures/g49/'+file,import.meta.url));
 const prompt=file==='chart.png'?'Este é um exercício simulado. Leia o gráfico e informe ativo, intervalo, moeda, último fechamento visível e o selo no rodapé. Separe observações, cenários condicionais, invalidação e limitações.':'Analise o gráfico que enviei. Se não for possível, explique o que falta.';
 const draft={persona,task,prompt,source:'included',image:{mime:'image/png',base64:bytes.toString('base64')}};
 const h=imageVerificationHarness({env:{OPENAI_API_KEY:process.env.OPENAI_API_KEY}});
 const quote=await h.call('quote',draft);
 assert.equal(quote.status,200,'Quote must succeed with the isolated entitled fixture.');
 const body={...draft,requestKey:randomUUID(),quoteId:quote.body.quote.id,maxRetailNanoUsd:quote.body.quote.maxRetailNanoUsd,consent:true};
 const result=await h.call('chat',body);
 const report={persona,task,httpStatus:result.status,state:result.body.state,fixtureSha256:createHash('sha256').update(bytes).digest('hex'),answer:result.body.answer||null,...h.stats};
 console.log('G49_VISUAL_RESULT '+JSON.stringify(report));
 assert.equal(result.status,200,'Real provider response and consumption must be confirmed.');
 assert.equal(result.body.state,'settled');assert.equal(result.body.executionEnabled,false);
 assert.equal(result.body.sourceInfo?.kind,'user_image');
 assert.equal(h.stats.chargedNanoUsd,2*h.stats.providerNanoUsd);
 assert.ok(h.stats.providerNanoUsd>0&&h.stats.providerNanoUsd<=200_000_000);
 const answer=result.body.answer;
 if(file==='chart.png'){
  assert.match(answer,/JTEST3/i);assert.match(answer,/15\s*(min|minutos)/i);
  assert.match(answer,/62[,.]40/);assert.match(answer,/LIMA[-\s]*47/i);
  assert.match(answer,/cen[aá]rio|hip[oó]tese/i);assert.match(answer,/invalida|perda|perder/i);
  assert.match(answer,/imagem|captura/i);assert.match(answer,/tempo real|cota[çc][aã]o atual|atualiza[çc][aã]o/i);
 }else{
  assert.match(answer,/n[aã]o.{0,90}gr[aá]fico|lista de materiais/is);
  assert.doesNotMatch(answer,/(?:executei|enviei|ordem foi executada|compra realizada)/i);
 }
 const replay=await h.call('chat',body);
 assert.equal(replay.body.replayed,true);assert.equal(replay.body.answer,answer);
 assert.equal(h.stats.providerCalls,1);assert.equal(h.stats.reservations,1);assert.equal(h.stats.settlements,1);
 checks.push({...report,replayWithoutNewInference:true});
}
console.log('G49_VISUAL_LIVE_PASS '+JSON.stringify({checks:checks.length,providerNanoUsd:checks.reduce((n,c)=>n+c.providerNanoUsd,0),productionDatabaseWrites:0,customerPayments:0,orders:0}));
