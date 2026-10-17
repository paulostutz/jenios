import {RECENT_AUTH_MS} from './account-deletion.mjs';
/** Cancels only an own pending request; never deletes an account or edits another status. */
export const CANCEL_CONFIRMATION='CANCELAR SOLICITACAO';
const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers});
export async function cancelAccountDeletion(request,{context,now=()=>Date.now()}={}){
 if(request.method!=='POST')return response(405,{error:'Método não permitido.'});
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return response(403,{error:'Origem não permitida.'});
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return response(415,{error:'Confirmação inválida.'});
 if(Number(request.headers.get('content-length')||0)>1024)return response(413,{error:'Confirmação muito grande.'});
 let raw;try{raw=await request.text();}catch{return response(400,{error:'Confirmação inválida.'});}
 if(raw.length>1024)return response(413,{error:'Confirmação muito grande.'});
 let body;try{body=JSON.parse(raw);}catch{return response(400,{error:'Confirmação inválida.'});}
 if(!body||Array.isArray(body)||Object.keys(body).length!==1||body.confirmation!==CANCEL_CONFIRMATION)return response(400,{error:'Confirme o cancelamento da solicitação.'});
 try{
  const auth=await context(request);
  if(auth?.error||!auth?.userId||!auth.db)return response(auth?.status||401,{error:'Entre na sua conta para continuar.'});
  const {db,userId}=auth;
  const bearer=(request.headers.get('authorization')||'').match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if(!bearer)return response(401,{error:'Sessão inválida.'});
  const {data,error}=await db.auth.getUser(bearer);
  const at=Date.parse(data?.user?.last_sign_in_at),current=now();
  if(error||data?.user?.id!==userId||data.user.is_anonymous)return response(401,{error:'A sessão mudou. Entre novamente.'});
  if(!Number.isFinite(at)||at>current||current-at>RECENT_AUTH_MS)return response(403,{code:'REAUTH_REQUIRED',error:'Entre novamente para cancelar a solicitação.'});
  const result=await db.from('social_account_deletion_requests').update({status:'cancelled'})
   .eq('user_id',userId).eq('status','pending').select('id,status,created_at').maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)return response(409,{error:'Esta solicitação não está pendente e não pode ser cancelada automaticamente.'});
  return response(200,{request:{id:result.data.id,status:result.data.status,createdAt:result.data.created_at},accountDeleted:false,
   message:'Solicitação cancelada. A conta permanece ativa.'});
 }catch{return response(503,{error:'Não foi possível cancelar a solicitação. Nenhuma mudança foi confirmada.'});}
}
