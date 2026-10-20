'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';
/**
 * Dedicated Platform sessions retain their original API behavior.
 * Social Masters may only use two read-only, backend-gated ADMIN aggregation endpoints.
 * No Social token is ever forwarded to a dedicated Platform authentication route.
 */
export async function platformAdminFetch(url,options={}){
 let platformSession;
 try{const r=await platformSupabase?.auth?.getSession();if(!r?.error)platformSession=r?.data?.session;}catch{}
 if(platformSession?.access_token&&!platformSession.user?.is_anonymous){
  const response=await fetch(url,{...options,cache:'no-store',headers:{...options.headers,authorization:'Bearer '+platformSession.access_token}});
  if(response.ok)return response;
 }
 if(!['/api/platform/admin/access','/api/platform/admin/overview'].includes(url))
  throw Error('Acesso avançado disponível apenas com sessão administrativa exclusiva da Platform.');
 const socialClient=(await import('../../../lib/supabase')).supabase;
 const auth=await socialClient?.auth?.getSession(),socialSession=auth?.data?.session;
 if(auth?.error||!socialSession?.access_token||socialSession.user?.is_anonymous)
  throw Error('Entre com sua conta Master da JENIOS Social.');
 const headers={authorization:'Bearer '+socialSession.access_token};
 const check=await fetch('/api/admin/access',{cache:'no-store',headers});
 if(!check.ok)throw Error('Não foi possível verificar o Master.');
 const grants=await check.json();
 if(grants.isMaster!==true)throw Error('Apenas Masters podem acessar a gestão administrativa.');
 if(url==='/api/platform/admin/access')return Response.json({permissions:['platform.admin','platform.reports'],masterSource:'jenios_social_verified'});
 const resp=await fetch('/api/admin/ecosystem',{cache:'no-store',headers,signal:options.signal});
 if(!resp.ok)throw Error('Indicadores indisponíveis.');
 const body=await resp.json();
 if(body.status!=='ready'||body.source!=='platform_dedicated_database')throw Error('Banco exclusivo da Platform indisponível.');
 return Response.json({...body,verified:true,source:'platform_dedicated_database'});
}
export default function PlatformAdminAccess({permission='platform.admin',children}){
 const [permissions,setPermissions]=useState(null),[error,setError]=useState('');
 const seq=useRef(0);
 useEffect(()=>{
  let live=true;
  async function load(){
   const rev=++seq.current;setPermissions(null);setError('');
   try{const data=await(await platformAdminFetch('/api/platform/admin/access')).json();
     if(live&&rev===seq.current){
       setPermissions(Array.isArray(data.permissions)?data.permissions:[]);
     }
   }catch(e){if(live&&rev===seq.current)setError(e.message);}
  }
  void load();
  let pendingTimer=null;
  const sub=platformSupabase?.auth?.onAuthStateChange(event=>{
   if(event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION')return;
   seq.current++;setPermissions(null);
   clearTimeout(pendingTimer);
   pendingTimer=setTimeout(()=>{if(live)void load();},0);
  });
  return()=>{live=false;seq.current++;clearTimeout(pendingTimer);sub?.data?.subscription?.unsubscribe?.();};
 },[]);
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
