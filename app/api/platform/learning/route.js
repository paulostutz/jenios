import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../lib/pay/auth.mjs';
import {handleLearning,LEARNING_HEADERS} from '../../../../lib/learning/service.mjs';
import {configuredGenerativeEnv} from '../../../../lib/assistant/generative-budget.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;
async function handle(request){
 try{requirePayToken(request);return await handleLearning(request,{db:getJeniosPayAdmin(),env:configuredGenerativeEnv(process.env)});}
 catch(error){return Response.json({ok:false,error:error.status?error.message:'Módulo de ensino não configurado.',executionEnabled:false},{status:error.status||503,headers:LEARNING_HEADERS});}
}
export const GET=handle;
export const POST=handle;