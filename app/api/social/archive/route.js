import {socialContext} from '../auth.mjs';
import {validUUID} from '../validation.mjs';
import {POST_FIELDS,publicPost} from '../../../../lib/social/schema.mjs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const offset=Number(new URL(request.url).searchParams.get('offset')||0);
 if(!Number.isSafeInteger(offset)||offset<0)return reply({error:'INVALID_OFFSET'},400);
 const {data,error}=await ctx.db.from('posts').select(POST_FIELDS).eq('author_id',ctx.userId).not('archived_at','is',null).order('archived_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+19);
 return error?reply({error:'ARCHIVE_UNAVAILABLE'},503):reply({posts:(data||[]).map(publicPost),nextOffset:data?.length===20?offset+20:null});
}
export async function PATCH(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let input;try{input=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 if(!validUUID(input?.postId)||typeof input.archived!=='boolean')return reply({error:'INVALID_ARCHIVE_REQUEST'},400);
 const {data,error}=await ctx.db.from('posts').update({archived_at:input.archived?new Date().toISOString():null}).eq('id',input.postId).eq('author_id',ctx.userId).select(POST_FIELDS).maybeSingle();
 if(error)return reply({error:'ARCHIVE_NOT_UPDATED'},503);
 if(!data)return reply({error:'POST_NOT_FOUND'},404);
 return reply({post:publicPost(data)});
}
