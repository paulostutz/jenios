'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {changePlatformPassword} from '../../../lib/platform/account-access.mjs';

export default function PlatformReset(){
 const router=useRouter(),[ready,setReady]=useState(false),[checking,setChecking]=useState(true);
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{
  let alive=true;
  async function check(){
   try{
    if(!platformSupabase)throw Error('Auth indisponível');
    const {data,error}=await platformSupabase.auth.getUser();
    if(alive)setReady(!error&&!!data?.user?.id&&!data.user.is_anonymous);
   }catch{if(alive)setReady(false);}
   finally{if(alive)setChecking(false);}
  }
  void check();
  const sub=platformSupabase?.auth?.onAuthStateChange(event=>{
   if(event==='PASSWORD_RECOVERY'||event==='SIGNED_IN')
    setTimeout(()=>{if(alive)void check();},0);
  });
  return()=>{alive=false;sub?.data?.subscription?.unsubscribe?.();};
 },[]);
 async function submit(event){
  event.preventDefault();if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   await changePlatformPassword(platformSupabase?.auth,password,confirmation);
   setPassword('');setConfirmation('');
   setMessage('Senha atualizada. Você já pode voltar à sua conta da Platform.');
  }catch(e){setError(e.message||'Não foi possível atualizar a senha.');}
  finally{setBusy(false);}
 }
 return <main style={{minHeight:'100vh',background:'#14112c',padding:20,display:'grid',placeItems:'center',fontFamily:'system-ui'}}>
  <section style={{padding:'clamp(22px,4vw,34px)',borderRadius:18,background:'white',maxWidth:440,width:'100%',boxSizing:'border-box',color:'#0f172a'}}>
   <span style={{fontSize:12,color:'#6d28d9',fontWeight:900}}>JENIOS PLATFORM</span>
   <h1 style={{fontSize:24}}>Definir nova senha</h1>
   {error&&<p role="alert" style={{color:'#991b1b',fontSize:12}}>{error}</p>}
   {message&&<p role="status" style={{color:'#166534',fontSize:12}}>{message}</p>}
   {checking?<p role="status">Verificando link de recuperação…</p>:!ready?
    <p role="alert" style={{fontSize:13,color:'#92400e'}}>Não foi possível validar seu link. Solicite uma nova redefinição.</p>:
    <form onSubmit={submit} style={{display:'grid',gap:12}}>
     <p style={{fontSize:13,lineHeight:1.5,color:'#475569'}}>A nova senha deve ter 12–128 caracteres, letras maiúsculas, minúsculas, número e símbolo.</p>
     <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800}}>Nova senha
      <input type="password" value={password} minLength={12} maxLength={128} autoComplete="new-password"
      disabled={busy} required onChange={e=>setPassword(e.target.value)} style={{padding:13,border:'1px solid #cbd5e1',borderRadius:10}}/></label>
     <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800}}>Confirme a nova senha
      <input type="password" value={confirmation} minLength={12} maxLength={128} autoComplete="new-password"
      disabled={busy} required onChange={e=>setConfirmation(e.target.value)} style={{padding:13,border:'1px solid #cbd5e1',borderRadius:10}}/></label>
     <button disabled={busy} style={{background:'#6d28d9',color:'white',border:0,borderRadius:10,padding:13,fontWeight:800}}>{busy?'Atualizando…':'Salvar nova senha'}</button>
    </form>}
   <p style={{marginTop:22}}><Link href={ready?'/dashboard-logado':'/platform/recuperar'} style={{color:'#6d28d9',fontSize:13}}>{ready?'Ir à Platform →':'Solicitar outro link →'}</Link></p>
  </section>
 </main>;
}
