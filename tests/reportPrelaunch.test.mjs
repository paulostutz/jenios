import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { isPrelaunchReport, prelaunchReportHref } from '../lib/reports/prelaunch.mjs';
import { requirePrelaunchReportAccess } from '../lib/reports/prelaunch-access.mjs';
import { requirePayUser } from '../lib/pay/auth.mjs';
import { deliverBankscoreReport } from '../lib/pay/bankscore-delivery.mjs';
import { deliverCryptoReport } from '../lib/pay/crypto-delivery.mjs';
import { montarLaudo } from '../lib/bankscore/report-core.mjs';
import { publicBankscoreSummary } from '../lib/bankscore/public-summary.mjs';
import { createReportPdf } from '../app/api/bankscore/laudo/pdf/route.js';
import { createCryptoReportPdf } from '../lib/crypto/report-pdf.mjs';

const user = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: false };
const bankTarget = { codigo: '123', periodo: '202606' };
const cryptoTarget = { network: 'ethereum', type: 'token', identifier: '0x' + '1'.repeat(40) };
const noPayments = { from(table) {
  assert.equal(table, 'profiles', 'only the Social profiles table may be consulted for free report authorization');
  return {select(fields){assert.equal(fields,'id');return this;},eq(field,id){assert.equal(field,'id');assert.equal(id,user.id);return this;},async maybeSingle(){return {data:{id:user.id},error:null};}};
} };
const authorize = requirePrelaunchReportAccess;
const syntheticBank = () => montarLaudo({ codigo: '123', nome: 'Instituição sintética de teste', tipo: 'Teste', periodo: 202606, percentual: 14, revisao: 'PROVISORIO' });
const syntheticCrypto = { ...cryptoTarget, networkLabel: 'Ethereum', supported: true, found: true, status: 'encontrado on-chain', checkedAt: '2026-10-15T00:00:00Z', evidence: {} };

