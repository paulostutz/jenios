import {checkS05DeploymentScope,ULTRA_COMMANDS_RELEASE_BRANCH} from '../lib/release/environment-scope.mjs';
import {verifyUltraProductionSource} from '../lib/release/ultra-production-source.mjs';
if(process.env.VERCEL_ENV==='production'&&process.env.VERCEL_GIT_COMMIT_REF===ULTRA_COMMANDS_RELEASE_BRANCH){
 try{verifyUltraProductionSource(process.env);}catch(error){console.error('JENIOS Ultra release blocked: '+error.message);process.exit(1);}
}
if(process.env.VERCEL_GIT_COMMIT_REF==='release/jenios-genios-g44-20261024'){
 const present=name=>typeof process.env[name]==='string'&&process.env[name].length>=21;
 console.log('JENIOS_G44_CONFIG '+JSON.stringify({
  openAiConfigured:present('OPENAI_API_KEY'),
  memoryEnabled:process.env.JENIOS_ASSISTANT_MEMORY_ENABLED==='true',
  sessionConfigured:present('JENIOS_ASSISTANT_SESSION_SECRET'),
  salesEnabled:process.env.JENIOS_SALES_GENERATIVE_ENABLED==='true',
  proEnabled:process.env.JENIOS_PRO_GENERATION_ENABLED==='true',
  visitorSaltConfigured:present('JENIOS_SALES_VISITOR_SALT'),
  proQuoteConfigured:present('JENIOS_PRO_QUOTE_SECRET'),
  socialServerConfigured:present('SUPABASE_SERVICE_ROLE_KEY')||present('SUPABASE_SECRET_KEY'),
  platformServerConfigured:present('PLATFORM_SUPABASE_SERVICE_ROLE_KEY')
 }));
}
const result=checkS05DeploymentScope(process.env);
if(!result.ok){
 console.error('JENIOS S05 release blocked: '+result.reason);
 process.exitCode=1;
}else{
 console.log('JENIOS S05 scope: '+result.mode);
}
