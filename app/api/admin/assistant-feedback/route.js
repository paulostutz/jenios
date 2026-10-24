import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../lib/pay/auth.mjs';
import {handleAssistantReview} from '../../../../lib/assistant/admin-feedback-service.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request){
 try{requirePayToken(request);return await handleAssistantReview(request,{db:getJeniosPayAdmin()});}
 catch(error){return Response.json({ok:false,error:error.status?error.message:'Revisão indisponível.'},{status:error.status||503,headers:{'Cache-Control':'private, no-store'}});}
}
