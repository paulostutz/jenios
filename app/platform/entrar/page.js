'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {platformSupabase} from '../../../lib/platform/supabase-client';

export default function PlatformLogin(){
 const router=useRouter();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!platformSupabase)return;
  let mounted=true;
  platformSupabase.auth.getUser().then(({data})=>{
   if(mounted && data?.user?.id && !data.user.is_anonymous)router.replace('/dashboard-logado');
  }).catch(()=>{});
  return()=>{mounted=false;};
 },[router]);
 async function submit(event){
  event.preventDefault();if(busy)return;
  setError('');setBusy(true);
  try{
   if(!platformSupabase)throw Error('A autenticação privada da Platform ainda não está configurada.');
   const {data,error:loginError}=await platformSupabase.auth.signInWithPassword({
     email:email.trim().toLowerCase(),password
   });
   if(loginError || !data?.session)throw Error('Não foi possível autenticar na JENIOS Platform.');
   setPassword('');
   router.replace('/dashboard-logado');
   router.refresh();
  }catch(e){setError(e?.message||'Acesso indisponível.');setPassword('');}
  finally{setBusy(false);}
 }
 const input={boxSizing:'border-box',width:'100%',padding:'12px 14px',border:'1px solid #cbd5e1',borderRadius:10,fontSize:14};
 return <main style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#251354)',padding:18,display:'grid',placeItems:'center',fontFamily:'system-ui'}}>
   <section style={{background:'#fff',color:'#0f172a',padding:'clamp(22px,4vw,35px)',maxWidth:450,width:'100%',borderRadius:18,boxSizing:'border-box'}}>
    <div style={{fontSize:11,color:'#6d28d9',fontWeight:900,letterSpacing:2}}>JENIOS PLATFORM</div>
    <h1 style={{fontSize:26,margin:'10px 0'}}>Acesso da Platform</h1>
    <p style={{fontSize:13,lineHeight:1.6,color:'#64748b'}}>Ambiente separado da JENIOS Social. Use uma conta criada na autenticação da Platform; nenhuma conta de corretora é solicitada aqui.</p>
    {error && <p role="alert" style={{padding:12,background:'#fef2f2',borderRadius:8,color:'#991b1b'}}>{error}</p>}
    <form onSubmit={submit} style={{display:'grid',gap:14}}>
     <label style={{display:'grid',gap:5,fontSize:12,fontWeight:800}}>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required disabled={busy} style={input}/></label>
     <label style={{display:'grid',gap:5,fontSize:12,fontWeight:800}}>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy} style={input}/></label>
     <button disabled={busy || !platformSupabase} style={{padding:14,background:'#6d28d9',color:'#fff',border:0,borderRadius:10,fontWeight:900,cursor:'pointer',opacity:busy?.6:1}}>{busy?'Autenticando…':'Entrar na Platform'}</button>
    </form>
    <p style={{fontSize:12,color:'#64748b',marginTop:20}}>O simulador continua acessível sem login. O diagnóstico precisa de sessão autenticada para ser validado no servidor.</p>
    <Link href="/dashboard" style={{fontSize:13,color:'#6d28d9'}}>Voltar à simulação</Link>
   </section>
  </main>;
}
