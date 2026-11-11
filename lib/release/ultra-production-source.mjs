import {execFileSync} from 'node:child_process';
import {ULTRA_COMMANDS_RELEASE_BRANCH} from './environment-scope.mjs';
import {verifyOwnerWebRelease} from '../../scripts/check-ultra-owner-web.mjs';
// Paths only: NUL-delimited Git output is never interpreted as file contents.
// Bound output and strip control/terminal characters before putting it in build logs.
export function summarizeUltraCheckout(tracked,untracked){
 const safePath=value=>String(value).replace(/[^A-Za-z0-9_./ -]/g,'_').slice(0,160)||'[unavailable]';
 const tokens=String(tracked).split('\0').filter(Boolean),trackedRows=[];
 for(let i=0;i<tokens.length;i+=2)trackedRows.push({status:/^[AMDTUXB]$/.test(tokens[i])?tokens[i]:'?',path:safePath(tokens[i+1]??'[unavailable]')});
 const untrackedRows=String(untracked).split('\0').filter(Boolean).map(path=>({status:'?',path:safePath(path)}));
 return {trackedCount:trackedRows.length,untrackedCount:untrackedRows.length,tracked:trackedRows.slice(0,20),untracked:untrackedRows.slice(0,20),truncated:trackedRows.length>20||untrackedRows.length>20};
}
// No environment override: compare the platform-provided Git identity with the actual checkout.
export function verifyUltraProductionSource(env,{git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim(),verifyContent=verifyOwnerWebRelease}={}){
 if(env.VERCEL_ENV!=='production'||env.VERCEL_GIT_COMMIT_REF!==ULTRA_COMMANDS_RELEASE_BRANCH||env.VERCEL_GIT_PROVIDER!=='github'||env.VERCEL_PROJECT_ID!=='prj_44ipBY3R9sHlQDAXY7NUn1zDguw4'||!/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA??''))throw Error('ULTRA_GIT_IDENTITY_NOT_CONFIRMED');
 if(git('rev-parse','HEAD')!==env.VERCEL_GIT_COMMIT_SHA)throw Error('ULTRA_CHECKOUT_SHA_MISMATCH');
 const tracked=git('diff','--name-status','--no-renames','-z','HEAD'),untracked=git('ls-files','--others','--exclude-standard','-z');
 if(tracked||untracked)throw Error('ULTRA_CHECKOUT_NOT_CLEAN '+JSON.stringify(summarizeUltraCheckout(tracked,untracked)));
 const result=verifyContent();if(result.ultraProductionScopeRelease!==true||result.exactSource!==true)throw Error('ULTRA_CONTENT_NOT_CONFIRMED');
 return {ok:true,commit:env.VERCEL_GIT_COMMIT_SHA,branch:ULTRA_COMMANDS_RELEASE_BRANCH};
}
