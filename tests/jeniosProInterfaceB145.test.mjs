import test from 'node:test';
import assert from 'node:assert/strict';
import {formatNanoUsd,nanoAmount,verifiedWallet,verifiedAllowance,taskAvailability,validQuote,canPrepareQuote,unresolvedRequest,fileProblem} from '../app/genios-pro/pro-client.mjs';

test('B145 a fração de centavo é exibida sem arredondar um consumo mínimo para cima',()=>{
 assert.equal(formatNanoUsd(200),'US$\u00a00,0000002');
 assert.equal(formatNanoUsd(1),'US$\u00a00,000000001');
 assert.equal(formatNanoUsd(1_000_000_010),'US$\u00a01,00000001');
 assert.equal(formatNanoUsd(1_234_567_890_123),'US$\u00a01.234,567890123');
 assert.equal(formatNanoUsd(0),'US$\u00a00,00');
});
test('B145 saldo ausente ou malformado não vira zero nem saldo disponível',()=>{
 for(const value of [undefined,null,'',true,-1,1.5,'0.1','1e6','-1',Number.MAX_SAFE_INTEGER+1,'9007199254740992']){
  assert.equal(nanoAmount(value),null);assert.equal(formatNanoUsd(value),'Não disponível');
 }
 assert.equal(nanoAmount('200'),200);
 assert.equal(verifiedWallet({status:'not_provisioned'}),null);
 assert.equal(verifiedWallet({status:'verified',totalNanoUsd:100,reservedNanoUsd:30,availableNanoUsd:100}),null);
 assert.deepEqual(verifiedWallet({status:'verified',totalNanoUsd:100,reservedNanoUsd:30,availableNanoUsd:70}),{total:100,reserved:30,available:70});
});
test('B145 franquia disponível desconta utilizado e reservado e exige configuração confirmada',()=>{
 assert.deepEqual(verifiedAllowance({status:'configured',totalNanoUsd:1000,spentNanoUsd:200,reservedNanoUsd:300,availableNanoUsd:500}),{total:1000,spent:200,reserved:300,available:500});
 assert.equal(verifiedAllowance({status:'unconfigured',totalNanoUsd:1000,spentNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:1000}),null);
 assert.equal(verifiedAllowance({status:'configured',totalNanoUsd:1000,spentNanoUsd:200,reservedNanoUsd:300,availableNanoUsd:800}),null);
});
test('B145 consulta exige permissão global, recurso disponível e saldo correto da origem escolhida',()=>{
 const data={paidGenerationEnabled:true,tasks:[{id:'advanced_question',available:true}],wallet:{status:'verified',totalNanoUsd:1000,reservedNanoUsd:200,availableNanoUsd:800},allowance:{status:'configured',totalNanoUsd:1000,spentNanoUsd:1000,reservedNanoUsd:0,availableNanoUsd:0}};
 const draft={data,taskId:'advanced_question',source:'prepaid',prompt:'Explique este conceito.'};
 assert.equal(canPrepareQuote(draft),true);
 assert.equal(canPrepareQuote({...draft,source:'included'}),false);
 assert.equal(canPrepareQuote({...draft,hasPending:true}),false);
 assert.equal(canPrepareQuote({...draft,locked:true}),false);
 assert.equal(canPrepareQuote({...draft,data:{...data,paidGenerationEnabled:false}}),false);
 assert.equal(canPrepareQuote({...draft,data:{...data,tasks:[]}}),false);
 assert.equal(taskAvailability({paidGenerationEnabled:true},'advanced_question').available,false);
 assert.equal(canPrepareQuote({...draft,prompt:'   '}),false);
 assert.equal(canPrepareQuote({...draft,prompt:'x'.repeat(2501)}),false);
});
test('B145 análise de captura exige imagem e pergunta comum não aceita anexos',()=>{
 const data={paidGenerationEnabled:true,tasks:[{id:'advanced_question',available:true},{id:'chart_screenshot',available:true}],wallet:{status:'verified',totalNanoUsd:1000,reservedNanoUsd:0,availableNanoUsd:1000}};
 const draft={data,taskId:'chart_screenshot',source:'prepaid',prompt:'Interprete esta captura.'};
 assert.equal(canPrepareQuote(draft),false);
 assert.equal(canPrepareQuote({...draft,image:{mime:'image/png'}}),true);
 assert.equal(canPrepareQuote({...draft,taskId:'advanced_question',image:{mime:'image/png'}}),false);
 assert.equal(fileProblem({type:'image/svg+xml',size:100}).includes('PNG'),true);
 assert.equal(fileProblem({type:'image/png',size:4_000_001}).includes('4 MB'),true);
 assert.equal(fileProblem({type:'image/webp',size:4_000_000}),'');
});
test('B145 consentimento não pode usar orçamento vencido, origem diferente ou teto inválido',()=>{
 const now=Date.parse('2026-10-20T12:00:00Z');
 const quote={id:'signed-opaque-quote-token',source:'prepaid',maxRetailNanoUsd:1000,expiresAt:'2026-10-20T12:15:00Z'};
 assert.equal(validQuote(quote,'prepaid',now),true);
 assert.equal(validQuote(quote,'included',now),false);
 assert.equal(validQuote(quote,'prepaid',now+900000),false);
 assert.equal(validQuote({...quote,maxRetailNanoUsd:0},'prepaid',now),false);
 assert.equal(validQuote({...quote,maxRetailNanoUsd:null},'prepaid',now),false);
 assert.equal(validQuote({...quote,expiresAt:'not a date'},'prepaid',now),false);
});
test('B145 consumo incerto continua bloqueado até um estado final confirmado',()=>{
 for(const state of ['reserved','dispatched','needs_reconciliation'])assert.equal(unresolvedRequest(state),true);
 for(const state of ['settled','released','not_started'])assert.equal(unresolvedRequest(state),false);
});
