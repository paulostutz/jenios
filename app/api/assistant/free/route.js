import {HELP_ARTICLES} from '../../../../lib/assistant/knowledge.mjs';
import {handleFreeAssistant} from '../../../../lib/assistant/free-service.mjs';
import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
export async function GET(){
 return Response.json({ok:true,free:true,paidAi:false,personas:['genio','genia'],
  topics:HELP_ARTICLES.filter(x=>['start','school','trends','bankscore','university-daily'].includes(x.id))
   .map(x=>({id:x.id,title:x.title,href:x.href}))},{headers});
}
export async function POST(request){return handleFreeAssistant(request,{getDb:getJeniosPayAdmin});}
