// Public contract only: no keys, financial execution, or proprietary strategy rules.
export const ASSISTANT_VERSION='r27.1';
export const PERSONAS=Object.freeze([
 {id:'genio',name:'Gênio',image:'/assistentes/genio.webp',label:'Ser atendido pelo Gênio'},
 {id:'genia',name:'Gênia',image:'/assistentes/genia.webp',label:'Ser atendido pela Gênia'},
]);
export const ASSISTANT_TOOLS=Object.freeze(['trends','bankscore_search','bankscore_basic','bankscore_full','crypto_basic','crypto_full']);
export const ASSISTANT_HEADERS=Object.freeze({'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'});
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const assistantError=(message,status=400,code='INVALID_REQUEST')=>Object.assign(new Error(message),{status,code});
export function assistantPath(path){return path==='/dashboard'||path==='/dashboard-logado'||path==='/mesa-operacoes'||path==='/diagnostico'||path==='/risco'||path==='/relatorios'||/^\/platform(?:\/|$)/.test(path||'');}
export const INITIAL_ASSISTANT_STATE=()=>({version:1,persona:'genio',aiConsent:false,quota:{hour:'',hourCount:0,day:'',dayCount:0}});
export function reserveAssistant(state,now=Date.now()){
 if(!Number.isFinite(now))throw assistantError('Horário do serviço inválido.',503);
 const iso=new Date(now).toISOString(),hour=iso.slice(0,13),day=iso.slice(0,10),q=state.quota||{};
 const hourCount=q.hour===hour?q.hourCount:0,dayCount=q.day===day?q.dayCount:0;
 if(!Number.isSafeInteger(hourCount)||!Number.isSafeInteger(dayCount)||hourCount<0||dayCount<0)throw assistantError('Controle de uso precisa ser revisado.',503);
 if(hourCount>=30||dayCount>=100)throw assistantError('Limite de consultas atingido. Aguarde a próxima janela; as páginas da plataforma continuam disponíveis.',429,'RATE_LIMITED');
 return {...state,quota:{hour,hourCount:hourCount+1,day,dayCount:dayCount+1}};
}
export function projectAssistant(row,env={},{contextualAiReady=false}={}){
 return {version:ASSISTANT_VERSION,revision:row.revision,persona:row.state.persona,aiConsent:row.state.aiConsent,
  // Readiness is computed by the server's real provider gate. Keep this public
  // contract dependency-free; a key/model alone does not configure contextual AI.
  aiConfigured:Boolean(env.OPENAI_API_KEY&&env.JENIOS_ASSISTANT_MODEL)||env.JENIOS_ASSISTANT_MEMORY_ENABLED==='true'&&contextualAiReady===true,tools:ASSISTANT_TOOLS,
  executionEnabled:false,whatsappEnabled:false,marketResearch:'closed-beta',historyPersistence:env.JENIOS_ASSISTANT_MEMORY_ENABLED==='true',
  notice:'Ajuda e consultas informativas. Nenhuma ordem, saque ou monitoramento contínuo é executado pelo atendimento.'};
}
