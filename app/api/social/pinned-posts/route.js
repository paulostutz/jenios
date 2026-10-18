import {socialContext} from '../auth.mjs';
import {validUUID} from '../validation.mjs';
import {POST_FIELDS,publicPost} from '../../../../lib/social/schema.mjs';

export const dynamic='force-dynamic';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const pinnedFields='post_id,owner_id,pinned_at';
const publicPinned=post=>({...publicPost(post),archived:Boolean(post.archived_at)});

export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const ownerId=new URL(request.url).searchParams.get('ownerId')||ctx.userId;
 if(!validUUID(ownerId))return reply({error:'INVALID_OWNER'},400);
 const list=await ctx.db.from('social_pinned_posts').select(pinnedFields)
  .eq('owner_id',ownerId).order('pinned_at',{ascending:false}).order('post_id',{ascending:true}).limit(3);
 if(list.error)return reply({error:'PINS_UNAVAILABLE'},503);
 const pins=list.data||[];
 if(!pins.length)return reply({posts:[]});
 const source=await ctx.db.from('posts').select(POST_FIELDS)
  .eq('author_id',ownerId).in('id',pins.map(p=>p.post_id));
 if(source.error)return reply({error:'POSTS_UNAVAILABLE'},503);
 const byId=new Map((source.data||[]).map(p=>[p.id,p]));
 const isOwner=ownerId===ctx.userId;
 const posts=pins.flatMap(p=>{
  const original=byId.get(p.post_id);
  if(!original||(!isOwner&&original.archived_at))return [];
  return [{...publicPinned(original),pinned_at:p.pinned_at}];
 });
 return reply({posts});
}

export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let input;try{input=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 const postId=typeof input?.postId==='string'?input.postId:'';
 if(!validUUID(postId))return reply({error:'INVALID_POST_ID'},400);
 const owner=await ctx.db.from('posts').select('id').eq('id',postId)
  .eq('author_id',ctx.userId).is('archived_at',null).maybeSingle();
 if(owner.error)return reply({error:'POSTS_UNAVAILABLE'},503);
 if(!owner.data)return reply({error:'POST_NOT_OWNED_OR_ARCHIVED'},403);
 const current=await ctx.db.from('social_pinned_posts').select('post_id',{count:'exact',head:true})
  .eq('owner_id',ctx.userId);
 if(current.error)return reply({error:'PINS_UNAVAILABLE'},503);
 if((current.count||0)>=3)return reply({error:'PIN_LIMIT'},409);
 const result=await ctx.db.from('social_pinned_posts')
  .insert({post_id:postId,owner_id:ctx.userId}).select(pinnedFields).single();
 if(result.error){
  if(result.error.code==='23505')return reply({error:'POST_ALREADY_PINNED'},409);
  if(result.error.code==='23514')return reply({error:'PIN_LIMIT'},409);
  if(result.error.code==='42501')return reply({error:'POST_NOT_OWNED_OR_ARCHIVED'},403);
  return reply({error:'PIN_NOT_SAVED'},503);
 }
 return reply({pin:result.data},201);
}

export async function DELETE(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const postId=new URL(request.url).searchParams.get('postId');
 if(!validUUID(postId))return reply({error:'INVALID_POST_ID'},400);
 const result=await ctx.db.from('social_pinned_posts').delete()
  .eq('post_id',postId).eq('owner_id',ctx.userId).select('post_id').maybeSingle();
 if(result.error)return reply({error:'PIN_NOT_REMOVED'},503);
 return result.data?reply({deleted:true}):reply({error:'PIN_NOT_FOUND'},404);
}
