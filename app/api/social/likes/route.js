import { NextResponse } from 'next/server';
import { socialContext } from '../auth.mjs';
import { validUUID } from '../validation.mjs';
export const dynamic = 'force-dynamic';
const reply = (body, status=200) => NextResponse.json(body, {status,headers:{'Cache-Control':'no-store'}});
export async function GET(request) {
  const ctx = await socialContext(request);
  if (ctx.error) return reply({error:ctx.error},ctx.status);
  const postId = new URL(request.url).searchParams.get('postId');
  if (!validUUID(postId)) return reply({error:'INVALID_POST_ID'},400);
  const {data: post, error: postError} = await ctx.db.from('jenios_social_posts').select('id').eq('id',postId).is('deleted_at',null).maybeSingle();
  if (postError) return reply({error:'LIKES_UNAVAILABLE'},503);
  if (!post) return reply({error:'POST_NOT_FOUND'},404);
  const {count, error: countError} = await ctx.db.from('jenios_social_likes').select('post_id',{count:'exact',head:true}).eq('post_id',postId);
  if (countError) return reply({error:'LIKES_UNAVAILABLE'},503);
  const {data: own, error: ownError} = await ctx.db.from('jenios_social_likes').select('post_id').eq('post_id',postId).eq('user_id',ctx.userId).maybeSingle();
  if (ownError) return reply({error:'LIKES_UNAVAILABLE'},503);
  return reply({postId,count:count ?? 0,liked:Boolean(own)});
}
export async function POST(request) {
  const ctx = await socialContext(request);
  if (ctx.error) return reply({error:ctx.error},ctx.status);
  let input;
  try { input=await request.json(); } catch { return reply({error:'INVALID_JSON'},400); }
  if (!input || !validUUID(input.postId)) return reply({error:'INVALID_POST_ID'},400);
  const {data:post,error:postError} = await ctx.db.from('jenios_social_posts').select('id').eq('id',input.postId).is('deleted_at',null).maybeSingle();
  if (postError) return reply({error:'LIKES_UNAVAILABLE'},503);
  if (!post) return reply({error:'POST_NOT_FOUND'},404);
  const {error} = await ctx.db.from('jenios_social_likes').upsert({post_id:input.postId,user_id:ctx.userId},{onConflict:'post_id,user_id',ignoreDuplicates:true});
  return error ? reply({error:'LIKE_NOT_SAVED'},503) : reply({liked:true});
}
export async function DELETE(request) {
  const ctx = await socialContext(request);
  if (ctx.error) return reply({error:ctx.error},ctx.status);
  const postId=new URL(request.url).searchParams.get('postId');
  if (!validUUID(postId)) return reply({error:'INVALID_POST_ID'},400);
  const {error} = await ctx.db.from('jenios_social_likes').delete().eq('post_id',postId).eq('user_id',ctx.userId);
  return error ? reply({error:'LIKE_NOT_REMOVED'},503) : reply({liked:false});
}
