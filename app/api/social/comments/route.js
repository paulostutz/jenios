import { NextResponse } from 'next/server';
import { socialContext } from '../auth.mjs';
import { validUUID } from '../validation.mjs';
export const dynamic = 'force-dynamic';
const reply = (body, status=200) => NextResponse.json(body, {status, headers:{'Cache-Control':'no-store'}});
export async function GET(request) {
  const ctx = await socialContext(request);
  if (ctx.error) return reply({error:ctx.error},ctx.status);
  const postId = new URL(request.url).searchParams.get('postId');
  if (!validUUID(postId)) return reply({error:'INVALID_POST_ID'},400);
  const {data:post,error:postError} = await ctx.db.from('jenios_social_posts').select('id').eq('id',postId).is('deleted_at',null).maybeSingle();
  if (postError) return reply({error:'COMMENTS_UNAVAILABLE'},503);
  if (!post) return reply({error:'POST_NOT_FOUND'},404);
  const {data,error} = await ctx.db.from('jenios_social_comments').select('id,post_id,author_id,parent_id,body,created_at').eq('post_id',postId).order('created_at',{ascending:true}).limit(100);
  return error ? reply({error:'COMMENTS_UNAVAILABLE'},503) : reply({comments:data || []});
}
export async function POST(request) {
  const ctx = await socialContext(request);
  if (ctx.error) return reply({error:ctx.error},ctx.status);
  let input;
  try { input = await request.json(); } catch { return reply({error:'INVALID_JSON'},400); }
  if (!input || !validUUID(input.postId) || (input.parentId != null && !validUUID(input.parentId)) || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 2000) return reply({error:'INVALID_COMMENT'},400);
  const {data:post,error:postError} = await ctx.db.from('jenios_social_posts').select('id').eq('id',input.postId).is('deleted_at',null).maybeSingle();
  if (postError) return reply({error:'COMMENTS_UNAVAILABLE'},503);
  if (!post) return reply({error:'POST_NOT_FOUND'},404);
  if (input.parentId) {
    const {data:parent,error:parentError} = await ctx.db.from('jenios_social_comments').select('id,post_id,parent_id').eq('id',input.parentId).maybeSingle();
    if (parentError) return reply({error:'COMMENTS_UNAVAILABLE'},503);
    if (!parent || parent.post_id !== input.postId) return reply({error:'PARENT_COMMENT_NOT_FOUND'},404);
    if (parent.parent_id) return reply({error:'NESTED_REPLY_NOT_ALLOWED'},400);
  }
  const {data,error} = await ctx.db.from('jenios_social_comments').insert({post_id:input.postId,author_id:ctx.userId,parent_id:input.parentId || null,body:input.body.trim()}).select('id,post_id,author_id,parent_id,body,created_at').single();
  return error ? reply({error:'COMMENT_NOT_SAVED'},503) : reply({comment:data},201);
}
export async function DELETE(request) {
  const ctx = await socialContext(request);
  if (ctx.error) return reply({error:ctx.error},ctx.status);
  const id = new URL(request.url).searchParams.get('id');
  if (!validUUID(id)) return reply({error:'INVALID_COMMENT_ID'},400);
  const {data,error} = await ctx.db.from('jenios_social_comments').delete().eq('id',id).eq('author_id',ctx.userId).select('id').maybeSingle();
  if (error) return reply({error:'COMMENT_NOT_REMOVED'},503);
  return data ? reply({deleted:true}) : reply({error:'COMMENT_NOT_FOUND'},404);
}
