'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
export async function adminFetch(url,options={}){
 if(!supabase?.auth)throw Error('Autenticação não configurada.');
 const {data,error}=await supabase.auth.getSession();if(error||!data.session||data.session.user.is_anonymous)throw Error('Entre com sua conta de administrador.');
 const response=await fetch(url,{...options,cache:'no-store',headers:{...options.headers,authorization:'Bearer '+data.session.access_token,'content-type':'application/json'}});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error||'Não foi possível concluir a operação.');}return response;
}
export default function AdminAccess({permission,children,loginRedirect='/login?next=/admin/consultas'}){
 const [permissions,setPermissions]=useState(null),[error,setError]=useState(''),epoch=useRef(0);
 useEffect(()=>{let live=true;
 async function load(){const rev=++epoch.current;setPermissions(null);try{const data=await(await adminFetch('/api/admin/access')).json();if(live&&rev===epoch.current){setPermissions(data.isMaster===true&&Array.isArray(data.permissions)?data.permissions:[]);setError('');}}catch(e){if(live&&rev===epoch.current)setError(e.message);}}
 void load();const sub=supabase?.auth.onAuthStateChange(event=>{if(!['INITIAL_SESSION','TOKEN_REFRESHED'].includes(event)){epoch.current++;setPermissions(null);setTimeout(load,0);}});
 return()=>{live=false;epoch.current++;sub?.data?.subscription?.unsubscribe();};
 },[]);
 if(!permissions)return <main style={{minHeight:'70vh',display:'grid',placeItems:'center',padding:24,background:'#0f172a',color:'#f8fafc',fontFamily:'system-ui'}}>
  <section role="status" style={{maxWidth:440,textAlign:'center',lineHeight:1.6}}>{error||'Verificando acesso…'}
   {error&&<p><Link href={loginRedirect} style={{color:'#c4b5fd'}}>Entrar</Link></p>}
  </section></main>;
 if(!permissions.length||!(Array.isArray(permission)?permission.some(p=>permissions.includes(p)):permissions.includes(permission)))return <main style={{minHeight:'70vh',display:'grid',placeItems:'center',padding:24,background:'#0f172a',color:'#f8fafc',fontFamily:'system-ui'}}>
  <section role="alert" style={{maxWidth:440,textAlign:'center',lineHeight:1.6}}>A Central Administrativa é exclusiva do usuário Master.
   <p><Link href="/social" style={{color:'#c4b5fd'}}>Voltar à Social</Link></p>
  </section></main>;
 return typeof children==='function'?children(permissions):children;
}
