import {PERSONAS} from './contracts.mjs';
export const FREE_REPLY_UNAVAILABLE='Não foi possível consultar o atendimento agora. Sua conversa foi preservada; tente novamente.';
const invalid=()=>Error(FREE_REPLY_UNAVAILABLE);
const text=(value,limit)=>typeof value==='string'&&value.trim().length>0&&value.length<=limit;
/** Validate an untrusted service response before placing it into React state. */
export function projectFreeReply(value,persona){
 const expected=PERSONAS.find(p=>p.id===persona);
 const links=value?.links??value?.articles;
 if(!expected||value?.ok!==true||value.persona!==persona||value.paidAi!==false||
  value.name!==expected.name||!text(value.explanation,6000)||!Array.isArray(links)||links.length>12)throw invalid();
 const projected=links.map(link=>{
  // This free sales surface navigates only to local product pages.
  if(!text(link?.title,200)||!text(link?.href,200)||!/^\/[a-z0-9/_-]*$/i.test(link.href)||link.href.startsWith('//'))throw invalid();
  return {title:link.title,href:link.href};
 });
 return {name:expected.name,persona,explanation:value.explanation,links:projected};
}
export async function readFreeReply(response,persona){
 if(!response.ok)throw invalid();
 let value;try{value=await response.json();}catch{throw invalid();}
 return projectFreeReply(value,persona);
}
