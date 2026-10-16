import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requireReportBuyer} from '../../../../lib/pay/buyer.mjs';
import {pixStatus} from '../../../../lib/pay/pix-status.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request) {
  try {
    const db=getJeniosPayAdmin(),user=await requireReportBuyer(request,db);
    const result=await pixStatus({db,user,id:new URL(request.url).searchParams.get('id')});
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error.status?error.message:'Não foi possível consultar o pagamento.'},{status:error.status||503,headers:{'Cache-Control':'no-store'}});}
}
