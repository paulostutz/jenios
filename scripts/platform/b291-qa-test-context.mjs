/** B291 QA-only test isolation during Vercel Preview builds.
 * Run the strict financial proof suite with all real QA settings, then run the
 * historic synthetic fixtures with ONLY the receipt-proof switch off.
 * Runtime Next.js and all other env flags remain unchanged and fail closed.
 */
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const BRANCH='fix/jenios-b291qa-integrated-preview-20261021';
const qa=process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_GIT_COMMIT_REF===BRANCH;
const strict=process.env.JENIOS_QA_STRICT_SUBSCRIPTION_PROOF;
function run(args,env,stage){
 const r=spawnSync(process.execPath,args,{
  cwd:process.cwd(),stdio:'inherit',env,timeout:300000
 });
 if(r.error||r.signal||r.status!==0){
  console.error('B291_BUILD_TEST_PHASE_FAILED '+stage+' code='+String(r.status));
  process.exitCode=r.status||1;return false;
 }
 return true;
}
if(qa&&strict!=='true'){
 console.error('B291_QA_CANNOT_BUILD_WITHOUT_FINANCIAL_PROOF');
 process.exitCode=1;
}else{
 let okay=true;
 if(qa){
  console.log('B291_STAGE_STRICT_RECEIPT_TESTS');
  okay=run(['--test',
   'tests/jeniosB290QaFinancialProof.test.mjs',
   'tests/jeniosB291QaIntegratedPreview.test.mjs'],process.env,'STRICT');
 }
 if(okay){
  const names=readdirSync('tests').filter(name=>name.endsWith('.test.mjs')).sort();
  if(names.length<100){console.error('B291_UNEXPECTED_TEST_INVENTORY');process.exitCode=1;}
  else{
   const env=qa?{...process.env,JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'false'}:process.env;
   if(qa)console.log('B291_STAGE_SYNTHETIC_FIXTURES_ONLY');
   run(['--test',...names.map(x=>'tests/'+x)],env,'FULL_REGRESSION');
  }
 }
}
