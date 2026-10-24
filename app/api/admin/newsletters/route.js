import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../lib/pay/auth.mjs';
import {requireAdminPermission} from '../../../../lib/admin-access.mjs';
import {noCrossOriginMutation} from '../../../../lib/admin-users.mjs';
import {normalizeNewsletterAction,readNewsletterBody} from '../../../../lib/email/newsletter-admin.mjs';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const columns='id,edition_key,subject,items,scheduled_at,status,revision,created_at,updated_at';
const failure=error=>Response.json({error:error?.status?error.message:'Não foi possível concluir a operação do Radar.'},{status:error?.status||503,headers});
async function access(request){
 requirePayToken(request);
 const db=getJeniosPayAdmin(),actor=await requireAdminPermission(request,db,'permissions.manage');
 return {db,actor};
}
export async function GET(request){
 try{
  const {db}=await access(request);
  const {data,error}=await db.from('jenios_newsletter_editions_b305').select(columns).order('scheduled_at',{ascending:false}).limit(50);
  if(error)throw error;
  return Response.json({editions:data||[]},{headers});
 }catch(error){return failure(error);}
}
export async function POST(request){
 try{
  noCrossOriginMutation(request);
  const {db,actor}=await access(request);
  const {action,id,revision,payload}=normalizeNewsletterAction(await readNewsletterBody(request));
  const {data,error}=await db.rpc('jenios_manage_newsletter_r42',{
   p_actor_id:actor.id,p_action:action,p_edition_id:id,p_expected_revision:revision,p_payload:payload
  });
  if(error){
   if(error.code==='23505')throw Object.assign(new Error('Já existe uma edição com esta identificação. Atualize a lista.'),{status:409});
   if(/NEWSLETTER_R42_CONFLICT/.test(error.message||''))throw Object.assign(new Error('A edição foi alterada ou já foi aprovada. Atualize a lista.'),{status:409});
   if(/NEWSLETTER_R42_SCHEDULE/.test(error.message||''))throw Object.assign(new Error('Salve uma data futura antes de aprovar o envio.'),{status:400});
   throw error;
  }
  return Response.json({edition:data},{status:action==='create'?201:200,headers});
 }catch(error){return failure(error);}
}
