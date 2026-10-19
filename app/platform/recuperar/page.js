'use client';
import {useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {requestPlatformPasswordReset} from '../../../lib/platform/account-access.mjs';

export default function PlatformRecover(){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(event){
  event.preventDefault();if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const result=await requestPlatformPasswordReset(platformSupabase?.auth,email,window.location.origin);
   setMessage(result);
  }catch(e){setError(e.message||'Serviço indisponível.');}
  finally{setBusy(false);}
 }
 return <main style={{minHeight:'100vh',background:'#14112c',padding:20,display:'grid',placeItems:'center',fontFamily:'system-ui'}}>
  <section style={{padding:'clamp(22px,4vw,34px)',borderRadius:18,background:'white',maxWidth:440,width:'100%',boxSizing:'border-box',color:'#0f172a'}}>
   <span style={{fontSize:12,color:'#6d28d9',fontWeight:900}}>JENIOS PLATFORM</span>
   <h1 style={{fontSize:24}}>Recuperar acesso</h1>
   <p style={{fontSize:13,color:'#475569',lineHeight:1.6}}>Informe o e-mail da sua conta exclusiva da Platform. Você poderá receber um link para definir nova senha.</p>
   {error&&<p role="alert" style={{color:'#991b1b',fontSize:12}}>{error}</p>}
   {message&&<p role="status" style={{color:'#166534',fontSize:12}}>{message}</p>}
   <form onSubmit={submit} style={{display:'grid',gap:12}}>
    <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800}}>E-mail
     <input type="email" required disabled={busy} maxLength={254} autoComplete="email"
       value={email} onChange={e=>setEmail(e.target.value)}
       style={{padding:13,border:'1px solid #cbd5e1',borderRadius:10,fontSize:14}}/></label>
    <button disabled={busy || !platformSupabase} style={{background:'#6d28d9',color:'#fff',border:0,borderRadius:10,padding:13,fontWeight:800}}>
     {busy?'Solicitando…':'Enviar instruções'}
    </button>
   </form>
   <p style={{marginTop:22}}><Link href="/platform/entrar" style={{color:'#6d28d9',fontSize:13}}>← Voltar ao login da Platform</Link></p>
  </section>
 </main>;
}
