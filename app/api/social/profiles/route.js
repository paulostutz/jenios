import { createClient } from '@supabase/supabase-js';
import { requirePayToken, requirePayUser } from '../../../../lib/pay/auth.mjs';
import { boostUuid } from '../../../../lib/social/boost.mjs';
import { POST_FIELDS, publicPost } from '../../../../lib/social/schema.mjs';
import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const token = requirePayToken(request), id = new URL(request.url).searchParams.get('id');
    if (!boostUuid(id)) throw Object.assign(new Error('Perfil inválido.'), { status: 400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw Object.assign(new Error('Conexão não configurada.'), { status: 503 });
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: 'Bearer ' + token } } });
    const user = await requirePayUser(request, db);
    const blocks = await getJeniosPayAdmin().from('user_blocks').select('blocker_id').or(`and(blocker_id.eq.${user.id},blocked_id.eq.${id}),and(blocker_id.eq.${id},blocked_id.eq.${user.id})`).limit(1);
    if (blocks.error) throw blocks.error;
    if (blocks.data?.length) throw Object.assign(new Error('Perfil não disponível.'), { status: 404 });
    const profile = await db.from('profiles').select('id,handle,display_name,bio,avatar_url,website').eq('id', id).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) throw Object.assign(new Error('Perfil não disponível.'), { status: 404 });
    const posts = await db.from('posts').select(POST_FIELDS).eq('author_id', id).order('created_at', { ascending: false }).limit(20);
    if (posts.error) throw posts.error;
    return Response.json({ profile: profile.data, posts: (posts.data || []).map(publicPost) }, { headers });
  } catch (error) { return Response.json({ error: error.status ? error.message : 'Não foi possível consultar o perfil.' }, { status: error.status || 503, headers }); }
}
