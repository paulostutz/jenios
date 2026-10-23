import {timingSafeEqual} from 'node:crypto';
import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {runMarketingEmailBatch} from '../../../../../lib/email/marketing-delivery-worker.mjs';

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
 if(!authorized(request))
  return Response.json({error:'Não autorizado'},{status:401,headers});
 try{
  const db=getJeniosPayAdmin();
  const result=await runMarketingEmailBatch({db,env:process.env,limit:5});
  return Response.json(result,{headers});
 }catch{
  return Response.json({status:'ERROR',error:'Não foi possível processar a fila de marketing.'},{status:503,headers});
 }
}
