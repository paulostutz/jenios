import {execFileSync} from 'node:child_process';
import {ULTRA_COMMANDS_RELEASE_BRANCH} from './environment-scope.mjs';
import {verifyOwnerWebRelease} from '../../scripts/check-ultra-owner-web.mjs';
// No environment override: compare the platform-provided Git identity with the actual checkout.
export function verifyUltraProductionSource(env,{git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim(),verifyContent=verifyOwnerWebRelease}={}){
 if(env.VERCEL_ENV!=='production'||env.VERCEL_GIT_COMMIT_REF!==ULTRA_COMMANDS_RELEASE_BRANCH||env.VERCEL_GIT_PROVIDER!=='github'||env.VERCEL_PROJECT_ID!=='prj_44ipBY3R9sHlQDAXY7NUn1zDguw4'||!/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA??''))throw Error('ULTRA_GIT_IDENTITY_NOT_CONFIRMED');
 if(git('rev-parse','HEAD')!==env.VERCEL_GIT_COMMIT_SHA)throw Error('ULTRA_CHECKOUT_SHA_MISMATCH');
 if(git('diff','--name-only','HEAD')||git('ls-files','--others','--exclude-standard'))throw Error('ULTRA_CHECKOUT_NOT_CLEAN');
 const result=verifyContent();if(result.ultraProductionScopeRelease!==true||result.exactSource!==true)throw Error('ULTRA_CONTENT_NOT_CONFIRMED');
 return {ok:true,commit:env.VERCEL_GIT_COMMIT_SHA,branch:ULTRA_COMMANDS_RELEASE_BRANCH};
}
