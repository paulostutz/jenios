import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {handleEmailDispatcher} from '../../../../../lib/email/email-dispatcher.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export async function GET(request){
 return handleEmailDispatcher(request,{env:process.env,getDb:getJeniosPayAdmin});
}
