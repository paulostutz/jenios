import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../../lib/pay/auth.mjs';
import {handleUniversitySubscription,UNIVERSITY_HEADERS} from '../../../../../lib/assistant/university-subscription.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request){
 try{requirePayToken(request);return await handleUniversitySubscription(request,{action:'access',db:getJeniosPayAdmin()});}
 catch(error){return Response.json({ok:false,code:'UNIVERSITY_UNAVAILABLE',error:error.status?error.message:'A Universidade está temporariamente indisponível.'},{status:error.status||503,headers:UNIVERSITY_HEADERS});}
}
