import {socialContext} from '../auth.mjs';
import {POST_FIELDS,publicPost} from '../../../../lib/social/schema.mjs';
import {validUUID} from '../validation.mjs';
export const dynamic='force-dynamic';
const fields='id,author_id,media_type,media_path,created_at,expires_at,shared_post_id';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const offset=Number(new URL(request.url).searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)return reply({error:'INVALID_OFFSET'},400);
 const result=await ctx.db.from('stories').select(fields).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+49);
 if(result.error)return reply({error:'STORIES_UNAVAILABLE'},503);
 const rows=result.data||[],ids=[...new Set(rows.map(x=>x.shared_post_id).filter(Boolean))];
 let shared=new Map();
 if(ids.length){
   const posts=await ctx.db.from('posts').select(POST_FIELDS).in('id',ids);
   if(posts.error)return reply({error:'STORIES_UNAVAILABLE'},503);
   const authors=[...new Set(posts.data.map(x=>x.author_id))];
   const profiles=authors.length?await ctx.db.from('profiles').select('id,handle,display_name,avatar_url').in('id',authors):{data:[]};
   if(profiles.error)return reply({error:'STORIES_UNAVAILABLE'},503);
   const byAuthor=new Map(profiles.data.map(x=>[x.id,x]));
   shared=new Map(posts.data.map(x=>[x.id,{...publicPost(x),profile:byAuthor.get(x.author_id)}]));
 }
 return reply({stories:rows.filter(x=>!x.shared_post_id||shared.has(x.shared_post_id)).map(x=>({...x,sharedPost:shared.get(x.shared_post_id)||null})),nextOffset:rows.length===50?offset+50:null});
}
export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let input;try{input=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 if(input?.postId){
   if(!validUUID(input.postId))return reply({error:'INVALID_POST_ID'},400);
   const post=await ctx.db.from('posts').select('id').eq('id',input.postId).maybeSingle();
   if(post.error)return reply({error:'STORIES_UNAVAILABLE'},503);
   if(!post.data)return reply({error:'POST_NOT_FOUND'},404);
   const result=await ctx.db.from('stories').insert({author_id:ctx.userId,media_type:'post',media_path:null,shared_post_id:post.data.id}).select(fields).single();
   return result.error?reply({error:'STORY_NOT_SAVED'},503):reply({story:result.data},201);
 }
 if(!['image','video'].includes(input?.type))return reply({error:'INVALID_MEDIA'},400);
 // Only a file in this account's public Social bucket can become a Story.
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'')+'/storage/v1/object/public/'+(process.env.SOCIAL_MEDIA_BUCKET||'social-media')+'/'+ctx.userId+'/';
 if(typeof input.url!=='string'||!input.url.startsWith(base)||!(/^[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm|mov)$/i.test(input.url.slice(base.length))))return reply({error:'INVALID_MEDIA'},400);
 if((/\.(mp4|webm|mov)$/i.test(input.url))!==(input.type==='video'))return reply({error:'INVALID_MEDIA'},400);
 const result=await ctx.db.from('stories').insert({author_id:ctx.userId,media_type:input.type,media_path:input.url}).select(fields).single();
 return result.error?reply({error:'STORY_NOT_SAVED'},503):reply({story:result.data},201);
}
export async function DELETE(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const id=new URL(request.url).searchParams.get('id');if(!validUUID(id))return reply({error:'INVALID_STORY'},400);
 const result=await ctx.db.from('stories').delete().eq('id',id).eq('author_id',ctx.userId);
 return result.error?reply({error:'STORY_NOT_REMOVED'},503):reply({deleted:true});
}
