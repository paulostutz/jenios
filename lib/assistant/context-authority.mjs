import {createHash} from 'node:crypto';
import {verifiedPlatformPlan,proPlanAccess} from './pro-access.mjs';
import {learnerRepository} from '../learning/repository.mjs';
import {projectLesson} from '../learning/engine.mjs';
import {normalizeConversationToolContext,conversationError} from './conversation-contract.mjs';

const PLAN_NAMES=Object.freeze({'platform-nacional':'Nacional','platform-global-crypto':'Global Crypto','platform-internacional-pro':'Internacional Pro'});
/** Account facts are projected from a verified server query, never browser claims. */
export function accountContextFromPlan(user,plan,env=process.env,now=Date.now()){
 if(!user?.id||user.is_anonymous)return null;
 const rights=proPlanAccess(plan,user,env);
 return {origin:'server',verified:true,signedIn:true,planCode:plan?.code||null,planName:PLAN_NAMES[plan?.code]||null,
  planStatus:plan?'active':'no_active_plan',periodEnd:plan?.periodEnd||null,proIncluded:rights.proIncluded,asOf:new Date(now).toISOString()};
}
export async function loadAccountContext(db,user,{env=process.env,now=Date.now(),planResolver=verifiedPlatformPlan}={}){
 if(!user?.id||user.is_anonymous)return null;
 const plan=await planResolver(db,user.id,now);
 return accountContextFromPlan(user,plan,env,now);
}
/** The caller supplies the authenticated user and server-computed plan rights. */
export async function loadAuthorizedLesson({db,user,rights,lessonId,now=Date.now(),repository=learnerRepository}={}){
 if(!lessonId)return null;
 if(typeof lessonId!=='string'||!/^[a-z0-9-]{1,100}$/.test(lessonId))throw conversationError('Aula inválida.');
 if(!user?.id||user.is_anonymous||!rights?.universityIncluded)throw conversationError('O acesso a esta aula precisa estar ativo.',403,'LESSON_FORBIDDEN');
 const row=await repository(db,user.id).read();
 const lesson=projectLesson(row.state,lessonId,now);
 return {origin:'server',verified:true,lessonId:lesson.id,title:lesson.title,objective:lesson.objective,
  paragraphs:lesson.paragraphs.slice(0,12),example:lesson.example,exercise:lesson.exercise,
  sources:lesson.sources.map(({id,title,url})=>({id,title,url})),asOf:new Date(now).toISOString()};
}
/** Persist only the already-projected output of an authorized tool, with its date. */
export function toolContextFromResult(result){
 if(result?.mode!=='tool'||typeof result.tool!=='string'||!Number.isFinite(Date.parse(result.consultedAt)))return null;
 const facts=[{label:'Consulta',value:String(result.title||result.tool).slice(0,180)},...(result.facts||[])];
 if(result.sections)for(const section of result.sections.slice(0,3)){
  facts.push({label:String(section.title).slice(0,100),value:section.status?.disponivel===true?
   (section.status.stale?'Dados desatualizados':section.status.historico?'Dados históricos':'Fonte disponível'):'Fonte indisponível'});
 }
 // Keep enough room for dates and schema. An unsupported value is omitted, never guessed.
 const projected=[];let size=0;
 for(const fact of facts.slice(0,12)){
  if(typeof fact.label!=='string'||typeof fact.value!=='string'||!fact.value.trim())continue;
  const safe={label:fact.label.slice(0,100),value:fact.value.slice(0,400)};
  const byteLength=Buffer.byteLength(JSON.stringify(safe),'utf8');
  if(size+byteLength>2400)break;
  try{normalizeConversationToolContext({origin:'server',verified:true,tool:result.tool,observedAt:result.consultedAt,sourceAt:null,facts:[safe]});}
  catch{continue;}
  projected.push(safe);size+=byteLength;
 }
 const source=facts.find(x=>x.label==='Horário da fonte')?.value;
 return normalizeConversationToolContext({origin:'server',verified:true,tool:result.tool,observedAt:result.consultedAt,
  sourceAt:Number.isFinite(Date.parse(source))?new Date(source).toISOString():null,facts:projected});
}
/** Quote freshness ignores the current clock, but binds every substantive context fact. */
export function assistantContextDigest(context){
 const undated=value=>value?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='asOf')):null;
 const value={conversationId:context.conversationId||null,revision:context.revision??null,
  turns:(context.turns||[]).filter(t=>['completed','answered','settled'].includes(t.status)).slice(-8)
   .map(({turnId,question,answer,articles,createdAt,status})=>({turnId,question,answer,articles,createdAt,status})),
  summary:context.summary||null,toolContext:context.toolContext||null,
  accountContext:undated(context.accountContext),lessonContext:undated(context.lessonContext)};
 return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
