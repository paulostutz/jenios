'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
export async function adminFetch(url,options={}){
 const {data,error}=await supabase.auth.getSession();if(error||!data.session||data.session.user.is_anonymous)throw Error('Entre com sua conta de administrador.');
 const response=await fetch(url,{...options,cache:'no-store',headers:{...options.headers,authorization:'Bearer '+data.session.access_token,'content-type':'application/json'}});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error||'Não foi possível concluir a operação.');}return response;
}
export default function AdminAccess({permission,children}){
 const [permissions,setPermissions]=useState(null),[error,setError]=useState(''),epoch=useRef(0);
 useEffect(()=>{let live=true;
 async function load(){const rev=++epoch.current;setPermissions(null);try{const data=await(await adminFetch('/api/admin/access')).json();if(live&&rev===epoch.current){setPermissions(data.permissions);setError('');}}catch(e){if(live&&rev===epoch.current)setError(e.message);}}
 void load();const sub=supabase?.auth.onAuthStateChange(event=>{if(!['INITIAL_SESSION','TOKEN_REFRESHED'].includes(event)){epoch.current++;setPermissions(null);setTimeout(load,0);}});
 return()=>{live=false;epoch.current++;sub?.data?.subscription?.unsubscribe();};
 },[]);
 if(!permissions)return <p role="status">{error||'Verificando acesso…'} {error&&<Link href="/login?next=/admin/consultas">Entrar</Link>}</p>;
 if(!permissions.includes(permission))return <p role="alert">Sua conta precisa de autorização para acessar esta área.</p>;
 return typeof children==='function'?children(permissions):children;
}
