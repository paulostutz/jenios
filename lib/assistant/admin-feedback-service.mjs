import {requireAdminPermission} from '../admin-access.mjs';
import {adminConversationReview} from './conversation-repository.mjs';
import {conversationMemoryEnabled,CONVERSATION_HEADERS} from './conversation-contract.mjs';

export async function handleAssistantReview(request,{db,env=process.env,authorize=requireAdminPermission,review=adminConversationReview,now=Date.now()}={}){
 const respond=(body,status=200)=>Response.json(body,{status,headers:CONVERSATION_HEADERS});
 try{
  if(request.method!=='GET')return respond({ok:false,error:'Método não permitido.'},405);
  await authorize(request,db,'permissions.manage');
  if(!conversationMemoryEnabled(env))return respond({ok:true,available:false,autoPublished:false});
  const result=await review(db,{limit:30,days:30});
  return respond({...result,available:true,generatedAt:new Date(now).toISOString(),autoPublished:false});
 }catch(error){return respond({ok:false,error:[401,403].includes(error.status)?error.message:'A revisão dos assistentes está temporariamente indisponível.'},[401,403].includes(error.status)?error.status:503);}
}
