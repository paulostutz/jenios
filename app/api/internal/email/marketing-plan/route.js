import {timingSafeEqual} from 'node:crypto';
import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {marketingDeliveryReadiness} from '../../../../../lib/email/marketing-delivery-worker.mjs';
import {emailDispatchLimits} from '../../../../../lib/email/dispatch-budget.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

function authorized(request){
 const expected=process.env.CRON_SECRET||'';
 const supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/,'');
 if(expected.length<24||!/^Bearer [^\s]+$/i.test(request.headers.get('authorization')||'')||!supplied)return false;
 const a=Buffer.from(expected),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}

export async function GET(request){
 const headers={'Cache-Control':'no-store'};
 if(!authorized(request))return Response.json({error:'Não autorizado'},{status:401,headers});
 if(request.method!=='GET')return Response.json({error:'Método não permitido'},{status:405,headers:{...headers,Allow:'GET'}});
 if(process.env.JENIOS_MARKETING_PLANNER_ENABLED!=='true')
  return Response.json({status:'DISABLED',planned:0,suppressed:0},{headers});
 const gate=marketingDeliveryReadiness(process.env),limits=emailDispatchLimits(process.env);
 if(!gate.ready||gate.mode!=='production'||!limits.ready)
  return Response.json({status:'DISABLED',planned:0,suppressed:0},{headers});
 try{
  const db=getJeniosPayAdmin();
  const {data,error}=await db.rpc('jenios_plan_marketing_emails_r42',{p_now:new Date().toISOString(),p_start_at:limits.startAt,p_max_age_hours:limits.maxAgeHours});
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  if(!Number.isSafeInteger(result?.planned)||result.planned<0||!Number.isSafeInteger(result?.suppressed)||result.suppressed<0)throw Error('MARKETING_PLAN_UNCONFIRMED');
  return Response.json({status:'OK',planned:result.planned,suppressed:result.suppressed},{headers});
 }catch{
  return Response.json({status:'ERROR',error:'Não foi possível planejar as comunicações.'},{status:503,headers});
 }
}
