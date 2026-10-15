import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCapitalReport} from '../lib/bankscore/capital-report.mjs';
import {deliverBankscoreReport} from '../lib/pay/bankscore-delivery.mjs';
import {DEFAULT_PRODUCTS} from '../lib/pay/catalog.mjs';
import {purchaseQuote,purchaseFingerprint} from '../lib/pay/purchase.mjs';
import {createReportPdf} from '../app/api/bankscore/laudo/pdf/route.js';
import {PDFDocument} from 'pdf-lib';
const target={codigo:'123',periodo:'202606'},orderId='11111111-1111-4111-8111-111111111111';
const row={codigo_instituicao:'123',nome_instituicao:'Amostra sintética',periodo:202606,tipo_instituicao:1,indice_basileia_bruto:0.14,indice_basileia_percentual_provisorio:14};
function source({rows=[row],history=[row,{...row,periodo:202603,indice_basileia_bruto:0.12,indice_basileia_percentual_provisorio:12}]}={}){
  let queries=0;
  return {get queries(){return queries;},from(table){assert.equal(table,'jenios_bankscore_homologacao');queries++;let historical=false;const q={select(){return q;},eq(){return q;},lte(){historical=true;return q;},order(){return q;},limit(){return q;},then(resolve,reject){return Promise.resolve({data:historical?history:rows,error:null}).then(resolve,reject);}};return q;}};
}
test('existing BankScore dataset produces scoped report and historical delta, not complete financial rating',async()=>{
  const report=await loadCapitalReport({db:source(),target});
  assert.equal(report.instituicao.percentual,14);assert.equal(report.evolucao.diferencaPontosPercentuais,2);
  assert.equal(report.evolucao.periodoAnterior,202603);assert.match(report.escopo,/Não é análise financeira completa/);assert.equal(report.minimoRegulatorio,null);
});
test('missing, duplicated or inconsistent current indicator blocks report',async()=>{
  for(const [rows,status] of [[[],404],[[row,row],409],[[{...row,indice_basileia_percentual_provisorio:90}],409]])await assert.rejects(loadCapitalReport({db:source({rows}),target}),{status});
});
test('invalid period rejected before reading source; no silent move to latest period',async()=>{
  const db=source();await assert.rejects(loadCapitalReport({db,target:{codigo:'123'}}),{status:400});assert.equal(db.queries,0);
});
test('duplicate history blocks, invalid historical indicator is marked and not used for delta',async()=>{
  await assert.rejects(loadCapitalReport({db:source({history:[row,row]}),target}),{status:409});
  const report=await loadCapitalReport({db:source({history:[row,{...row,periodo:202603,indice_basileia_percentual_provisorio:90}]}),target});
  assert.equal(report.historico[1].percentual,null);assert.equal(report.evolucao,null);
});
function paid(status='paid'){
  const product={...DEFAULT_PRODUCTS[0],id:'product'};
  const quote=purchaseQuote({target},product,'social');
  const order={id:orderId,user_id:'owner',product_id:'product',status,amount_cents:990,currency:'BRL',external_reference:JSON.stringify({productCode:product.code,scope:'social',fingerprint:purchaseFingerprint(quote)})};
  return {from(table){const q={select(){return q;},eq(){return q;},async maybeSingle(){return {data:table==='jenios_pay_orders'?order:product,error:null};}};return q;}};
}
test('paid delivery checks exact order, owner and resource before loading BankScore',async()=>{
  let calls=0;const load=async()=>{calls++;return {escopo:'QA'};};
  const args={user:{id:'owner'},orderId,target,load};
  await assert.rejects(deliverBankscoreReport({...args,db:paid('pending')}),{status:403});
  await assert.rejects(deliverBankscoreReport({...args,db:paid(),target:{codigo:'124',periodo:'202606'}}),{status:403});
  await assert.rejects(deliverBankscoreReport({...args,db:paid(),user:{id:'other'}}),{status:404});
  assert.equal(calls,0);assert.equal((await deliverBankscoreReport({...args,db:paid()})).orderId,orderId);assert.equal(calls,1);
});
test('detailed PDF includes historical report without crashing pagination',async()=>{
  const report=await loadCapitalReport({db:source(),target});
  const pdf=await PDFDocument.load(await createReportPdf({...report,orderId}));assert.ok(pdf.getPageCount()>=2);
});
