import {createClient} from '@supabase/supabase-js';

/**
 * Supabase exclusivo da JENIOS Platform.
 * NUNCA cair para variáveis NEXT_PUBLIC_SUPABASE_* utilizadas pela Social.
 * Somente chave publicável no navegador. Service role fica no servidor.
 */
const url=process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL;
const publishableKey=process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY;

export const platformSupabase=url && publishableKey
 ? createClient(url,publishableKey,{
   auth:{
     storageKey:'jenios-platform-auth-v1',
     persistSession:true,
     autoRefreshToken:true,
     detectSessionInUrl:true
   }
 })
 : null;

export function isPlatformClientConfigured(){
 return Boolean(platformSupabase);
}
