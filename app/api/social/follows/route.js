import {socialContext} from '../auth.mjs';
import {validUUID} from '../validation.mjs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const params=new URL(request.url).searchParams,id=params.get('id')||ctx.userId;
 if(!validUUID(id))return reply({error:'INVALID_PROFILE'},400);
 const mode=params.get('list');
 if(mode){
  if(!['followers','following'].includes(mode))return reply({error:'INVALID_LIST'},400);
  const offset=Number(params.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)return reply({error:'INVALID_OFFSET'},400);
  const foreign=mode==='followers'?'follower_id':'following_id',own=mode==='followers'?'following_id':'follower_id';
  const rows=await ctx.db.from('follows').select(foreign).eq(own,id).order('created_at',{ascending:false}).order(foreign,{ascending:false}).range(offset,offset+49);
  if(rows.error)return reply({error:'FOLLOW_UNAVAILABLE'},503);
  const ids=(rows.data||[]).map(r=>r[foreign]);
  const profiles=ids.length?await ctx.db.from('profiles').select('id,handle,display_name,bio,avatar_url').in('id',ids):{data:[]};
  if(profiles.error)return reply({error:'FOLLOW_UNAVAILABLE'},503);
  const map=new Map((profiles.data||[]).map(p=>[p.id,p]));
  return reply({profiles:ids.map(x=>map.get(x)).filter(Boolean),nextOffset:ids.length===50?offset+50:null});
 }
 const results=await Promise.all([
  ctx.db.from('follows').select('follower_id',{count:'exact',head:true}).eq('following_id',id),
  ctx.db.from('follows').select('following_id',{count:'exact',head:true}).eq('follower_id',id),
  ctx.db.from('follows').select('following_id').eq('follower_id',ctx.userId).eq('following_id',id).maybeSingle()
 ]);
 if(results.some(r=>r.error))return reply({error:'FOLLOW_UNAVAILABLE'},503);
 return reply({id,followers:results[0].count||0,following:results[1].count||0,followed:Boolean(results[2].data)});
}
export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let input;try{input=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 if(!validUUID(input?.id)||input.id===ctx.userId)return reply({error:'INVALID_PROFILE'},400);
 const profile=await ctx.db.from('profiles').select('id').eq('id',input.id).maybeSingle();
 if(profile.error)return reply({error:'FOLLOW_UNAVAILABLE'},503);if(!profile.data)return reply({error:'PROFILE_NOT_FOUND'},404);
 const result=await ctx.db.from('follows').upsert({follower_id:ctx.userId,following_id:input.id},{onConflict:'follower_id,following_id',ignoreDuplicates:true});
 return result.error?reply({error:'FOLLOW_NOT_SAVED'},503):reply({followed:true});
}
export async function DELETE(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const id=new URL(request.url).searchParams.get('id');if(!validUUID(id))return reply({error:'INVALID_PROFILE'},400);
 const result=await ctx.db.from('follows').delete().eq('follower_id',ctx.userId).eq('following_id',id);
 return result.error?reply({error:'FOLLOW_NOT_REMOVED'},503):reply({followed:false});
}