test('only the two Social reports participate in prelaunch', () => {
  assert.equal(isPrelaunchReport('social-bankscore-report'), true);
  assert.equal(isPrelaunchReport('social-crypto-validator'), true);
  for (const code of ['social-boost','social-specialist-offer','platform-nacional','platform-global-crypto','platform-internacional-pro','invented']) assert.equal(isPrelaunchReport(code), false);
  assert.equal(isPrelaunchReport('social-bankscore-report','platform'), false);
});
test('report links preserve selections and cannot redirect to an external target', () => {
  assert.equal(prelaunchReportHref('social-bankscore-report',bankTarget), '/bankscore/detalhado?codigo=123&periodo=202606');
  const url = new URL(prelaunchReportHref('social-crypto-validator',{...cryptoTarget,redirect:'https://example.invalid'}),'https://jenios.com.br');
  assert.equal(url.pathname,'/social/consulta-detalhada');
  assert.equal(url.searchParams.get('identifier'),cryptoTarget.identifier);
  assert.equal(url.searchParams.has('redirect'),false);
  assert.throws(() => prelaunchReportHref('social-boost',{}));
});
test('guest cookies cannot replace verified login', async () => {
  let calls=0;
  const db={auth:{async getUser(){calls++;throw Error('not expected');}}};
  for(const headers of [{},{cookie:'jenios_report_buyer='+'a'.repeat(64)}]) await assert.rejects(requirePayUser(new Request('https://jenios.com.br/api/bankscore/detailed',{method:'POST',headers}),db),{status:401});
  assert.equal(calls,0);
});
test('invalid tokens and anonymous accounts are rejected by the server verifier', async () => {
  const request=new Request('https://jenios.com.br/api/bankscore/detailed',{method:'POST',headers:{authorization:'Bearer test-token'}});
  for(const response of [{data:{user:null},error:{message:'Invalid JWT'}},{data:{user:{...user,is_anonymous:true}},error:null}]) await assert.rejects(requirePayUser(request,{auth:{getUser:async()=>response}}),{status:401});
  assert.deepEqual(await requirePayUser(request,{auth:{getUser:async token=>{assert.equal(token,'test-token');return {data:{user},error:null};}}}),user);
});
test('missing accounts and anonymous accounts cannot obtain free report access', async () => {
  for(const candidate of [null,{}, {id:null,guestHash:'a'.repeat(64)}, {...user,is_anonymous:true}]) {
    await assert.rejects(authorize({user:candidate,productCode:'social-bankscore-report',target:bankTarget}),{status:401});
    await assert.rejects(authorize({user:candidate,productCode:'social-crypto-validator',target:cryptoTarget}),{status:401});
  }
  await assert.rejects(authorize({user,productCode:'social-boost',target:{}}),{status:403});
});
test('registered user receives BankScore without an order and using the unchanged generator', async () => {
  let calls=0;
  const report=await deliverBankscoreReport({db:noPayments,user,target:bankTarget,authorize,load:async({target})=>{calls++;assert.deepEqual(target,bankTarget);return syntheticBank();}});
  assert.equal(calls,1);assert.equal(report.orderId,null);assert.ok(report.fundamentos.length);
  const bytes=await createReportPdf(report);
  assert.ok(bytes.length>1000);assert.ok((await PDFDocument.load(bytes)).getPageCount()>=1);
});
test('registered user receives token report and PDF without payment or fake paid status', async () => {
  let calls=0;
  const report=await deliverCryptoReport({db:noPayments,user,target:cryptoTarget,authorize,validate:async target=>{calls++;assert.deepEqual(target,cryptoTarget);return syntheticCrypto;}});
  assert.equal(calls,1);assert.equal(report.detail.orderId,null);assert.ok(report.detail.findings.length);
  const bytes=await createCryptoReportPdf(report);
  assert.ok(bytes.length>1000);assert.ok((await PDFDocument.load(bytes)).getPageCount()>=1);
});
test('invalid targets and missing users never reach report providers', async () => {
  let calls=0;const load=async()=>{calls++;return syntheticBank();};const validate=async()=>{calls++;return syntheticCrypto;};
  for(const target of [{}, {...bankTarget,codigo:'https://invalid'}, {...bankTarget,periodo:'202613'}]) await assert.rejects(deliverBankscoreReport({db:noPayments,user,target,authorize,load}),{status:400});
  await assert.rejects(deliverCryptoReport({db:noPayments,user,target:{...cryptoTarget,network:'invented'},authorize,validate}),{status:400});
  await assert.rejects(deliverCryptoReport({db:noPayments,user:null,target:cryptoTarget,authorize,validate}),{status:401});
  assert.equal(calls,0);
});
test('default delivery still enforces the preserved paid workflow', async () => {
  let calls=0;
  await assert.rejects(deliverBankscoreReport({db:noPayments,user,target:bankTarget,load:async()=>{calls++;return syntheticBank();}}),{status:400});
  await assert.rejects(deliverCryptoReport({db:noPayments,user,target:cryptoTarget,validate:async()=>{calls++;return syntheticCrypto;}}),{status:400});
  assert.equal(calls,0);
});
test('public BankScore projection still excludes full report sections', () => {
  const result=publicBankscoreSummary({...syntheticBank(),coverage:{private:'never'},historico:[1],orderId:'never'});
  for(const key of ['fundamentos','historico','coverage','interpretacao','classificacao','orderId']) assert.equal(result[key],undefined);
  assert.equal(result.instituicao.percentual,14);
});
test('both full endpoints verify login before delivery and prevent cache reuse', () => {
  for(const path of ['../app/api/bankscore/detailed/route.js','../app/api/crypto-validator/detailed/route.js']) {
    const source=readFileSync(new URL(path,import.meta.url),'utf8');
    assert.match(source,/prelaunch\?requirePayUser\(request,db\)/);
    assert.match(source,/authorize:prelaunch\?requirePrelaunchReportAccess:undefined/);
    assert.match(source,/'Cache-Control':'no-store'/);
    assert.doesNotMatch(source,/body\.(paid|admin|prelaunch)/);
  }
});
test('stale checkout requests for the free reports are blocked before banking calls', () => {
  const source=readFileSync(new URL('../app/api/jenios-pay/checkout/route.js',import.meta.url),'utf8');
  assert.ok(source.indexOf('if(isPrelaunchReport(body?.productCode))')<source.indexOf('const db = getJeniosPayAdmin()'));
  assert.match(source,/status:409/);
});
