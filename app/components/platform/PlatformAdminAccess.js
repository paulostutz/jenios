'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';
export async function platformAdminFetch(url,options={}){
 if(!platformSupabase?.auth)throw Error('Acesso exclusivo da Platform não configurado.');
 const {data,error}=await platformSupabase.auth.getSession();
 if(error||!data?.session?.access_token||data.session.user?.is_anonymous)
  throw Error('Entre em sua conta da Platform.');
 const response=await fetch(url,{...options,cache:'no-store',
   headers:{...options.headers,authorization:'Bearer '+data.session.access_token}});
 if(!response.ok){const body=await response.json().catch(()=>({}));
   throw Error(body.error||'Não foi possível validar o acesso.');}
 return response;
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
  const sub=platformSupabase?.auth?.onAuthStateChange(event=>{
   if(event==='TOKEN_REFRESHED')return;
   seq.current++;setPermissions(null);
   Promise.resolve().then(()=>{if(live)void load();});
  });
  return()=>{live=false;seq.current++;sub?.data?.subscription?.unsubscribe?.();};
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
