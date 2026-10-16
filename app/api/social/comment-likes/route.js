import { NextResponse } from 'next/server';
import { socialContext } from '../auth.mjs';
import { validUUID } from '../validation.mjs';
export const dynamic = 'force-dynamic';
const reply = (body, status=200) => NextResponse.json(body, {status,headers:{'Cache-Control':'no-store'}});
export async function GET(request) {
  const ctx = await socialContext(request);
  if (ctx.error) return reply({error:ctx.error},ctx.status);
  const commentId = new URL(request.url).searchParams.get('commentId');
  if (!validUUID(commentId)) return reply({error:'INVALID_COMMENT_ID'},400);
  const {data: post, error: postError} = await ctx.db.from('comments').select('id').eq('id',commentId).maybeSingle();
  if (postError) return reply({error:'LIKES_UNAVAILABLE'},503);
  if (!post) return reply({error:'COMMENT_NOT_FOUND'},404);
  const {count, error: countError} = await ctx.db.from('comment_likes').select('comment_id',{count:'exact',head:true}).eq('comment_id',commentId);
  if (countError) return reply({error:'LIKES_UNAVAILABLE'},503);
  const {data: own, error: ownError} = await ctx.db.from('comment_likes').select('comment_id').eq('comment_id',commentId).eq('user_id',ctx.userId).maybeSingle();
  if (ownError) return reply({error:'LIKES_UNAVAILABLE'},503);
  return reply({commentId,count:count ?? 0,liked:Boolean(own)});
}
export async function POST(request) {
  const ctx = await socialContext(request);
  if (ctx.error) return reply({error:ctx.error},ctx.status);
  let input;
  try { input=await request.json(); } catch { return reply({error:'INVALID_JSON'},400); }
  if (!input || !validUUID(input.commentId)) return reply({error:'INVALID_COMMENT_ID'},400);
  const {data:post,error:postError} = await ctx.db.from('comments').select('id').eq('id',input.commentId).maybeSingle();
  if (postError) return reply({error:'LIKES_UNAVAILABLE'},503);
  if (!post) return reply({error:'COMMENT_NOT_FOUND'},404);
  const {error} = await ctx.db.from('comment_likes').upsert({comment_id:input.commentId,user_id:ctx.userId},{onConflict:'comment_id,user_id',ignoreDuplicates:true});
  return error ? reply({error:'LIKE_NOT_SAVED'},503) : reply({liked:true});
}
export async function DELETE(request) {
  const ctx = await socialContext(request);
  if (ctx.error) return reply({error:ctx.error},ctx.status);
  const commentId=new URL(request.url).searchParams.get('commentId');
  if (!validUUID(commentId)) return reply({error:'INVALID_COMMENT_ID'},400);
  const {error} = await ctx.db.from('comment_likes').delete().eq('comment_id',commentId).eq('user_id',ctx.userId);
  return error ? reply({error:'LIKE_NOT_REMOVED'},503) : reply({liked:false});
}
