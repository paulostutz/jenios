import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {downloadVerifiedReportPdf,MAX_REPORT_PDF_BYTES} from '../../lib/reports/pdf-download.mjs';
const good=()=>new Response(new Blob(['%PDF-1.7\nsynthetic']),{headers:{'content-type':'application/pdf','content-length':'18'}});
function harness(){
 let clicks=0,revoked=0,scheduled;
 const dom={body:{appendChild(){}},createElement(){return{click(){clicks++},remove(){}}}};
 const urlApi={createObjectURL(){return'blob:mock-only'},revokeObjectURL(){revoked++}};
 return{dom,urlApi,scheduler:(f,ms)=>{scheduled={f,ms}},get clicks(){return clicks},get revoked(){return revoked},get scheduled(){return scheduled}};
}
test('a real-looking PDF is downloaded only once and revoked with Safari-safe delay',async()=>{
 const h=harness();assert.equal(await downloadVerifiedReportPdf(good(),'jenios-bankscore-detalhado.pdf',h),true);
 assert.equal(h.clicks,1);assert.equal(h.revoked,0);assert.equal(h.scheduled.ms,60_000);h.scheduled.f();assert.equal(h.revoked,1);
});
test('stale session changes prevent PDF from being offered',async()=>{
 const h=harness();assert.equal(await downloadVerifiedReportPdf(good(),'jenios-crypto-detalhado.pdf',{...h,isCurrent:()=>false}),false);assert.equal(h.clicks,0);
});
for(const [name,blob,type,status] of [
 ['html masquerading as pdf','<html>bad body</html>','application/pdf',200],
 ['wrong MIME','%PDF-1.7\nsynthetic','text/html',200],
 ['unauthorized','%PDF-1.7\nsynthetic','application/pdf',401],
 ['empty','', 'application/pdf',200]
])test('invalid report response denied: '+name,async()=>{
 const h=harness();const r=new Response(blob,{status,headers:{'content-type':type}});
 await assert.rejects(downloadVerifiedReportPdf(r,'jenios-bankscore-detalhado.pdf',h));assert.equal(h.clicks,0);
});
test('filename injection and oversized body are rejected',async()=>{
 await assert.rejects(downloadVerifiedReportPdf(good(),'../../bad.pdf',harness()));
 const huge=new Response('%PDF-1.7\n',{headers:{'content-type':'application/pdf','content-length':String(MAX_REPORT_PDF_BYTES+1)}});
 await assert.rejects(downloadVerifiedReportPdf(huge,'jenios-bankscore-detalhado.pdf',harness()));
});
test('BankScore and crypto detailed reports use verified PDF helper with unchanged server routes',()=>{
 const b=readFileSync('app/components/BankscorePaidReport.js','utf8');
 const c=readFileSync('app/components/PaidCryptoReport.js','utf8');
 assert.match(b,/downloadVerifiedReportPdf\(response,'jenios-bankscore-detalhado\.pdf'/);
 assert.match(c,/downloadVerifiedReportPdf\(response,'jenios-crypto-detalhado\.pdf'/);
 assert.match(b,/\/api\/bankscore\/detailed/);assert.match(c,/\/api\/crypto-validator\/detailed/);
 for(const p of ['app/api/bankscore/detailed/route.js','app/api/crypto-validator/detailed/route.js']){
   const s=readFileSync(p,'utf8');assert.match(s,/Content-Disposition/);assert.match(s,/requirePrelaunchReportAccess/);
 }
});
