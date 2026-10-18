import { createClient } from '@supabase/supabase-js';
import { handleAvailabilityRequest } from '../../../../lib/social/handle-server.mjs';
export const dynamic='force-dynamic';
export async function GET(request){
 return handleAvailabilityRequest(request,{database:()=>{
  const url=process.env.SOCIAL_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SOCIAL_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
 }});
}
