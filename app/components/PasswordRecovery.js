'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import {supabase} from '../../lib/supabase';
import {recoveryPaths,requestPasswordRecovery,loadPasswordRecoveryIdentity,changeRecoveredPassword,validateRecoveryPassword} from '../../lib/password-recovery.mjs';

const clientOptions={createClient,projectUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
 publishableKey:process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY};
const safeMessage=error=>typeof error?.code==='string'&&/^(ACCOUNT_|RECOVERY_|PASSWORD_|SESSION_CHANGED$)/.test(error.code)
 ?error.message:'Não foi possível concluir esta operação. Solicite um novo link e tente novamente.';
const changedSession='Sua sessão mudou. Abra novamente o link de recuperação da conta desejada.';

export default function PasswordRecovery({reset=false,admin=false}){
 const paths=recoveryPaths(admin);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [identity,setIdentity]=useState(null),[checking,setChecking]=useState(reset),[done,setDone]=useState(false);
 const mounted=useRef(false),operation=useRef(null),owner=useRef(null),completed=useRef(false),rejectedLink=useRef(null);
 useEffect(()=>{
  mounted.current=true;completed.current=false;owner.current=null;
  let active=true,revision=0,timer=null,reader=null;
  setIdentity(null);setDone(false);setMessage('');setError('');setPassword('');setConfirm('');setBusy(false);
  function cancelPending(){
   revision++;reader?.abort();reader=null;operation.current?.abort();operation.current=null;
   if(timer!==null){clearTimeout(timer);timer=null;}
  }
  function invalidate(text){
   if(!active)return;cancelPending();setIdentity(null);setChecking(false);setPassword('');setConfirm('');setBusy(false);setMessage('');setError(text);
  }
  async function check(ticket,expectedOwner){
   if(!active||ticket!==revision||completed.current)return;
   const controller=new AbortController();reader=controller;
   try{
    const result=await loadPasswordRecoveryIdentity(supabase?.auth,{signal:controller.signal});
    if(!active||ticket!==revision||controller.signal.aborted)return;
    if(expectedOwner&&result.id!==expectedOwner){invalidate(changedSession);return;}
    owner.current=result.id;setIdentity(result);setChecking(false);setError('');
    // Auth has consumed the recovery callback by this point. Keep tokens out of the address bar.
    window.history.replaceState(null,'',window.location.pathname);
   }catch(cause){
    if(active&&ticket===revision&&!controller.signal.aborted){setIdentity(null);setChecking(false);setError(safeMessage(cause));}
   }finally{if(reader===controller)reader=null;}
  }
  function scheduleCheck(expectedOwner){
   if(!active||completed.current)return;
   cancelPending();const ticket=revision;
   setIdentity(null);setChecking(true);setPassword('');setConfirm('');setBusy(false);setMessage('');setError('');
   // Supabase callbacks stay synchronous; getSession/getUser run outside their lock.
   timer=setTimeout(()=>{timer=null;void check(ticket,expectedOwner);},0);
  }
  const hash=new URLSearchParams(window.location.hash.slice(1)),query=new URLSearchParams(window.location.search);
  if(reset&&[hash,query].some(params=>params.has('error')||params.has('error_code')))rejectedLink.current=window.location.pathname;
  // Preserve an invalid-link decision through StrictMode's effect replay after URL cleanup.
  const invalidLink=reset&&rejectedLink.current===window.location.pathname;
  const subscription=reset?supabase?.auth.onAuthStateChange(event=>{
   if(!active||completed.current||invalidLink||event==='INITIAL_SESSION')return;
   if(event==='SIGNED_OUT'){invalidate(changedSession);return;}
   if(event==='PASSWORD_RECOVERY'){owner.current=null;scheduleCheck(null);return;}
   scheduleCheck(owner.current);
  }):null;
  const focus=()=>{if(reset&&!invalidLink&&owner.current&&!completed.current)scheduleCheck(owner.current);};
  if(reset){
   window.addEventListener('focus',focus);
   if(invalidLink){invalidate('O link é inválido ou expirou. Solicite um novo link.');window.history.replaceState(null,'',window.location.pathname);}
   else scheduleCheck(null);
  }else setChecking(false);
  return()=>{
   active=false;mounted.current=false;cancelPending();
   subscription?.data?.subscription?.unsubscribe();window.removeEventListener('focus',focus);
  };
 },[reset,admin]);

 async function submit(event){
  event.preventDefault();if(operation.current)return;setError('');setMessage('');
  if(reset&&!identity){setError('Solicite um novo link de recuperação.');return;}
  if(reset){try{validateRecoveryPassword(password,confirm);}catch(cause){setError(safeMessage(cause));return;}}
  const controller=new AbortController();operation.current=controller;
  const current=()=>mounted.current&&operation.current===controller&&!controller.signal.aborted;
  setBusy(true);
  try{
   const result=reset
    ?await changeRecoveredPassword(supabase?.auth,{...clientOptions,ownerId:identity.id,password,confirmation:confirm,admin,signal:controller.signal})
    :await requestPasswordRecovery(supabase?.auth,{email,origin:window.location.origin,admin,signal:controller.signal});
   if(!current())return;
   completed.current=true;setDone(true);setIdentity(null);setEmail('');
   setMessage(reset?'Senha atualizada. Você pode voltar ao login para continuar.':result.message);
   if(reset)window.history.replaceState(null,'',window.location.pathname);
  }catch(cause){if(current())setError(safeMessage(cause));}
  finally{
   if(current()){setPassword('');setConfirm('');setBusy(false);}
   if(operation.current===controller)operation.current=null;
  }
 }
 const input={display:'block',boxSizing:'border-box',width:'100%',padding:12,margin:'8px 0 18px',border:'1px solid #cbd5e1',borderRadius:10};
 return <main style={{minHeight:'100vh',background:'#f6f5fb',padding:'60px 20px',fontFamily:'Arial,sans-serif',color:'#312e81'}}>
  <section style={{maxWidth:420,margin:'auto',background:'#fff',borderRadius:18,padding:28,border:'1px solid #ddd6fe'}}>
   <strong>{admin?'JENIOS · Administração':'JENIOS'}</strong>
   <h1>{reset?'Definir nova senha':admin?'Primeiro acesso ou recuperar senha':'Recuperar senha'}</h1>
   {!reset&&!done&&admin&&<p>Use o e-mail cadastrado na sua conta para definir sua senha no primeiro acesso ou recuperar uma senha esquecida.</p>}
   {reset&&checking&&!done&&<p role="status">Verificando a conta vinculada ao seu acesso…</p>}
   {reset&&identity&&!done&&<p style={{overflowWrap:'anywhere'}}>Conta para redefinição: <strong>{identity.email}</strong></p>}
   {!done&&<form onSubmit={submit}>
    {reset?<>
     <label>Nova senha<input aria-label="Nova senha" style={input} type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} disabled={!identity||busy}/></label>
     <label>Confirmar nova senha<input aria-label="Confirmar nova senha" style={input} type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={event=>setConfirm(event.target.value)} disabled={!identity||busy}/></label>
     <p>Use de 12 a 128 caracteres, com maiúsculas, minúsculas, números e símbolos.</p>
    </>:<label>E-mail da conta<input aria-label="E-mail da conta" style={input} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} disabled={busy}/></label>}
    <button type="submit" disabled={busy||(reset&&!identity)} style={{background:'#7c3aed',color:'#fff',padding:12,border:0,borderRadius:10,width:'100%',cursor:'pointer'}}>{busy?'Aguarde…':reset?'Salvar nova senha':'Enviar link de recuperação'}</button>
   </form>}
   {message&&<p role="status">{message}</p>}{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
   {reset&&!done&&<p><Link href={paths.request}>Solicitar novo link</Link></p>}
   <p><Link href={paths.login}>Voltar ao login</Link></p>
  </section>
 </main>;
}
