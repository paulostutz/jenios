import { createClient } from '@supabase/supabase-js';
import { getJeniosPayAdmin } from './jenios-pay-admin';
import { requirePayToken, requirePayUser } from './pay/auth.mjs';
import { boostEnabled } from './social/boost.mjs';
import { assertBoostSigningConfig } from './social/boost-proof.mjs';

export const boostHeaders = { 'Cache-Control': 'no-store' };
export async function boostContext(request, viewer = false) {
  const token = requirePayToken(request);
  const db = getJeniosPayAdmin(), user = await requirePayUser(request, db);
  if (!boostEnabled()) throw Object.assign(new Error('As campanhas aguardam instalação e ativação em homologação.'), { status: 503 });
  assertBoostSigningConfig();
  let viewerDb;
  if (viewer) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw Object.assign(new Error('Feed não configurado.'), { status: 503 });
    viewerDb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: 'Bearer ' + token } } });
  }
  return { db, user, viewerDb };
}
export async function boostBody(request) {
  try { const body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error(); return body; }
  catch { throw Object.assign(new Error('Requisição inválida.'), { status: 400 }); }
}
export function boostFailure(error) { return Response.json({ error: error.status ? error.message : 'Não foi possível concluir a operação da campanha.' }, { status: error.status || 503, headers: boostHeaders }); }
