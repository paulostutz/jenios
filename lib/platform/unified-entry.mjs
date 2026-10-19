/**
 * CP74 — Single entry for the simulated JENIOS control room.
 * A verified Social session may enter the simulation UI; it NEVER becomes
 * a credential, administrator, diagnostic or paid entitlement in the
 * dedicated Platform Supabase instance.
 */
import {supabase as socialClient} from '../supabase.js';
import {resolveSocialReportGate} from '../reports/social-report-gate.mjs';
import {loadAccountDiagnostic} from './diagnostic-client.mjs';

const socialId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function socialSimulationOwner(id){
 return typeof id==='string'&&socialId.test(id)?'social_'+id.toLowerCase():null;
}

/** Supabase getUser must be verified remotely and the database profile present. */
export async function resolveSocialPortalEntry(client=socialClient,gate=resolveSocialReportGate){
 if(!client?.auth?.getUser||!client?.from)return null;
 try{
  const result=await gate(client);
  if(result?.status!=='ready')return null;
  const {data,error}=await client.auth.getUser();
  const user=data?.user;
  const owner=socialSimulationOwner(result.userId);
  if(error||!owner||!user?.id||user.is_anonymous||user.id!==result.userId)return null;
  const label=String(user.user_metadata?.full_name||user.user_metadata?.name||
    user.email?.split('@')[0]||'Operador').slice(0,80);
  return {source:'social',userId:owner,authUserId:user.id,label};
 }catch{return null;}
}

/** Simulation-only fallback. Never claim a server-verified Platform diagnosis. */
export async function loadUnifiedSimulationDiagnostic(platformClient,platformLoader=loadAccountDiagnostic,socialResolver=resolveSocialPortalEntry){
 const social=await socialResolver();
 if(social)return {verified:false,completed:false,userId:social.userId,reason:'social_simulation_only'};
 return platformLoader(platformClient);
}
export function observeSocialPortalAuth(callback){
 return socialClient?.auth?.onAuthStateChange?.(callback);
}
