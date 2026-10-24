import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {verifyResendSvix,parseResendSuppressionEvent,resendWebhookReadiness} from '../../../../lib/email/resend-webhook-verifier.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

async function rawBody(request,maxBytes=65536){
 const length=Number(request.headers.get('content-length')||0);
 if(Number.isFinite(length)&&length>maxBytes)throw Error('BODY_TOO_LARGE');
 if(!request.body)return '';
 const reader=request.body.getReader(),chunks=[];
 let bytes=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>maxBytes){await reader.cancel();throw Error('BODY_TOO_LARGE');}
   chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks,bytes).toString('utf8');
 }finally{reader.releaseLock();}
}

export async function POST(request){
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='POST')return Response.json({error:'Método não permitido'},{status:405,headers:{...headers,Allow:'POST'}});
 if(process.env.JENIOS_RESEND_WEBHOOK_ENABLED!=='true')
  return new Response(null,{status:404,headers});

 const gate=resendWebhookReadiness(process.env);
 if(!gate.ready)
  return Response.json({ok:false,error:'Webhook indisponível.'},{status:503,headers});

 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))
  return Response.json({ok:false,error:'Conteúdo inválido.'},{status:415,headers});

 let payload;
 try{payload=await rawBody(request);}
 catch{return Response.json({ok:false,error:'Payload inválido.'},{status:413,headers});}

 const id=request.headers.get('svix-id')||'';
 const timestamp=request.headers.get('svix-timestamp')||'';
 const signature=request.headers.get('svix-signature')||'';

 if(!verifyResendSvix({
  payload,id,timestamp,signature,secret:process.env.RESEND_WEBHOOK_SECRET
 }))
  return Response.json({ok:false,error:'Assinatura inválida.'},{status:400,headers});

 let event;
 try{event=parseResendSuppressionEvent(payload);}
 catch{return Response.json({ok:false,error:'Evento inválido.'},{status:400,headers});}

 if(!event.supported)
  return Response.json({ok:true,ignored:true},{headers});

 try{
  const db=getJeniosPayAdmin();
  const {data,error}=await db.rpc('jenios_ingest_resend_suppression_b305',{
   p_event_id:id,
   p_event_type:event.eventType,
   p_recipient_email:event.recipient,
   p_event_at:event.eventAt,
   p_permanent_bounce:event.permanentBounce
  });
  if(error||!data?.ok)throw error||Error('WEBHOOK_LEDGER_UNCONFIRMED');
  return Response.json({
   ok:true,
   duplicate:data.duplicate===true,
   disposition:data.disposition||'accepted'
  },{headers});
 }catch{
  return Response.json({ok:false,error:'Não foi possível registrar o evento.'},{status:503,headers});
 }
}
