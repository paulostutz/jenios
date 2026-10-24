'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {supabase as socialSupabase} from '../../../lib/supabase';
import {createPlatformAdminSession} from '../../../lib/platform/admin-session.mjs';
/**
 * Dedicated Platform sessions retain their original API behavior.
 * Social Masters may only use two read-only, backend-gated ADMIN aggregation endpoints.
 * No Social token is ever forwarded to a dedicated Platform authentication route.
 */
const adminSession=createPlatformAdminSession({platformAuth:platformSupabase?.auth,socialAuth:socialSupabase?.auth});
export async function platformAdminFetch(url,options={}){
 return adminSession.fetch(url,options);
}
export default function PlatformAdminAccess({permission='platform.admin',children}){
 const [permissions,setPermissions]=useState(null),[error,setError]=useState('');
 useEffect(()=>adminSession.observe(state=>{
  setPermissions(state.permissions);setError(state.error);
 }),[]);
 if(permissions===null)return <main style={{minHeight:'70vh',display:'grid',placeItems:'center',padding:24,background:'#0f172a',color:'white',fontFamily:'system-ui'}}>
  <section role="status" style={{textAlign:'center'}}>{error||'Verificando permissões da Platform…'}
   <p><Link href="/platform/entrar" style={{color:'#c4b5fd'}}>Entrar na Platform</Link></p>
  </section></main>;
 const allowed=Array.isArray(permission)?permission.some(p=>permissions.includes(p)):permissions.includes(permission);
 if(!allowed)return <main style={{minHeight:'70vh',display:'grid',placeItems:'center',padding:24,background:'#0f172a',color:'white',fontFamily:'system-ui'}}>
  <section role="alert" style={{maxWidth:440,textAlign:'center'}}>Sua conta não possui permissão administrativa da JENIOS Platform.
   <p><Link href="/dashboard-logado" style={{color:'#c4b5fd'}}>Voltar à área do cliente</Link></p>
  </section></main>;
 return typeof children==='function'?children(permissions):children;
}
