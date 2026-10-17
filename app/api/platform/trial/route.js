import {createClient} from '@supabase/supabase-js';
import {socialContext} from '../../social/auth.mjs';
import {trialRequest,trialStatus} from '../../../../lib/platform/trial/trial-http.mjs';
import {verifyIdentityWithProvider} from '../../../../lib/platform/trial/verified-person-provider.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const enabled=()=>process.env.JENIOS_TRIAL_ENABLED==='true'&&process.env.JENIOS_TRIAL_ACTIVATION_APPROVED==='true';
function context(request){return socialContext(request);}
function admin(){
 const url=process.env.SOCIAL_SUPABASE_URL;
 const key=process.env.SOCIAL_SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return null;
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function POST(request){
 const ready=enabled();
 if(!ready)return trialRequest(request,{enabled:false});
 return trialRequest(request,{enabled:true,context,db:admin(),secret:process.env.JENIOS_TRIAL_SUBJECT_HMAC_KEY,
  verifyIdentity:params=>verifyIdentityWithProvider(params,{endpoint:process.env.JENIOS_TRIAL_IDENTITY_VERIFY_URL,apiKey:process.env.JENIOS_TRIAL_IDENTITY_API_KEY})});
}
export async function GET(request){
 const ready=enabled();
 if(!ready)return trialStatus(request,{enabled:false});
 return trialStatus(request,{enabled:true,context,db:admin()});
}
