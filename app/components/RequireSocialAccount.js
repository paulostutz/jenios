"use client";
import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
export default function RequireSocialAccount({children}){
 const [state,setState]=useState('loading');
 useEffect(()=>{
  let active=true,revision=0;
  async function check(){const ticket=++revision;setState('loading');try{const result=await supabase?.auth.getUser();if(active&&ticket===revision)setState(!result?.error&&result?.data?.user?.id&&!result.data.user.is_anonymous?'ready':'guest');}catch{if(active&&ticket===revision)setState('guest');}}
  void check();
  const sub=supabase?.auth.onAuthStateChange((event)=>{if(event==='INITIAL_SESSION')return;revision++;setState('loading');setTimeout(()=>{if(active)void check();},0);});
  return()=>{active=false;revision++;sub?.data?.subscription?.unsubscribe();};
 },[]);
 if(state==='ready')return children;
 return <main style={{maxWidth:650,margin:'60px auto',padding:24,fontFamily:'Arial,sans-serif',color:'#312e81'}}><a href="/social">← Voltar à Social</a>{state==='loading'?<p role="status">Verificando sua conta…</p>:<><h1>Entre para acessar seus Insights</h1><p>Os Insights pertencem à sua conta na Jenios.</p><a href="/login">Entrar ou criar conta</a></>}</main>;
}
