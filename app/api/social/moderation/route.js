import {socialContext} from '../auth.mjs';import {validUUID} from '../validation.mjs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
function failure(error){return reply({error:error.message==='REPORT_CHANGED'?'A denúncia foi atualizada por outro moderador. Recarregue a lista.':error.code==='42501'?'Acesso exclusivo para moderadores autorizados.':'Não foi possível concluir a moderação.'},error.code==='42501'?403:error.message==='REPORT_CHANGED'?409:503);}
export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const params=new URL(request.url).searchParams,status=params.get('status')||'pending',offset=Number(params.get('offset')||0);
 if(!['pending','reviewing','resolved','dismissed'].includes(status)||!Number.isSafeInteger(offset)||offset<0||offset>100000)return reply({error:'INVALID_FILTER'},400);
 const result=await ctx.db.rpc('jenios_moderation_queue',{filter_status:status,page_offset:offset});
 return result.error?failure(result.error):reply({reports:result.data||[],nextOffset:result.data?.length===50?offset+50:null});
}
export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let body;try{body=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 if(!validUUID(body?.id)||!['reviewing','dismissed','hide','restore'].includes(body.decision)||typeof body.note!=='string'||body.note.trim().length<3||body.note.length>2000||!['pending','reviewing','resolved','dismissed'].includes(body.expectedStatus))return reply({error:'INVALID_DECISION'},400);
 const result=await ctx.db.rpc('jenios_moderate_report',{report_id:body.id,decision:body.decision,note:body.note.trim(),expected_status:body.expectedStatus});
 return result.error?failure(result.error):reply({report:result.data});
}
