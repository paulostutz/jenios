import {socialContext} from '../auth.mjs';
import {validUUID} from '../validation.mjs';
export const dynamic='force-dynamic';
const fields='id,author_id,media_type,media_path,created_at,expires_at';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const offset=Number(new URL(request.url).searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)return reply({error:'INVALID_OFFSET'},400);
 const result=await ctx.db.from('stories').select(fields).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+49);
 return result.error?reply({error:'STORIES_UNAVAILABLE'},503):reply({stories:result.data||[],nextOffset:result.data?.length===50?offset+50:null});
}
export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let input;try{input=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
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
