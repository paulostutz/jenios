import {assistantSameOrigin} from '../../../../lib/platform/connections/request-origin.mjs';
import {connectionSecret} from '../../../../lib/platform/connections/support.mjs';
import {HELP_ARTICLES,helpFor} from '../../../../lib/assistant/knowledge.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
const error=(message,status=400)=>Response.json({ok:false,error:message},{status,headers});
export async function GET(){
 return Response.json({ok:true,free:true,paidAi:false,personas:['genio','genia'],
  topics:HELP_ARTICLES.filter(x=>['start','school','trends','bankscore','university-daily'].includes(x.id))
   .map(x=>({id:x.id,title:x.title,href:x.href}))},{headers});
}
export async function POST(request){
 if(!assistantSameOrigin(request))return error('Origem não autorizada.',403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return error('Informe JSON.',415);
 if(Number(request.headers.get('content-length')||0)>3500)return error('Pergunta muito longa.',413);
 let body;
 try{
  const buffer=await request.arrayBuffer();
  if(buffer.byteLength>3500)return error('Pergunta muito longa.',413);
  body=JSON.parse(new TextDecoder().decode(buffer));
 }catch{return error('Requisição inválida.');}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['persona','message'].includes(k)))return error('Campos não permitidos.');
 const {message,persona}=body;
 if(!['genio','genia'].includes(persona)||typeof message!=='string'||!message.trim()||message.length>1000)return error('Escolha um personagem e faça uma pergunta de até mil caracteres.');
 if(connectionSecret(message))return error('Não envie credenciais ao atendimento. Revogue no fornecedor qualquer chave real exposta. Nenhuma conta foi conectada.');
 const found=helpFor(message);
 const name=persona==='genia'?'Gênia':'Gênio';
 return Response.json({ok:true,free:true,paidAi:false,persona,name,mode:'guided',
  explanation:found.length?found.map(x=>x.text).join('\n\n'):
   'Não encontrei este assunto no material disponível. Você pode conhecer os módulos na Sala de Controle ou entrar em contato com o suporte JENIOS. Não vou inventar informações.',
  articles:found.map(x=>({id:x.id,title:x.title,href:x.href})),
  executionEnabled:false,subscriptionGranted:false,monitoringEnabled:false},{headers});
}
