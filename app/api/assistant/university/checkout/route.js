import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../../lib/pay/auth.mjs';
import {handleUniversitySubscription,UNIVERSITY_HEADERS} from '../../../../../lib/assistant/university-subscription.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request){
 try{requirePayToken(request);return await handleUniversitySubscription(request,{action:'checkout',db:getJeniosPayAdmin()});}
 catch(error){return Response.json({ok:false,state:'not_started',code:'UNIVERSITY_UNAVAILABLE',error:error.status?error.message:'A contratação da Universidade está temporariamente indisponível.'},{status:error.status||503,headers:UNIVERSITY_HEADERS});}
}
