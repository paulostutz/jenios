import {timingSafeEqual} from 'node:crypto';
import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {financeEmailDispatchReadiness} from '../../../../../lib/email/finance-payment-confirmation.mjs';
import {runFinanceOutboxBatch} from '../../../../../lib/email/finance-outbox-worker.mjs';
import {emailDispatchLimits} from '../../../../../lib/email/dispatch-budget.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const BATCH_LIMIT=2;

function authorized(request){
 const expected=process.env.CRON_SECRET;
 const match=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')||'');
 if(typeof expected!=='string'||expected.length<24||!match)return false;
 const a=Buffer.from(expected),b=Buffer.from(match[1]);
 return a.length===b.length&&timingSafeEqual(a,b);
}

/** Production entrypoint only. Scheduling and activation are separate operations. */
export async function GET(request){
 const headers={'Cache-Control':'no-store'};
 if(!authorized(request))return Response.json({error:'Não autorizado'},{status:401,headers});
 // Next can route HEAD through GET automatically; it must never process a queue.
 if(request.method!=='GET')return Response.json({error:'Método não permitido'},
  {status:405,headers:{...headers,Allow:'GET'}});
 const readiness=financeEmailDispatchReadiness(process.env);
 if(!readiness.ready||readiness.mode!=='production')
  return Response.json({status:'DISABLED',claimed:0,sent:0,blocked:0},{headers});
 const limit=Math.min(BATCH_LIMIT,emailDispatchLimits(process.env).batchLimit);
 try{
  const db=getJeniosPayAdmin();
  const result=await runFinanceOutboxBatch({db,env:process.env,limit});
  const counts=[result?.claimed,result?.sent,result?.blocked];
  if(result?.status!=='PRODUCTION'||counts.some(value=>!Number.isSafeInteger(value)||value<0||value>limit)||
   result.sent+result.blocked!==result.claimed)throw Error('FINANCE_BATCH_RESULT_UNCONFIRMED');
  return Response.json({status:'PRODUCTION',claimed:result.claimed,sent:result.sent,blocked:result.blocked},{headers});
 }catch{
  return Response.json({status:'ERROR',error:'Não foi possível processar a fila de comunicação financeira.'},
   {status:503,headers});
 }
}
