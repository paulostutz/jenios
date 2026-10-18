import {socialContext} from '../auth.mjs';
import {validUUID} from '../validation.mjs';

export const dynamic='force-dynamic';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const collectionFields='id,owner_id,title,created_at';
const itemFields='id,collection_id,owner_id,source_story_id,media_type,media_path,shared_post_id,created_at';
const readString=value=>typeof value==='string'?value:'';

async function requireOwner(ctx,collectionId){
 const r=await ctx.db.from('social_highlight_collections').select('id,owner_id')
  .eq('id',collectionId).eq('owner_id',ctx.userId).maybeSingle();
 if(r.error)return {error:reply({error:'HIGHLIGHTS_UNAVAILABLE'},503)};
 if(!r.data)return {error:reply({error:'COLLECTION_NOT_FOUND'},404)};
 return {collection:r.data};
}
export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const ownerId=new URL(request.url).searchParams.get('ownerId')||ctx.userId;
 if(!validUUID(ownerId))return reply({error:'INVALID_OWNER'},400);
 const result=await ctx.db.from('social_highlight_collections').select(collectionFields)
  .eq('owner_id',ownerId).order('created_at',{ascending:false}).limit(12);
 if(result.error)return reply({error:'HIGHLIGHTS_UNAVAILABLE'},503);
 const collections=result.data||[],ids=collections.map(c=>c.id);
 // Only the owner receives a selection list of their own Stories, including expired.
 // Highlights intentionally retain the original media beyond the normal 24h Story feed.
 let eligibleStories=[];
 if(ownerId===ctx.userId){
  const own=await ctx.db.rpc('social_my_story_archive_for_highlights_v1');
  if(own.error)return reply({error:'STORIES_UNAVAILABLE'},503);
  eligibleStories=own.data||[];
 }
 if(!ids.length)return reply({collections:[],items:[],eligibleStories});
 const items=await ctx.db.from('social_highlight_items').select(itemFields)
  .in('collection_id',ids).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(360);
 if(items.error)return reply({error:'HIGHLIGHTS_UNAVAILABLE'},503);
 return reply({collections,items:items.data||[],eligibleStories});
}
export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let input;try{input=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 if(input?.action==='createCollection'){
  const title=readString(input.title).trim();
  if(title.length<1||title.length>40)return reply({error:'INVALID_TITLE'},400);
  const count=await ctx.db.from('social_highlight_collections')
   .select('id',{count:'exact',head:true}).eq('owner_id',ctx.userId);
  if(count.error)return reply({error:'HIGHLIGHTS_UNAVAILABLE'},503);
  if((count.count||0)>=12)return reply({error:'COLLECTION_LIMIT'},409);
  const r=await ctx.db.from('social_highlight_collections').insert({owner_id:ctx.userId,title})
   .select(collectionFields).single();
  if(r.error)return reply({error:r.error.code==='23505'?'COLLECTION_TITLE_EXISTS':'HIGHLIGHTS_UNAVAILABLE'},
   r.error.code==='23505'?409:503);
  return reply({collection:r.data},201);
 }
 if(input?.action==='pinStory'){
  const collectionId=readString(input.collectionId),storyId=readString(input.storyId);
  if(!validUUID(collectionId)||!validUUID(storyId))return reply({error:'INVALID_ID'},400);
  const owner=await requireOwner(ctx,collectionId);if(owner.error)return owner.error;
  // The ordinary Stories SELECT intentionally hides expired rows after 24h.
  // Reuse the verified owner-only archive RPC; the INSERT trigger rechecks ownership.
  const archive=await ctx.db.rpc('social_my_story_archive_for_highlights_v1');
  if(archive.error)return reply({error:'STORIES_UNAVAILABLE'},503);
  if(!(archive.data||[]).some(story=>story.id===storyId&&story.author_id===ctx.userId))
   return reply({error:'STORY_NOT_OWNED_OR_UNAVAILABLE'},403);
  const count=await ctx.db.from('social_highlight_items').select('id',{count:'exact',head:true})
   .eq('collection_id',collectionId);
  if(count.error)return reply({error:'HIGHLIGHTS_UNAVAILABLE'},503);
  if((count.count||0)>=30)return reply({error:'HIGHLIGHT_ITEM_LIMIT'},409);
  // Private BEFORE INSERT trigger copies authentic source media; caller cannot forge it.
  const result=await ctx.db.from('social_highlight_items')
   .insert({collection_id:collectionId,owner_id:ctx.userId,source_story_id:storyId})
   .select(itemFields).single();
  if(result.error)return reply({error:result.error.code==='23505'?'STORY_ALREADY_HIGHLIGHTED':'HIGHLIGHTS_UNAVAILABLE'},result.error.code==='23505'?409:503);
  return reply({item:result.data},201);
 }
 return reply({error:'INVALID_ACTION'},400);
}
export async function DELETE(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const url=new URL(request.url),collectionId=url.searchParams.get('collectionId'),itemId=url.searchParams.get('itemId');
 if(Boolean(collectionId)===Boolean(itemId))return reply({error:'ONE_ID_REQUIRED'},400);
 if(itemId){
  if(!validUUID(itemId))return reply({error:'INVALID_ITEM_ID'},400);
  const result=await ctx.db.from('social_highlight_items').delete()
   .eq('id',itemId).eq('owner_id',ctx.userId).select('id').maybeSingle();
  if(result.error)return reply({error:'HIGHLIGHTS_UNAVAILABLE'},503);
  return result.data?reply({deleted:true}):reply({error:'ITEM_NOT_FOUND'},404);
 }
 if(!validUUID(collectionId))return reply({error:'INVALID_COLLECTION_ID'},400);
 const result=await ctx.db.from('social_highlight_collections').delete()
  .eq('id',collectionId).eq('owner_id',ctx.userId).select('id').maybeSingle();
 if(result.error)return reply({error:'HIGHLIGHTS_UNAVAILABLE'},503);
 return result.data?reply({deleted:true}):reply({error:'COLLECTION_NOT_FOUND'},404);
}
