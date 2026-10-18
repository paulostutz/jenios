import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const result=checkS05DeploymentScope(process.env);
if(!result.ok){
 console.error('JENIOS S05 release blocked: '+result.reason);
 process.exitCode=1;
}else{
 console.log('JENIOS S05 scope: '+result.mode);
}
