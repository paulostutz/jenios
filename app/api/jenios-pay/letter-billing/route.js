import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {getJeniosPlatformAdmin} from '../../../../lib/platform/admin-db.mjs';
import {handleLetterBilling,LETTER_HEADERS} from '../../../../lib/pay/letter-billing-cb006.mjs';
import {requirePayToken} from '../../../../lib/pay/auth.mjs';
export const dynamic='force-dynamic';export const runtime='nodejs';
async function handle(request){try{requirePayToken(request);return await handleLetterBilling(request,{db:getJeniosPayAdmin(),platformDb:getJeniosPlatformAdmin()});}catch{return Response.json({ok:false,error:'Entre na sua conta para consultar a cobrança.'},{status:401,headers:LETTER_HEADERS});}}
export const GET=handle;export const POST=handle;
