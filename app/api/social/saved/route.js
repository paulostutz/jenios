import {socialContext} from '../auth.mjs';
import {validUUID} from '../validation.mjs';
import {POST_FIELDS,publicPost} from '../../../../lib/social/schema.mjs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const params=new URL(request.url).searchParams;
 if(params.has('ids')){
  const ids=params.get('ids').split(',');if(ids.length>50||!ids.every(validUUID))return reply({error:'INVALID_POST_ID'},400);
  const rows=await ctx.db.from('saved_posts').select('post_id').eq('user_id',ctx.userId).in('post_id',ids);
  return rows.error?reply({error:'SAVED_UNAVAILABLE'},503):reply({ids:(rows.data||[]).map(r=>r.post_id)});
 }
 const offset=Number(params.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)return reply({error:'INVALID_OFFSET'},400);
 const rows=await ctx.db.from('saved_posts').select(`post_id,created_at,post:posts(${POST_FIELDS})`).eq('user_id',ctx.userId).order('created_at',{ascending:false}).order('post_id',{ascending:false}).range(offset,offset+19);
 if(rows.error)return reply({error:'SAVED_UNAVAILABLE'},503);
 return reply({posts:(rows.data||[]).filter(r=>r.post).map(r=>publicPost(r.post)),nextOffset:rows.data?.length===20?offset+20:null});
}
export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let input;try{input=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 if(!validUUID(input?.postId))return reply({error:'INVALID_POST_ID'},400);
 const post=await ctx.db.from('posts').select('id').eq('id',input.postId).maybeSingle();
 if(post.error)return reply({error:'SAVED_UNAVAILABLE'},503);if(!post.data)return reply({error:'POST_NOT_FOUND'},404);
 const result=await ctx.db.from('saved_posts').upsert({user_id:ctx.userId,post_id:input.postId},{onConflict:'user_id,post_id',ignoreDuplicates:true});
 return result.error?reply({error:'SAVED_NOT_SAVED'},503):reply({saved:true});
}
export async function DELETE(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const id=new URL(request.url).searchParams.get('postId');if(!validUUID(id))return reply({error:'INVALID_POST_ID'},400);
 const result=await ctx.db.from('saved_posts').delete().eq('user_id',ctx.userId).eq('post_id',id);
 return result.error?reply({error:'SAVED_NOT_REMOVED'},503):reply({saved:false});
}
