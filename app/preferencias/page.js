'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';

export default function PreferenciasEmailPage(){
 const [state,setState]=useState({loading:true,marketingOptIn:false,suppressed:false,error:''});
 async function request(method='GET',marketingOptIn){
  const sessionResult=await supabase?.auth.getSession();
  const token=sessionResult?.data?.session?.access_token;
  if(sessionResult?.error||!token)throw Error('Entre na sua conta para gerenciar suas preferências.');
  const response=await fetch('/api/social/email-preferences',{
   method,cache:'no-store',
   headers:{authorization:'Bearer '+token,...(method==='POST'?{'content-type':'application/json'}:{})},
   ...(method==='POST'?{body:JSON.stringify({marketingOptIn})}:{})
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(payload.error||'Não foi possível atualizar suas preferências.');
  return payload;
 }
 useEffect(()=>{
  let live=true;
  request().then(data=>live&&setState({loading:false,marketingOptIn:data.marketingOptIn===true,suppressed:data.suppressed===true,error:''}))
   .catch(e=>live&&setState(s=>({...s,loading:false,error:e.message||'Não foi possível carregar.'})));
  return()=>{live=false;};
 },[]);
 async function change(value){
  if(state.loading)return;
  setState(s=>({...s,loading:true,error:''}));
  try{
   const data=await request('POST',value);
   setState({loading:false,marketingOptIn:data.marketingOptIn===true,suppressed:data.suppressed===true,error:''});
  }catch(e){setState(s=>({...s,loading:false,error:e.message||'Não foi possível salvar.'}));}
 }
 return <main style={{minHeight:'100vh',background:'#f8fafc',padding:'56px 18px',fontFamily:'Arial,sans-serif',color:'#0f172a'}}>
  <section style={{maxWidth:640,margin:'auto',background:'#fff',border:'1px solid #e2e8f0',borderRadius:18,padding:28,boxShadow:'0 14px 40px rgba(15,23,42,.08)'}}>
   <img src="/brand/jenios-logo-horizontal.webp" alt="JENIOS" width="184" style={{maxWidth:184,height:'auto'}}/>
   <h1 style={{fontSize:26,margin:'22px 0 8px'}}>Preferências de comunicação</h1>
   <p style={{color:'#475569',lineHeight:1.65}}>Escolha se deseja receber conteúdos de mercado, lembretes de carrinho e comunicações de relacionamento. E-mails essenciais de conta, segurança e cobrança continuam separados desta preferência.</p>
   {state.error&&<p role="alert" style={{color:'#b91c1c'}}>{state.error}</p>}
   {!state.error&&<div style={{marginTop:24,padding:18,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:14}}>
    <strong>Conteúdo e novidades da JENIOS</strong>
    <p style={{fontSize:13,color:'#64748b',lineHeight:1.6}}>Inclui Radar de Mercado, recuperação de carrinho e conteúdos para conhecer melhor a Platform. Você pode desativar quando quiser.</p>
    <button type="button" disabled={state.loading||state.suppressed} onClick={()=>change(!state.marketingOptIn)}
     style={{border:0,borderRadius:10,padding:'12px 18px',fontWeight:800,cursor:'pointer',background:state.marketingOptIn?'#e2e8f0':'#7c3aed',color:state.marketingOptIn?'#334155':'#fff'}}>
     {state.loading?'Salvando…':state.marketingOptIn?'Desativar comunicações':'Ativar comunicações'}
    </button>
    {state.suppressed&&<p style={{fontSize:12,color:'#92400e'}}>Este endereço está suprimido para comunicações de marketing por motivo de entrega ou segurança. A preferência não remove essa proteção.</p>}
   </div>}
   <p style={{marginTop:24}}><Link href="/social" style={{color:'#7c3aed',fontWeight:700}}>← Voltar para a JENIOS Social</Link></p>
  </section>
 </main>;
}
