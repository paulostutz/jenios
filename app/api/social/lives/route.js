import {socialContext} from '../auth.mjs';
import {validUUID} from '../validation.mjs';
export const dynamic='force-dynamic';
const fields='id,host_id,title,youtube_video_id,status,created_at';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const offset=Number(new URL(request.url).searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return reply({error:'INVALID_OFFSET'},400);
 const result=await ctx.db.from('lives').select(fields).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+49);
 return result.error?reply({error:'LIVES_UNAVAILABLE'},503):reply({lives:result.data||[],nextOffset:result.data?.length===50?offset+50:null});
}
export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let input;try{input=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 if(typeof input?.title!=='string'||!input.title.trim()||input.title.length>120||typeof input.videoId!=='string'||!(/^[A-Za-z0-9_-]{11}$/.test(input.videoId)))return reply({error:'INVALID_LIVE'},400);
 const result=await ctx.db.from('lives').insert({host_id:ctx.userId,title:input.title.trim(),youtube_video_id:input.videoId}).select(fields).single();
 return result.error?reply({error:result.error.code==='23505'?'LIVE_ALREADY_EXISTS':'LIVE_NOT_SAVED'},result.error.code==='23505'?409:503):reply({live:result.data},201);
}
export async function DELETE(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const id=new URL(request.url).searchParams.get('id');if(!validUUID(id))return reply({error:'INVALID_LIVE'},400);
 const result=await ctx.db.from('lives').delete().eq('id',id).eq('host_id',ctx.userId);
 return result.error?reply({error:'LIVE_NOT_REMOVED'},503):reply({deleted:true});
}
