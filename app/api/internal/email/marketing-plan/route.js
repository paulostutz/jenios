import {timingSafeEqual} from 'node:crypto';
import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function authorized(request){
 const expected=process.env.CRON_SECRET||'';
 const supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/,'');
 if(!expected||!supplied)return false;
 const a=Buffer.from(expected),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}

export async function GET(request){
 const headers={'Cache-Control':'no-store'};
 if(!authorized(request))return Response.json({error:'Não autorizado'},{status:401,headers});
 if(process.env.JENIOS_MARKETING_PLANNER_ENABLED!=='true')
  return Response.json({status:'DISABLED',planned:0,suppressed:0},{headers});
 try{
  const db=getJeniosPayAdmin();
  const {data,error}=await db.rpc('jenios_plan_marketing_emails_b305',{p_now:new Date().toISOString()});
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  return Response.json({status:'OK',planned:Number(result?.planned||0),suppressed:Number(result?.suppressed||0)},{headers});
 }catch{
  return Response.json({status:'ERROR',error:'Não foi possível planejar as comunicações.'},{status:503,headers});
 }
}
