import {socialContext} from '../auth.mjs';
import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const failed=(message,status=503)=>Response.json({error:message},{status,headers});

async function identity(request){
 const ctx=await socialContext(request);
 if(ctx.error)throw Object.assign(Error(ctx.error),{status:ctx.status});
 return ctx;
}

export async function GET(request){
 try{
  const ctx=await identity(request);
  const admin=getJeniosPayAdmin();
  const {data,error}=await admin.from('jenios_email_preferences_b305')
   .select('marketing_opt_in,opted_out_at,complaint_at,hard_bounce_at,updated_at')
   .eq('user_id',ctx.userId).maybeSingle();
  if(error)throw error;
  const preference=data||{marketing_opt_in:false,opted_out_at:null,complaint_at:null,hard_bounce_at:null,updated_at:null};
  return Response.json({
   marketingOptIn:preference.marketing_opt_in===true,
   suppressed:Boolean(preference.complaint_at||preference.hard_bounce_at),
   updatedAt:preference.updated_at||null
  },{headers});
 }catch(e){
  if(e?.status===401)return failed('Entre na sua conta para gerenciar as preferências.',401);
  return failed('Não foi possível carregar suas preferências.');
 }
}

export async function POST(request){
 try{
  const ctx=await identity(request);
  let body;try{body=await request.json();}catch{return failed('Requisição inválida.',400);}
  if(typeof body?.marketingOptIn!=='boolean')return failed('Preferência inválida.',400);
  const admin=getJeniosPayAdmin(),now=new Date().toISOString();
  const {data:current,error:readError}=await admin.from('jenios_email_preferences_b305')
   .select('complaint_at,hard_bounce_at').eq('user_id',ctx.userId).maybeSingle();
  if(readError)throw readError;
  const row={user_id:ctx.userId,marketing_opt_in:body.marketingOptIn,
   opted_out_at:body.marketingOptIn?null:now,updated_at:now};
  const {error}=await admin.from('jenios_email_preferences_b305').upsert(row,{onConflict:'user_id'});
  if(error)throw error;
  return Response.json({marketingOptIn:body.marketingOptIn,
   suppressed:Boolean(current?.complaint_at||current?.hard_bounce_at)},{headers});
 }catch(e){
  if(e?.status===401)return failed('Entre na sua conta para gerenciar as preferências.',401);
  return failed('Não foi possível salvar suas preferências.');
 }
}
