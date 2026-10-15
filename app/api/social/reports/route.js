import {socialContext} from '../auth.mjs';
import {validUUID} from '../validation.mjs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let body;try{body=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 const targetType=body?.targetType||'post',targetId=body?.targetId||body?.postId;
 if(!['post','live'].includes(targetType)||!validUUID(targetId)||!['sexual','hate','violence','terrorism','fraud','harassment','other'].includes(body.reason)||typeof body.details!=='string'||body.details.length>2000)return reply({error:'INVALID_REPORT'},400);
 const post=await ctx.db.from(targetType==='live'?'lives':'posts').select('id').eq('id',targetId).maybeSingle();if(post.error)return reply({error:'REPORT_UNAVAILABLE'},503);if(!post.data)return reply({error:'POST_NOT_FOUND'},404);
 const result=await ctx.db.from('reports').insert({reporter_id:ctx.userId,target_type:targetType,target_id:targetId,reason:body.reason,details:body.details.trim()}).select('id,status').single();
 return result.error?reply({error:'REPORT_NOT_SAVED'},503):reply({report:result.data},201);
}
