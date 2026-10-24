import {timingSafeEqual} from 'node:crypto';
import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {transactionalDeliveryReadiness,runTransactionalEmailBatch,runDunningEmailBatch} from '../../../../../lib/email/transactional-delivery-worker.mjs';

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

export async function POST(request){
 const headers={'Cache-Control':'no-store'};
 if(!authorized(request))return Response.json({error:'Não autorizado'},{status:401,headers});
 if(request.method!=='POST')return Response.json({error:'Método não permitido'},{status:405,headers:{...headers,Allow:'POST'}});
 if(!transactionalDeliveryReadiness(process.env).ready)
  return Response.json({status:'DISABLED'},{headers});
 try{
  const db=getJeniosPayAdmin();
  const transactional=await runTransactionalEmailBatch({db,env:process.env,limit:3});
  const dunning=await runDunningEmailBatch({db,env:process.env,limit:3});
  const disabled=transactional.status==='DISABLED'&&dunning.status==='DISABLED';
  return Response.json({status:disabled?'DISABLED':'OK',transactional,dunning},{headers});
 }catch{
  return Response.json({status:'ERROR',error:'Não foi possível processar a fila de comunicação.'},{status:503,headers});
 }
}
