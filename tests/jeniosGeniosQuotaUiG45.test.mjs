import test from 'node:test';
import assert from 'node:assert/strict';
import {formatProviderNanoUsd,eligibleProSubscriber,insufficientProBalance,proConsumptionOptions,
 proConsultationCopy,proCreditActions,canPrepareQuote,validQuote} from '../app/genios-pro/pro-client.mjs';

const periodEnd='2026-11-24T22:00:00Z';
function account({planCode='platform-global-crypto',total=4_000_000_000,spent=0,reserved=0,wallet=0,...rest}={}){
 return {proIncluded:true,planCode,paidGenerationEnabled:true,tasks:[{id:'advanced_question',available:true}],
  allowance:{status:'configured',totalNanoUsd:total,spentNanoUsd:spent,reservedNanoUsd:reserved,availableNanoUsd:total-spent-reserved,periodEnd},
  wallet:{status:'verified',totalNanoUsd:wallet,reservedNanoUsd:0,availableNanoUsd:wallet},...rest};
}

test('G45 UI apresenta a franquia pelo custo real e não duplica o limite aprovado',()=>{
 const crypto=proConsumptionOptions(account()),global=proConsumptionOptions(account({planCode:'platform-internacional-pro',total:8_000_000_000}));
 assert.equal(crypto.quota.providerLimitNanoUsd,2_000_000_000);
 assert.equal(global.quota.providerLimitNanoUsd,4_000_000_000);
 assert.equal(formatProviderNanoUsd(crypto.quota.providerLimitNanoUsd),'US$\u00a02,00');
 assert.equal(formatProviderNanoUsd(global.quota.providerLimitNanoUsd),'US$\u00a04,00');
});
test('G45 UI preserva frações de meio nanoUSD e não inventa valor para campo ausente',()=>{
 assert.equal(formatProviderNanoUsd(.5),'US$\u00a00,0000000005');
 assert.equal(formatProviderNanoUsd(1_000_000_000.5),'US$\u00a01,0000000005');
 assert.equal(formatProviderNanoUsd(0),'US$\u00a00,00');
 for(const value of [null,undefined,'200',true,-1,.25,Infinity,Number.MAX_SAFE_INTEGER])assert.equal(formatProviderNanoUsd(value),'Não disponível');
});
test('G45 UI alerta a partir de80% incluindo reservas sem descrevê-las como consumo liquidado',()=>{
 const below=proConsumptionOptions(account({spent:3_000_000_000,reserved:199_999_998}));
 const at=proConsumptionOptions(account({spent:3_000_000_000,reserved:200_000_000}));
 assert.equal(below.showRecovery,false);assert.equal(below.quota.state,'available');
 assert.equal(at.showRecovery,true);assert.equal(at.quota.state,'near_limit');assert.equal(at.quota.usedPercent,80);
 assert.equal(at.quota.providerSpentNanoUsd,1_500_000_000);
 assert.equal(at.quota.providerReservedNanoUsd,100_000_000);
 assert.equal(at.quota.providerAvailableNanoUsd,400_000_000);
});
test('G45 UI oferece upgrade somente ao Global Crypto com direito confirmado',()=>{
 assert.equal(proConsumptionOptions(account({spent:4_000_000_000})).canUpgrade,true);
 assert.equal(proConsumptionOptions(account({planCode:'platform-internacional-pro',total:8_000_000_000,spent:8_000_000_000})).canUpgrade,false);
 for(const data of [null,{},account({proIncluded:false}),account({planCode:'platform-nacional'}),account({planCode:'unknown'}),account({proIncluded:false,masterPreview:true})]){
  assert.equal(eligibleProSubscriber(data),false);
  const view=proConsumptionOptions(data,{insufficientBalance:true});assert.equal(view.showRecovery,false);assert.equal(view.canUsePrepaid,false);assert.equal(view.canUpgrade,false);
 }
});
test('G45 UI não transforma franquia sem configuração em teto disponível ou esgotado',()=>{
 for(const allowance of [undefined,null,{status:'unconfigured'},account().allowance&&{...account().allowance,periodEnd:null},{...account().allowance,availableNanoUsd:9}]){
  const view=proConsumptionOptions(account({allowance}));
  assert.equal(view.quota.state,'unconfigured');assert.equal(view.quota.providerLimitNanoUsd,null);assert.equal(view.showRecovery,false);
 }
});
test('G45 UI insuficiência de reserva oferece recuperação mesmo com saldo positivo',()=>{
 const data=account({spent:3_900_000_000});
 const view=proConsumptionOptions(data,{source:'included',insufficientBalance:true});
 assert.ok(view.quota.providerAvailableNanoUsd>0);
 assert.equal(view.includedInsufficient,true);assert.equal(view.showRecovery,true);
 assert.equal(view.prepaidInsufficient,false);
});
test('G45 UI códigos de indisponibilidade ou autenticação não se tornam esgotamento',()=>{
 for(const code of ['INSUFFICIENT_BALANCE','INCLUDED_ALLOWANCE_EXHAUSTED'])assert.equal(insufficientProBalance({proBody:{code}}),true);
 for(const code of ['ALLOWANCE_UNAVAILABLE','INCLUDED_PERIOD_TRANSITION_REQUIRED','AUTH_REQUIRED','ADVANCED_PLAN_REQUIRED','PAYMENTS_NOT_APPROVED',null])assert.equal(insufficientProBalance({proBody:{code}}),false);
});
test('G45 UI transição de plano pendente não vira franquia esgotada nem oferta de recompra',()=>{
 const view=proConsumptionOptions(account({allowance:{status:'pending_transition',periodEnd}}),{insufficientBalance:true});
 assert.equal(view.transitionPending,true);assert.equal(view.quota.state,'unconfigured');assert.equal(view.showRecovery,false);assert.equal(view.includedInsufficient,false);
});
test('G45 UI saldo adicional tem origem separada e não amplia silenciosamente a franquia',()=>{
 const data=account({spent:4_000_000_000,wallet:600_000_000}),view=proConsumptionOptions(data);
 assert.equal(view.quota.state,'exhausted');assert.equal(view.canUsePrepaid,true);
 assert.equal(view.quota.providerAvailableNanoUsd,0);
 const draft={data,taskId:'advanced_question',prompt:'Explique este conceito.'};
 assert.equal(canPrepareQuote({...draft,source:'included'}),false);
 assert.equal(canPrepareQuote({...draft,source:'prepaid'}),true);
 assert.equal(canPrepareQuote({...draft,source:'prepaid',hasPending:true}),false);
 assert.equal(canPrepareQuote({...draft,source:'prepaid',data:{...data,paidGenerationEnabled:false}}),false);
});
test('G45 UI confirmação identifica o saldo e impede reaproveitar cotação de outra origem',()=>{
 assert.match(proConsultationCopy('prepaid').title,/adicional/);
 assert.match(proConsultationCopy('included').title,/incluída/);
 assert.match(proConsultationCopy('prepaid').description,/já confirmado/);
 const quote={id:'confirmed-opaque-quote-id',source:'included',maxRetailNanoUsd:1000,expiresAt:periodEnd};
 assert.equal(validQuote(quote,'included',Date.parse('2026-10-24T22:00:00Z')),true);
 assert.equal(validQuote(quote,'prepaid',Date.parse('2026-10-24T22:00:00Z')),false);
});
test('G45 UI troca de conta não herda recomendação de compra nem saldo da conta anterior',()=>{
 const first=proConsumptionOptions(account({spent:4_000_000_000,wallet:600_000_000}),{insufficientBalance:true});
 const next=proConsumptionOptions({proIncluded:false,masterPreview:false});
 assert.equal(first.canUsePrepaid,true);assert.equal(first.showRecovery,true);
 assert.equal(next.canUsePrepaid,false);assert.equal(next.showRecovery,false);assert.equal(next.quota.state,'unconfigured');
});
test('G45 UI pedido existente pode ser conciliado após expiração do plano sem liberar nova compra',()=>{
 const inactive={userId:'owner-account',eligible:false,offerReady:false,reconciliationEnabled:true};
 assert.deepEqual(proCreditActions(inactive),{canPurchase:false,canReconcile:true});
 assert.deepEqual(proCreditActions({...inactive,userId:null}),{canPurchase:false,canReconcile:false});
 assert.deepEqual(proCreditActions({...inactive,reconciliationEnabled:false}),{canPurchase:false,canReconcile:false});
 assert.deepEqual(proCreditActions({...inactive,eligible:true,offerReady:true}),{canPurchase:true,canReconcile:true});
 assert.equal(proCreditActions({...inactive,eligible:true,offerReady:true,blocked:true}).canPurchase,false);
 assert.equal(proCreditActions({...inactive,reconciliationEnabled:'true'}).canReconcile,false);
});
