import {timingSafeEqual} from 'node:crypto';
import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {runTransactionalEmailBatch,runDunningEmailBatch} from '../../../../../lib/email/transactional-delivery-worker.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function authorized(request){
 const expected=process.env.CRON_SECRET||'';
 const supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/,'');
 if(!expected||!supplied)return false;
 const a=Buffer.from(expected),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}

export async function POST(request){
 const headers={'Cache-Control':'no-store'};
 if(!authorized(request))return Response.json({error:'Não autorizado'},{status:401,headers});
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
