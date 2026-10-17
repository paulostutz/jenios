import {grantVerifiedPersonTrial,trialAccessWindow,TRIAL_DURATION_MS} from './person-ledger.mjs';
const headers={'Cache-Control':'no-store, private','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers});
function sameOrigin(req){
 const origin=req.headers.get('origin');
 return !origin||origin===new URL(req.url).origin;
}
function authorized(auth){return Boolean(auth&&!auth.error&&auth.userId&&!auth.user?.is_anonymous);}
/** Disabled unless the operator explicitly authorizes the identity vendor, policy, ledger and environment. */
export async function trialRequest(request,{enabled=false,context,db,verifyIdentity,secret,now=()=>Date.now()}={}){
 if(request.method!=='POST')return json(405,{error:'Método não permitido.'});
 if(!enabled)return json(503,{code:'TRIAL_NOT_AVAILABLE',error:'Teste gratuito ainda não habilitado.'});
 if(!sameOrigin(request))return json(403,{error:'Origem não permitida.'});
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return json(415,{error:'Tipo de confirmação inválido.'});
 if(Number(request.headers.get('content-length')||0)>4608)return json(413,{error:'Solicitação muito grande.'});
 let raw;try{raw=await request.text();}catch{return json(400,{error:'Solicitação inválida.'});}
 if(raw.length>4608)return json(413,{error:'Solicitação muito grande.'});
 let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'Solicitação inválida.'});}
 if(!body||Array.isArray(body)||Object.keys(body).length!==1||
    typeof body.verificationToken!=='string'||body.verificationToken.length<20||body.verificationToken.length>4096){
  return json(400,{error:'Informe a comprovação de identidade fornecida pelo verificador autorizado.'});
 }
 try {
  const auth=await context(request);
  if(!authorized(auth))return json(auth?.status||401,{error:'Faça login na JENIOS Social.'});
  const result=await grantVerifiedPersonTrial({user:{id:auth.userId,is_anonymous:false},verificationToken:body.verificationToken,verifyIdentity,db,secret,now});
  if(result.status==='already_claimed')return json(409,{status:'already_claimed',eligible:false,chargeCreated:false,
   message:'Uma avaliação gratuita já foi registrada para esta pessoa.'});
  return json(201,result);
 } catch(error){return json(error?.status||503,{code:error?.code||'TRIAL_UNAVAILABLE',error:error?.status?error.message:'Não foi possível confirmar a elegibilidade.'});}
}
/** Read-only, bound by validated bearer user. Never trusts a requested user ID. */
export async function trialStatus(request,{enabled=false,context,db,now=()=>Date.now()}={}){
 if(request.method!=='GET')return json(405,{error:'Método não permitido.'});
 if(!enabled)return json(503,{code:'TRIAL_NOT_AVAILABLE',error:'Teste gratuito ainda não habilitado.'});
 try {
  const auth=await context(request);
  if(!authorized(auth))return json(auth?.status||401,{error:'Faça login na JENIOS Social.'});
  const res=await db.from('jenios_platform_trial_ledger_v1').select('started_at,expires_at,user_id')
   .eq('user_id',auth.userId).maybeSingle();
  if(res.error)throw res.error;
  if(!res.data)return json(200,{active:false,hasClaimed:false});
  if(res.data.user_id!==auth.userId)return json(503,{error:'Consulta indisponível.'});
  const start=Date.parse(res.data.started_at),end=Date.parse(res.data.expires_at);
  if(!Number.isFinite(start)||!Number.isFinite(end)||Math.abs(end-start-TRIAL_DURATION_MS)>1000)return json(503,{error:'Período inconsistente.'});
  const status=trialAccessWindow(res.data.started_at,now());
  return json(200,{active:status.active,hasClaimed:true,expiresAt:status.endsAt,remainingMs:status.remainingMs});
 }catch{return json(503,{error:'Não foi possível consultar o teste gratuito.'});}
}