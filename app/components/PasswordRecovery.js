'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase';
export default function PasswordRecovery({reset=false}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[valid,setValid]=useState(false),[done,setDone]=useState(false);
 const mounted=useRef(true);
 useEffect(()=>{
  mounted.current=true;
  if(!reset)return()=>{mounted.current=false;};
  let revision=0;
  const hash=new URLSearchParams(window.location.hash.slice(1));
  async function check(){const ticket=++revision;try{const r=await supabase?.auth.getUser();if(mounted.current&&ticket===revision){setValid(Boolean(!r?.error&&r?.data?.user?.id&&!r.data.user.is_anonymous));if(r?.error||!r?.data?.user)setError('O link é inválido ou expirou. Solicite um novo link.');}}catch{if(mounted.current&&ticket===revision)setError('Não foi possível validar o link. Solicite um novo.');}}
  const sub=supabase?.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>{if(mounted.current)void check();},0);if(event==='SIGNED_OUT'){revision++;setValid(false);}});
  if(hash.has('error')||hash.has('error_code')){setError('O link é inválido ou expirou. Solicite um novo link.');window.history.replaceState(null,'',window.location.pathname);}
  else void check();
  return()=>{mounted.current=false;revision++;sub?.data?.subscription?.unsubscribe();};
 },[reset]);
 async function submit(event){
  event.preventDefault();if(busy)return;setError('');setMessage('');
  if(!supabase){setError('Serviço de acesso indisponível. Tente novamente mais tarde.');return;}
  if(reset&&(!valid||password!==confirm)){setError(valid?'As senhas precisam ser iguais.':'Solicite um novo link de recuperação.');return;}
  if(reset&&(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[\W_]/.test(password))){setError('Use pelo menos 12 caracteres, com maiúsculas, minúsculas, números e símbolos.');return;}
  setBusy(true);
  try{
   const result=reset?await supabase.auth.updateUser({password}):await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:window.location.origin+'/redefinir-senha'});
   if(result.error)throw result.error;
   if(reset){setPassword('');setConfirm('');setValid(false);setDone(true);setMessage('Senha atualizada. Entre com sua nova senha.');window.history.replaceState(null,'',window.location.pathname);await supabase.auth.signOut({scope:'local'});}
   else{setMessage('Se houver uma conta para este e-mail, você receberá um link para redefinir sua senha. Confira também a pasta de spam.');setDone(true);}
  }catch(e){if(mounted.current)setError(e?.status===429?'Aguarde alguns minutos antes de tentar novamente.':reset?'Não foi possível atualizar a senha. O link pode ter expirado ou a senha não atende aos requisitos. Solicite um novo link.':'Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.');}
  finally{if(mounted.current)setBusy(false);}
 }
 const input={display:'block',boxSizing:'border-box',width:'100%',padding:12,margin:'8px 0 18px',border:'1px solid #cbd5e1',borderRadius:10};
 return <main style={{minHeight:'100vh',background:'#f6f5fb',padding:'60px 20px',fontFamily:'Arial,sans-serif',color:'#312e81'}}><section style={{maxWidth:420,margin:'auto',background:'#fff',borderRadius:18,padding:28,border:'1px solid #ddd6fe'}}><strong>JENIOS</strong><h1>{reset?'Definir nova senha':'Recuperar senha'}</h1>{!done&&<form onSubmit={submit}>{reset?<><label>Nova senha<input aria-label="Nova senha" style={input} type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)} disabled={!valid||busy}/></label><label>Confirmar nova senha<input aria-label="Confirmar nova senha" style={input} type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={!valid||busy}/></label><p>Use ao menos 12 caracteres, com maiúsculas, minúsculas, números e símbolos.</p></>:<label>E-mail da conta<input aria-label="E-mail da conta" style={input} type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>}<button disabled={busy||(reset&&!valid)} style={{background:'#7c3aed',color:'#fff',padding:12,border:0,borderRadius:10,width:'100%',cursor:'pointer'}}>{busy?'Aguarde…':reset?'Salvar nova senha':'Enviar link de recuperação'}</button></form>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{reset&&!done&&<p><a href="/recuperar-senha">Solicitar novo link</a></p>}<p><a href="/login">Voltar ao login</a></p></section></main>;
}
