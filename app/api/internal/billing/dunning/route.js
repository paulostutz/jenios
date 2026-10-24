import {timingSafeEqual} from 'node:crypto';
import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {productionEmailDeliveryPolicy} from '../../../../../lib/email/production-delivery-policy.mjs';
import {emailDispatchLimits} from '../../../../../lib/email/dispatch-budget.mjs';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export const maxDuration=60;
function authorized(request){
 const expected=process.env.CRON_SECRET||'',supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/,'');
 if(expected.length<24||!/^Bearer [^\s]+$/i.test(request.headers.get('authorization')||'')||!supplied)return false; const a=Buffer.from(expected),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function GET(request){
 const headers={'Cache-Control':'no-store'};
 if(!authorized(request))return Response.json({error:'Não autorizado'},{status:401,headers});
 if(request.method!=='GET')return Response.json({error:'Método não permitido'},{status:405,headers:{...headers,Allow:'GET'}});
 if(process.env.JENIOS_SUBSCRIPTION_DUNNING_ENABLED!=='true')return Response.json({status:'DISABLED',mutated:false},{headers});
 const limits=emailDispatchLimits(process.env);
 if(!productionEmailDeliveryPolicy(process.env).ready||!limits.ready)return Response.json({status:'DISABLED',mutated:false},{headers});
 try{const db=getJeniosPayAdmin();const {data,error}=await db.rpc('jenios_process_subscription_dunning_r42',{p_now:new Date().toISOString(),p_start_at:limits.startAt,p_max_age_hours:limits.maxAgeHours});if(error)throw error;
  const result=Array.isArray(data)&&data.length===1?data[0]:data;
  const values=Object.fromEntries(['queued','marked_past_due','cancelled','revoked'].map(key=>[key,result?.[key]]));
  if(Object.values(values).some(value=>!Number.isSafeInteger(value)||value<0))throw Error('DUNNING_UNCONFIRMED');
  return Response.json({status:'OK',result:values},{headers});}
 catch{return Response.json({status:'ERROR',error:'Não foi possível processar a régua financeira.'},{status:503,headers});}
}
