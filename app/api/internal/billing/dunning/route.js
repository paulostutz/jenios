import {timingSafeEqual} from 'node:crypto';
import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
export const runtime='nodejs'; export const dynamic='force-dynamic';
function authorized(request){
 const expected=process.env.CRON_SECRET||'',supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/,'');
 if(!expected||!supplied)return false; const a=Buffer.from(expected),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function GET(request){
 const headers={'Cache-Control':'no-store'};
 if(!authorized(request))return Response.json({error:'Não autorizado'},{status:401,headers});
 if(process.env.JENIOS_SUBSCRIPTION_DUNNING_ENABLED!=='true')return Response.json({status:'DISABLED',mutated:false},{headers});
 try{const db=getJeniosPayAdmin();const {data,error}=await db.rpc('jenios_process_subscription_dunning_b305',{p_now:new Date().toISOString()});if(error)throw error;return Response.json({status:'OK',result:data},{headers});}
 catch{return Response.json({status:'ERROR',error:'Não foi possível processar a régua financeira.'},{status:503,headers});}
}
