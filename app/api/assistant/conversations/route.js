import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {handleConversations} from '../../../../lib/assistant/conversation-service.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){return handleConversations(request,{getDb:getJeniosPayAdmin});}
export async function POST(request){return handleConversations(request,{getDb:getJeniosPayAdmin});}
