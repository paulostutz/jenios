import {createHash} from 'node:crypto';
import {assistantSameOrigin} from '../connections/request-origin.mjs';
import {assessUltraLeverage,ultraConnectionReadiness} from './policy.mjs';
import {ultraPeriodStart} from './reporting.mjs';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export const ultraReviewDigest=assessment=>createHash('sha256').update(JSON.stringify({policy:assessment.policyVersion,config:assessment.config,warnings:assessment.warnings})).digest('hex');
async function json(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))fail(415,'Envie dados JSON.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Configuração ausente.');
 const parts=[];let size=0;
 try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>16000){await reader.cancel();fail(413,'Configuração muito grande.');}parts.push(p.value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail(400,'Configuração inválida.');}
}
export async function ultraHttp(request,{getAdmin,now=()=>new Date()}={}){
 try{
  const match=(request.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/i);
  if(!match)fail(401,'Entre com sua conta da JENIOS Platform.');
  if(request.method!=='GET'&&(!request.headers.has('origin')||!assistantSameOrigin(request)))fail(403,'Origem não autorizada.');
  const db=getAdmin();const {data,error}=await db.auth.getUser(match[1]);
  if(error||!data?.user?.id||data.user.is_anonymous)fail(401,'Entre com sua conta da JENIOS Platform.');
  const userId=data.user.id;
  if(request.method==='GET'){
   const url=new URL(request.url);const period=url.searchParams.get('period')||'30d';
   const page=Number(url.searchParams.get('page')||'0');
   if(!Number.isSafeInteger(page)||page<0||page>100000||[...url.searchParams.keys()].some(k=>!['period','page'].includes(k)))fail(400,'Período ou página inválidos.');
   let since;try{since=ultraPeriodStart(period,now());}catch{fail(400,'Período inválido.');}
   const [saved,report]=await Promise.all([
    db.from('jenios_ultra_plans').select('id,config,assessment,risk_acknowledged,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(1),
    db.rpc('jenios_ultra_financial_report',{p_user_id:userId,p_since:since,p_until:now().toISOString(),p_page:page})
   ]);
   if(saved.error||report.error)fail(503,'Os registros do Ultra estão indisponíveis no momento.');
   return reply({ok:true,plan:saved.data?.[0]??null,report:report.data,period,page,connections:ultraConnectionReadiness(),runtimeState:'awaiting_connection',liveExecutionEnabled:false});
  }
  if(request.method!=='POST')return reply({ok:false,error:'Método não permitido.'},405);
  const body=await json(request);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['action','config','reviewDigest','riskAcknowledged'].includes(k)))fail(400,'Requisição inválida.');
  if(body.action==='start')return reply({ok:false,error:'A execução depende da conexão e validação da corretora selecionada.',connections:ultraConnectionReadiness(),liveExecutionEnabled:false},409);
  if(!['evaluate','save'].includes(body.action))fail(400,'Ação inválida.');
  const assessment=assessUltraLeverage(body.config),reviewDigest=ultraReviewDigest(assessment);
  if(body.action==='evaluate')return reply({ok:true,assessment,reviewDigest,liveExecutionEnabled:false});
  if(body.reviewDigest!==reviewDigest)fail(409,'Revise novamente: a configuração foi alterada.');
  if(assessment.requiresAcknowledgement&&body.riskAcknowledged!==true)return reply({ok:false,error:'Leia a orientação e confirme sua decisão para continuar.',assessment,reviewDigest},409);
  // One immutable record holds the exact configuration and the matching acknowledgement.
  const result=await db.from('jenios_ultra_plans').insert({user_id:userId,config:assessment.config,assessment,
   review_digest:reviewDigest,risk_acknowledged:assessment.requiresAcknowledgement&&body.riskAcknowledged===true,
   policy_version:assessment.policyVersion}).select('id,config,assessment,risk_acknowledged,created_at').single();
  if(result.error)fail(503,'Não foi possível guardar a configuração. Tente novamente.');
  return reply({ok:true,plan:result.data,runtimeState:'awaiting_connection',liveExecutionEnabled:false},201);
 }catch(e){return reply({ok:false,error:e?.status?e.message:'O Ultra está temporariamente indisponível.',liveExecutionEnabled:false},e?.status||503);}
}
