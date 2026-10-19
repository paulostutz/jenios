import { createClient } from '@supabase/supabase-js';

/** Banco dedicado da Platform. Nunca usa chaves da Social ou JENIOS PAY. */
export function getJeniosPlatformAdmin(env=process.env){
 const url=env.PLATFORM_SUPABASE_URL;
 const key=env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Object.assign(new Error('Banco exclusivo da JENIOS Platform ainda não configurado.'),{status:503});
 try{
   const parsed=new URL(url);
   if(parsed.protocol!=='https:'||!parsed.hostname)
     throw Error('INVALID_PLATFORM_DB_URL');
 }catch{
   throw Object.assign(new Error('Configuração do banco da Platform inválida.'),{status:503});
 }
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
