import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validatePostPayload } from "../../../../lib/social/post-validation.mjs";
import { paginatePosts } from "../../../../lib/social/feed-pagination.mjs";
import { POST_FIELDS, publicPost, storedMedia } from '../../../../lib/social/schema.mjs';

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
function reply(body, status = 200) { return NextResponse.json(body, { status, headers: noStore }); }
async function authenticated(request) {
  const url = process.env.SOCIAL_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SOCIAL_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return { error: reply({ error: "AUTH_REQUIRED" }, 401) };
  if (!url || !anon) return { error: reply({ error: "SOCIAL_NOT_CONFIGURED" }, 503) };
  const token = match[1];
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user?.id || data.user.is_anonymous) return { error: reply({ error: "INVALID_SESSION" }, 401) };
  return { db, userId: data.user.id };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(request) {
  const ctx = await authenticated(request);
  if (ctx.error) return ctx.error;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id !== null) {
    if (!uuid.test(id)) return reply({error:'INVALID_POST_ID'},400);
    const {data,error} = await ctx.db.from('posts').select(POST_FIELDS).eq('id',id).maybeSingle();
    if (error) return reply({error:'FEED_UNAVAILABLE'},503);
    return data ? reply({post:publicPost(data)}) : reply({error:'POST_NOT_FOUND'},404);
  }
  const raw = Number(url.searchParams.get("limit") || 20);
  if (!Number.isInteger(raw) || raw < 1 || raw > 50) return reply({ error: "INVALID_LIMIT" }, 400);
  const before = url.searchParams.get("before");
  const beforeId = url.searchParams.get("beforeId");
  if ((before === null) !== (beforeId === null) || (beforeId !== null && !uuid.test(beforeId)) || (before !== null && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(before) || !Number.isFinite(Date.parse(before))))) return reply({ error: "INVALID_CURSOR" }, 400);
  let query = ctx.db.from("posts")
    .select(POST_FIELDS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(raw + 1);
  if (before) query = query.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`);
  const { data, error } = await query;
  if (error) return reply({ error: "FEED_UNAVAILABLE" }, 503);
  return reply(paginatePosts((data || []).map(publicPost), raw));
}
export async function POST(request) {
  const ctx = await authenticated(request);
  if (ctx.error) return ctx.error;
  let payload;
  try { payload = await request.json(); } catch { return reply({ error: "INVALID_JSON" }, 400); }
  const validationError = validatePostPayload(payload);
  if (validationError) return reply({ error: validationError }, 400);
  const body = payload.body ?? "";
  const media = payload.media ?? [];
  const { data, error } = await ctx.db.from("posts")
    .insert({ author_id: ctx.userId, body: body.trim(), ...storedMedia(media) })
    .select(POST_FIELDS).single();
  if (error) return reply({ error: "POST_NOT_SAVED" }, 503);
  return reply({ post: publicPost(data) }, 201);
}
export async function DELETE(request) {
  const ctx = await authenticated(request);
  if (ctx.error) return ctx.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!uuid.test(id || "")) return reply({ error: "INVALID_POST_ID" }, 400);
  const { data, error } = await ctx.db.from("posts")
    .delete()
    .eq("id", id).eq("author_id", ctx.userId)
    .select("id").maybeSingle();
  if (error) return reply({ error: "POST_NOT_REMOVED" }, 503);
  if (!data) return reply({ error: "POST_NOT_FOUND" }, 404);
  return reply({ deleted: true });
}
