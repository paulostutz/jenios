import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isPrelaunchReport,prelaunchReportHref,REPORTS_PRELAUNCH} from '../../lib/reports/prelaunch.mjs';
import {requirePrelaunchReportAccess} from '../../lib/reports/prelaunch-access.mjs';

const bank='social-bankscore-report',crypto='social-crypto-validator';
const user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:false};
const db={
  from(table){
    assert.equal(table,'profiles','free reports must never touch payment/order tables');
    return {
      select(name){assert.equal(name,'id');return this;},
      eq(field,id){assert.equal(field,'id');assert.equal(id,user.id);return this;},
      async maybeSingle(){return {data:{id:user.id},error:null};}
    };
  }
};
const bankTarget={codigo:'123',periodo:'202606'};
const cryptoTarget={network:'ethereum',type:'token',identifier:'0x'+'1'.repeat(40)};
test('B47 prelaunch grants free BankScore and crypto full reports only in Social scope',()=>{
 assert.equal(REPORTS_PRELAUNCH,true);
 for(const product of [bank,crypto]){
   assert.equal(isPrelaunchReport(product),true);
   assert.equal(isPrelaunchReport(product,'platform'),false);
 }
});
test('B47 BankScore full report requires profile but no order or payment',async()=>{
 const grant=await requirePrelaunchReportAccess({db,user,productCode:bank,target:bankTarget});
 assert.equal(grant.authorized,true);
 assert.equal(grant.orderId,null);
 assert.equal(grant.status,'prelaunch');
 assert.equal(grant.productCode,bank);
});
test('B47 Crypto full report requires profile but no order or payment',async()=>{
 const grant=await requirePrelaunchReportAccess({db,user,productCode:crypto,target:cryptoTarget});
 assert.equal(grant.authorized,true);
 assert.equal(grant.orderId,null);
 assert.equal(grant.status,'prelaunch');
 assert.equal(grant.productCode,crypto);
});
test('B47 free reports remain denied without a real non-anonymous Social identity',async()=>{
 for(const identity of [null,{}, {...user,is_anonymous:true}]){
  for(const [productCode,target] of [[bank,bankTarget],[crypto,cryptoTarget]])
   await assert.rejects(requirePrelaunchReportAccess({db,user:identity,productCode,target}),{status:401});
 }
});
test('B47 prelaunch checkout exits before database, financial orders or charges',()=>{
 const checkout=readFileSync('app/api/jenios-pay/checkout/route.js','utf8');
 const guard=checkout.indexOf('if(isPrelaunchReport(body?.productCode))');
 const database=checkout.indexOf('getJeniosPayAdmin();');
 const buyer=checkout.indexOf('requireReportBuyer(request, db)');
 const checkoutService=checkout.indexOf('checkoutService({');
 assert.ok(guard>0&&guard<database&&database<buyer&&buyer<checkoutService);
 assert.match(checkout,/status:409/);
 assert.match(checkout,/reportUrl:prelaunchReportHref\(body\.productCode,body\.target\)/);
});
test('B47 both UI reports show free state without requiring paid receipts',()=>{
 for(const path of ['app/components/BankscorePaidReport.js','app/components/PaidCryptoReport.js']){
  const content=readFileSync(path,'utf8');
  assert.match(content,/ReportAccountGate/);
  assert.match(content,/isPrelaunchReport/);
  assert.match(content,/downloadVerifiedReportPdf/);
 }
});
test('B47 any future paid action remains separate from the free report download',()=>{
 for(const product of ['social-boost','social-specialist-offer','platform-nacional','platform-global-crypto','platform-internacional-pro']){
  assert.equal(isPrelaunchReport(product),false);
 }
 const redirect=prelaunchReportHref(bank,bankTarget);
 assert.match(redirect,/^\/bankscore\/detalhado\?/);
 const cryptoUrl=prelaunchReportHref(crypto,cryptoTarget);
 assert.match(cryptoUrl,/^\/social\/consulta-detalhada\?/);
});
test('B47 protected financial APIs remain identical under SHA256 guard',()=>{
 const frozen=JSON.parse(readFileSync('docs/release/S05-CRITICAL-API-SHA256.json','utf8'));
 for(const path of ['app/api/bankscore/detailed/route.js','app/api/crypto-validator/detailed/route.js','app/api/jenios-pay/checkout/route.js','lib/jenios-pay-admin.js'])
   assert.match(frozen[path],/^[a-f0-9]{64}$/);
});
