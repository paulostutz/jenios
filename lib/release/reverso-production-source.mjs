/** REVPUB001 authorizes only the exact Web release with Reverso runtime disabled. */
import {execFileSync} from 'node:child_process';
import {inspectVercelConfig} from './vercel-config-diagnostic.mjs';
import {summarizeUltraCheckout} from './ultra-production-source.mjs';
import {REVERSO_WEB_RELEASE_BRANCH,REVERSO_UNHOMOLOGATED_GATES} from './environment-scope.mjs';
import {verifyOwnerWebRelease} from '../../scripts/check-ultra-owner-web.mjs';

const DISABLED_CAPABILITIES=Object.freeze(['publicationApproved','actualExecutionAuthorized','realDebitAuthorized',
 'liveExecutionAllowed','realBillingAllowed','paymentIssuanceAllowed','brokerPermissionsGranted']);

export function verifyReversoWebDeploymentSource(env,{git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim(),
 verifyContent=verifyOwnerWebRelease,inspectConfig=inspectVercelConfig}={}){
 if(!['production','preview'].includes(env.VERCEL_ENV)||env.VERCEL_GIT_COMMIT_REF!==REVERSO_WEB_RELEASE_BRANCH
  ||env.VERCEL_GIT_PROVIDER!=='github'||env.VERCEL_PROJECT_ID!=='prj_44ipBY3R9sHlQDAXY7NUn1zDguw4'
  ||!/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA??''))throw Error('REVPUB001_GIT_IDENTITY_NOT_CONFIRMED');
 if(REVERSO_UNHOMOLOGATED_GATES.some(key=>env[key]!==undefined&&env[key]!==''&&env[key]!=='false'))
  throw Error('REVPUB001_UNHOMOLOGATED_RUNTIME_MUST_STAY_DISABLED');
 if(git('rev-parse','HEAD')!==env.VERCEL_GIT_COMMIT_SHA)throw Error('REVPUB001_CHECKOUT_SHA_MISMATCH');
 const tracked=git('diff','--name-status','--no-renames','-z','HEAD'),untracked=git('ls-files','--others','--exclude-standard','-z');
 if(tracked||untracked){
  const diagnostic=summarizeUltraCheckout(tracked,untracked);
  if((tracked+'\0'+untracked).split('\0').includes('vercel.json'))diagnostic.vercelConfig=inspectConfig();
  throw Error('REVPUB001_CHECKOUT_NOT_CLEAN '+JSON.stringify(diagnostic));
 }
 const result=verifyContent();
 if(result.reversoWebPublicationRelease!==true||result.webPublicationApproved!==true||result.exactSource!==true
  ||DISABLED_CAPABILITIES.some(key=>result[key]!==false))throw Error('REVPUB001_WEB_ONLY_CONTENT_NOT_CONFIRMED');
 return {ok:true,commit:env.VERCEL_GIT_COMMIT_SHA,branch:REVERSO_WEB_RELEASE_BRANCH,
  environment:env.VERCEL_ENV,scope:'web-only-disabled-finance'};
}
