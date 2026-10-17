/** Request workflow only. Never deletes identities, media, payments or another user's data. */
export const DELETION_CONFIRMATION='EXCLUIR MINHA CONTA';
export const DELETION_VERSION='social-deletion-request-v1';
export const RECENT_AUTH_MS=15*60*1000;
const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
const safeRequest=row=>row?{id:row.id,status:row.status,createdAt:row.created_at}:null;
function validBody(body){return body&&Object.getPrototypeOf(body)===Object.prototype&&Object.keys(body).sort().join(',')==='confirmation,understood'&&body.confirmation===DELETION_CONFIRMATION&&body.understood===true;}
export async function accountDeletionRequest(request,{context,now=()=>Date.now()}={}){
 if(!['GET','POST'].includes(request.method))return reply(405,{error:'Método não permitido.'});
 if(request.method==='POST'){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return reply(403,{error:'Origem não permitida.'});
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reply(415,{error:'Envie uma confirmação válida.'});
 }
 try{
  const auth=await context(request);
  if(auth.error||!auth.userId||!auth.db)return reply(auth.status||401,{error:'Entre na sua conta para continuar.'});
  const {db,userId}=auth;
  const read=async()=>{const result=await db.from('social_account_deletion_requests').select('id,status,created_at').eq('user_id',userId).maybeSingle();if(result.error)throw result.error;return result.data;};
  if(request.method==='GET')return reply(200,{request:safeRequest(await read()),accountDeleted:false});
  if(Number(request.headers.get('content-length')||0)>1024)return reply(413,{error:'Confirmação muito grande.'});
  const raw=await request.text();if(raw.length>1024)return reply(413,{error:'Confirmação muito grande.'});
  let body;try{body=JSON.parse(raw);}catch{return reply(400,{error:'Confirmação inválida.'});}
  if(!validBody(body))return reply(400,{error:'Confirme que compreendeu e digite EXCLUIR MINHA CONTA.'});
  const bearer=(request.headers.get('authorization')||'').match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if(!bearer)return reply(401,{error:'Sessão inválida.'});
  const {data,error}=await db.auth.getUser(bearer);
  const at=Date.parse(data?.user?.last_sign_in_at),current=now();
  if(error||data?.user?.id!==userId||data?.user?.is_anonymous)return reply(401,{error:'Sua sessão mudou. Entre novamente.'});
  if(!Number.isFinite(at)||at>current||current-at>RECENT_AUTH_MS)return reply(403,{code:'REAUTH_REQUIRED',error:'Entre novamente na sua conta e retorne a esta página para confirmar a solicitação.'});
  const existing=await read();
  if(existing?.status==='cancelled'){
    // Only a staging-reviewed, owner-bound RPC can reopen the UNIQUE request row.
    // Never report success if the RPC or reviewed database schema is missing.
    const reopened=await db.rpc('social_reopen_deletion_request_v1');
    if(reopened.error)throw reopened.error;
    const row=Array.isArray(reopened.data)?reopened.data[0]:reopened.data;
    if(!row||row.status!=='pending'||!row.id)return reply(409,{request:safeRequest(existing),accountDeleted:false,message:'Não foi possível reabrir a solicitação. Consulte o atendimento.'});
    return reply(202,{request:safeRequest(row),accountDeleted:false,message:'Solicitação reaberta. A conta permanece ativa até conclusão do procedimento.'});
  }
  if(existing){
    if(existing.status==='pending')return reply(200,{request:safeRequest(existing),accountDeleted:false,message:'Sua solicitação já está registrada. A conta ainda não foi excluída.'});
    return reply(409,{request:safeRequest(existing),accountDeleted:false,message:'A solicitação está sendo processada ou foi encerrada. Consulte o atendimento.'});
  }
  const result=await db.from('social_account_deletion_requests').insert({user_id:userId,confirmation_version:DELETION_VERSION}).select('id,status,created_at').single();
  if(result.error?.code==='23505'){const concurrent=await read();if(concurrent)return reply(200,{request:safeRequest(concurrent),accountDeleted:false});}
  if(result.error)throw result.error;
  return reply(202,{request:safeRequest(result.data),accountDeleted:false,message:'Solicitação registrada. Sua conta ainda não foi excluída; o processamento será informado neste acompanhamento.'});
 }catch{return reply(503,{error:'Não foi possível registrar ou consultar a solicitação agora. Nenhuma exclusão foi confirmada.'});}
}
