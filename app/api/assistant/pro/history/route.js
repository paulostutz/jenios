import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../../lib/pay/auth.mjs';
import {handlePro} from '../../../../../lib/assistant/pro-service.mjs';
import {PRO_HEADERS} from '../../../../../lib/assistant/pro-input.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request){
 try{requirePayToken(request);return await handlePro(request,{action:'history',db:getJeniosPayAdmin()});}
 catch(e){return Response.json({ok:false,state:'not_started',error:e.status?e.message:'O Pro está temporariamente indisponível.'},{status:e.status||503,headers:PRO_HEADERS});}
}
