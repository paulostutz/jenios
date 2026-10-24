import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../lib/pay/auth.mjs';
import {requireAdminPermission} from '../../../../lib/admin-access.mjs';
import {readEmailAdminHealth} from '../../../../lib/email/admin-health.mjs';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};

export async function GET(request){
 try{
  requirePayToken(request);
  const db=getJeniosPayAdmin();
  await requireAdminPermission(request,db,'reports.run');
  return Response.json(await readEmailAdminHealth(db,process.env),{headers});
 }catch(error){
  return Response.json({error:error?.status?error.message:'Não foi possível consultar a saúde dos e-mails.'},
   {status:error?.status||503,headers});
 }
}
