import { createClient } from '@supabase/supabase-js';
export async function socialContext(request) {
  const url = process.env.SOCIAL_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SOCIAL_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return { error: 'AUTH_REQUIRED', status: 401 };
  if (!url || !key) return { error: 'SOCIAL_NOT_CONFIGURED', status: 503 };
  const token = match[1];
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user?.id || data.user.is_anonymous) return { error: 'INVALID_SESSION', status: 401 };
  return { db, userId: data.user.id };
}
