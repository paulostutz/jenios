import { createClient } from '@supabase/supabase-js';
import { requirePayToken, requirePayUser } from '../../../../lib/pay/auth.mjs';
import { boostUuid } from '../../../../lib/social/boost.mjs';
import { POST_FIELDS, publicPost } from '../../../../lib/social/schema.mjs';
import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const token = requirePayToken(request), params=new URL(request.url).searchParams;
    let id=params.get('id');const handle=params.get('handle')?.replace(/^@/,'');
    if (id ? !boostUuid(id) : !/^[a-zA-Z0-9_.]{3,30}$/.test(handle||'')) throw Object.assign(new Error('Perfil inválido.'), { status: 400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw Object.assign(new Error('Conexão não configurada.'), { status: 503 });
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: 'Bearer ' + token } } });
    const user = await requirePayUser(request, db);
    if(!id){const found=await db.from('profiles').select('id').eq('handle',handle).maybeSingle();if(found.error||!found.data)throw Object.assign(new Error('Perfil não disponível.'),{status:404});id=found.data.id;}
    const blocks = await getJeniosPayAdmin().from('user_blocks').select('blocker_id').or(`and(blocker_id.eq.${user.id},blocked_id.eq.${id}),and(blocker_id.eq.${id},blocked_id.eq.${user.id})`).limit(1);
    if (blocks.error) throw blocks.error;
    if (blocks.data?.length) throw Object.assign(new Error('Perfil não disponível.'), { status: 404 });
    const profile = await db.from('profiles').select('id,handle,display_name,bio,cargo,avatar_url,website').eq('id', id).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) throw Object.assign(new Error('Perfil não disponível.'), { status: 404 });
    const offset=Number(params.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)throw Object.assign(new Error('Página inválida.'),{status:400});
    const posts = await db.from('posts').select(POST_FIELDS,{count:'exact'}).eq('author_id', id).is('archived_at',null).order('created_at', { ascending: false }).order('id',{ascending:false}).range(offset,offset+19);
    if (posts.error) throw posts.error;
    return Response.json({ profile: profile.data, posts: (posts.data || []).map(publicPost), postsCount:posts.count||0,nextOffset:posts.data?.length===20?offset+20:null }, { headers });
  } catch (error) { return Response.json({ error: error.status ? error.message : 'Não foi possível consultar o perfil.' }, { status: error.status || 503, headers }); }
}
