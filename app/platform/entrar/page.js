'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {isPlatformSignupEnabled,registerPlatformAccount} from '../../../lib/platform/account-access.mjs';
import {resolveSocialPortalEntry} from '../../../lib/platform/unified-entry.mjs';
import SocialAccessForm from '../../components/SocialAccessForm';
import {socialAuthReturnPath} from '../../components/social-auth-return.mjs';

const signupEnabled=isPlatformSignupEnabled(process.env.NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED);

export default function PlatformLogin(){
 const router=useRouter();
 const [dedicated,setDedicated]=useState(false);
 const [destination,setDestination]=useState('/dashboard-logado');
 const [register,setRegister]=useState(false);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 useEffect(()=>{
  let mounted=true;
  const next=new URLSearchParams(window.location.search).get('next');
  const target=next?socialAuthReturnPath(next):'/dashboard-logado';
  setDestination(target);
  async function routeExistingSession(){
   try{
    const social=await resolveSocialPortalEntry();
    if(!mounted)return;
    if(social){router.replace(target);return;}
    const {data}=platformSupabase?.auth ? await platformSupabase.auth.getUser():{data:null};
    if(!mounted)return;
    if(data?.user?.id && !data.user.is_anonymous){
     router.replace(target);return;
    }
   }catch{/* Dedicated login remains available if sessions cannot be verified. */}
  }
  void routeExistingSession();
  return()=>{mounted=false;};
 },[router]);
 async function submit(event){
  event.preventDefault();if(busy)return;
  setError('');setMessage('');setBusy(true);
  try{
   if(!platformSupabase)throw Error('A autenticação privada da Platform ainda não está configurada.');
   if(register){
     const result=await registerPlatformAccount(platformSupabase.auth,email,password,
       confirmation,window.location.origin,process.env.NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED);
     setPassword('');setConfirmation('');setMessage(result.message);
     if(result.session){router.replace(destination);router.refresh();}
     else setRegister(false);
   }else{
     const {data,error:loginError}=await platformSupabase.auth.signInWithPassword({
       email:email.trim().toLowerCase(),password
     });
     if(loginError || !data?.session || data.session.user?.is_anonymous)
       throw Error('Não foi possível autenticar na JENIOS Platform.');
     setPassword('');
     router.replace(destination);
     router.refresh();
   }
  }catch(e){setError(e?.message||'Acesso indisponível.');setPassword('');setConfirmation('');}
  finally{setBusy(false);}
 }
 const input={boxSizing:'border-box',width:'100%',padding:'12px 14px',border:'1px solid #cbd5e1',borderRadius:10,fontSize:14};
 if(!dedicated)return <>
  <header style={{background:'#0f172a',color:'#fff',padding:'24px 20px 0',textAlign:'center',fontFamily:'system-ui'}}>
   <h1 style={{margin:0,fontSize:24}}>Entrar na JENIOS Platform</h1>
   <p>Use a mesma conta da JENIOS Social para acessar sua área de simulação.</p>
   <button type="button" onClick={()=>setDedicated(true)} style={{border:0,background:'transparent',color:'#c4b5fd',textDecoration:'underline',cursor:'pointer'}}>Tenho um acesso exclusivo da Platform</button>
  </header>
  <SocialAccessForm returnTo={destination}/>
 </>;
 return <main style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#251354)',padding:18,display:'grid',placeItems:'center',fontFamily:'system-ui'}}>
   <section style={{background:'#fff',color:'#0f172a',padding:'clamp(22px,4vw,35px)',maxWidth:460,width:'100%',borderRadius:18,boxSizing:'border-box'}}>
    <div style={{fontSize:11,color:'#6d28d9',fontWeight:900,letterSpacing:2}}>JENIOS PLATFORM</div>
    <h1 style={{fontSize:26,margin:'10px 0'}}>{register?'Crie seu acesso':'Acesso da Platform'}</h1>
    <p style={{fontSize:13,lineHeight:1.6,color:'#64748b'}}>Este formulário é para contas exclusivas da Platform. Para sua conta da Social, use a entrada principal da JENIOS.</p>
    <button type="button" disabled={busy} onClick={()=>{setDedicated(false);setPassword('');setConfirmation('');setError('');}} style={{border:0,background:'transparent',color:'#6d28d9',padding:'8px 0',cursor:'pointer'}}>Entrar com minha conta da JENIOS Social</button>
    {error && <p role="alert" style={{padding:12,background:'#fef2f2',borderRadius:8,color:'#991b1b'}}>{error}</p>}
    {message && <p role="status" style={{padding:12,background:'#f0fdf4',borderRadius:8,color:'#166534'}}>{message}</p>}
    <form onSubmit={submit} style={{display:'grid',gap:14}}>
     <label style={{display:'grid',gap:5,fontSize:12,fontWeight:800}}>E-mail
      <input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required disabled={busy} maxLength={254} style={input}/></label>
     <label style={{display:'grid',gap:5,fontSize:12,fontWeight:800}}>Senha
      <input type="password" autoComplete={register?'new-password':'current-password'}
       value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}
       minLength={register?12:undefined} maxLength={register?128:undefined} style={input}/></label>
     {register&&<label style={{display:'grid',gap:5,fontSize:12,fontWeight:800}}>Confirme sua senha
      <input type="password" autoComplete="new-password" value={confirmation}
       onChange={e=>setConfirmation(e.target.value)} required disabled={busy}
       minLength={12} maxLength={128} style={input}/></label>}
     {register&&<p style={{margin:0,fontSize:12,color:'#475569'}}>Use de 12 a 128 caracteres, com maiúscula, minúscula, número e símbolo. Uma confirmação por e-mail poderá ser necessária.</p>}
     <button disabled={busy || !platformSupabase} style={{padding:14,background:'#6d28d9',color:'#fff',border:0,borderRadius:10,fontWeight:900,cursor:'pointer',opacity:busy?.6:1}}>{busy?'Aguarde…':register?'Criar conta':'Entrar na Platform'}</button>
    </form>
    <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',marginTop:18,fontSize:13}}>
     <Link href="/platform/recuperar" style={{color:'#6d28d9'}}>Esqueci minha senha</Link>
     {signupEnabled && <button type="button" disabled={busy} onClick={()=>{setRegister(v=>!v);setPassword('');setConfirmation('');setError('');setMessage('');}}
       style={{background:'none',border:0,cursor:'pointer',color:'#6d28d9',fontSize:13,fontWeight:700}}>{register?'Já tenho conta':'Criar conta'}</button>}
    </div>
    {!signupEnabled&&<p style={{color:'#64748b',fontSize:12,marginTop:18}}>Cadastros ainda não foram liberados neste ambiente. Novas contas são autorizadas durante a homologação.</p>}
    <p style={{fontSize:12,color:'#64748b',marginTop:18}}>O simulador continua disponível antes do diagnóstico. Operações reais permanecem desabilitadas.</p>
    <Link href="/dashboard" style={{fontSize:13,color:'#6d28d9'}}>Voltar à simulação</Link>
   </section>
  </main>;
}
