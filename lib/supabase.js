import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// A pending operation must never acquire the next account's token.
export function accountDatabase(owner) {
  if (!supabase || !owner) throw new Error('Entre novamente na sua conta.');
  return createClient(supabaseUrl, supabaseKey, {accessToken: async () => {
    const result = await supabase.auth.getSession();
    const session = result.data?.session;
    if (result.error || !session || session.user.id !== owner || session.user.is_anonymous) {
      throw new Error('Sua sessão mudou. Entre novamente.');
    }
    return session.access_token;
  }});
}
