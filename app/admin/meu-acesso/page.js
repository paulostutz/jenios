'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import AdminAccess from '../../components/AdminAccess';
import {supabase} from '../../../lib/supabase';
import {loadOwnAccountEmail,requestOwnAccountEmailChange} from '../../../lib/admin-account.mjs';
import styles from '../page.module.css';

const clientOptions={createClient,projectUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
 publishableKey:process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY};
const inputStyle={width:'100%',boxSizing:'border-box',padding:12,border:'1px solid #cbd5e1',borderRadius:9,font:'inherit'};
const labelStyle={display:'grid',gap:8,fontSize:14,fontWeight:650};
const errorMessage=error=>error?.code?.startsWith('ACCOUNT_')||error?.code==='SESSION_CHANGED'
 ?error.message:'Não foi possível consultar sua conta. Atualize seu acesso e tente novamente.';

function OwnAccessContent(){
 const [state,setState]=useState({status:'loading',account:null}),[refresh,setRefresh]=useState(0);
 const [email,setEmail]=useState(''),[confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const live=useRef(false),operation=useRef(null);
 useEffect(()=>{
  live.current=true;let active=true,epoch=0,timer=null,reader=null;
  async function load(ticket){
   if(!active||ticket!==epoch)return;
   const controller=new AbortController();reader=controller;
   try{
    const account=await loadOwnAccountEmail(supabase?.auth,{signal:controller.signal});
    if(active&&ticket===epoch&&!controller.signal.aborted)setState({status:'ready',account});
   }catch(cause){
    if(active&&ticket===epoch&&!controller.signal.aborted){setState({status:'error',account:null});setError(errorMessage(cause));}
   }finally{if(reader===controller)reader=null;}
  }
  function reload(){
   if(!active)return;
   const ticket=++epoch;reader?.abort();operation.current?.abort();operation.current=null;
   if(timer!==null)clearTimeout(timer);
   setState({status:'loading',account:null});setEmail('');setConfirmation('');setMessage('');setError('');setBusy(false);
   // Keep Supabase callbacks synchronous. Session reads occur outside its lock.
   timer=setTimeout(()=>{timer=null;void load(ticket);},0);
  }
  const subscription=supabase?.auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION')reload();});
  window.addEventListener('focus',reload);reload();
  return()=>{
   active=false;live.current=false;epoch++;reader?.abort();operation.current?.abort();operation.current=null;
   if(timer!==null)clearTimeout(timer);
   subscription?.data?.subscription?.unsubscribe();window.removeEventListener('focus',reload);
  };
 },[refresh]);

 async function submit(event){
  event.preventDefault();
  if(operation.current||state.status!=='ready'||!state.account)return;
  const controller=new AbortController();operation.current=controller;
  const current=()=>live.current&&operation.current===controller&&!controller.signal.aborted;
  setBusy(true);setMessage('');setError('');
  try{
   const result=await requestOwnAccountEmailChange(supabase?.auth,{...clientOptions,
    ownerId:state.account.id,email,confirmation,origin:window.location.origin,signal:controller.signal});
   if(!current())return;
   setState({status:'ready',account:{id:result.id,email:result.email,pendingEmail:result.pendingEmail}});
   setMessage(result.status==='unchanged'?'Esse já é o e-mail atual da sua conta. Nenhuma alteração foi solicitada.'
    :result.status==='changed'?'O e-mail desta conta foi atualizado. Use o endereço atual no próximo acesso.'
    :result.requested?'Solicitação registrada. Confira as mensagens de confirmação para concluir a alteração.'
    :'Já existe uma alteração pendente para este endereço. Confira a confirmação no seu e-mail.');
  }catch(cause){if(current())setError(errorMessage(cause));}
  finally{
   if(current()){setEmail('');setConfirmation('');setBusy(false);}
   if(operation.current===controller)operation.current=null;
  }
 }
 const account=state.account;
 return <div className={styles.page}><main className={styles.main} style={{maxWidth:850,width:'100%'}}>
  <header className={styles.top}>
   <div><Link href="/admin" className={styles.action}>← Administração</Link><p className={styles.kicker} style={{marginTop:22}}>JENIOS · CONTA MASTER</p>
    <h1>Meu acesso</h1><p>Consulte sua conta e mantenha seu endereço de acesso atualizado.</p></div>
   <button type="button" className={styles.action} disabled={busy||state.status==='loading'} onClick={()=>setRefresh(value=>value+1)}>Atualizar meu acesso</button>
  </header>
  {error&&<p role="alert" style={{padding:14,borderRadius:10,background:'#fff1f2',color:'#9f1239'}}>{error}</p>}
  {message&&<p role="status" style={{padding:14,borderRadius:10,background:'#ecfdf5',color:'#065f46'}}>{message}</p>}
  {state.status==='loading'&&<p role="status">Conferindo os dados da sua conta…</p>}
  {account&&<>
   <section className={styles.panel} aria-labelledby="current-account-title">
    <h2 id="current-account-title">Sua conta atual</h2>
    <dl style={{display:'grid',gap:8,margin:'20px 0'}}>
     <dt style={{fontSize:13,color:'#64748b'}}>E-mail atual</dt><dd style={{margin:0,fontWeight:700,overflowWrap:'anywhere'}}>{account.email}</dd>
     <dt style={{fontSize:13,color:'#64748b',marginTop:12}}>Identificador da conta</dt><dd style={{margin:0,overflowWrap:'anywhere'}}><code>{account.id}</code></dd>
    </dl>
    <p>A alteração do e-mail mantém esta mesma conta, seu histórico e suas permissões.</p>
    {account.pendingEmail&&<div role="status" className={styles.notice}>
     <strong>Alteração aguardando confirmação</strong><p style={{overflowWrap:'anywhere'}}>Novo endereço: <strong>{account.pendingEmail}</strong></p>
     <p>Confira as caixas de entrada do endereço atual e do novo endereço. Conclua as confirmações solicitadas e depois atualize seu acesso aqui.</p>
    </div>}
   </section>
   <section className={styles.panel} style={{marginTop:20}} aria-labelledby="email-change-title">
    <h2 id="email-change-title">Alterar meu e-mail</h2>
    <p id="email-change-help">Digite o novo endereço duas vezes. A troca depende da confirmação enviada pelo serviço de autenticação. Até a conclusão, continue usando o e-mail atual.</p>
    <form onSubmit={submit} aria-describedby="email-change-help">
     <fieldset disabled={busy} style={{display:'grid',gap:18,border:0,padding:0,margin:'22px 0 0',minWidth:0}}>
      <legend className={styles.kicker} style={{marginBottom:16}}>NOVO ENDEREÇO DE ACESSO</legend>
      <label style={labelStyle}>Novo e-mail<input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} style={inputStyle}/></label>
      <label style={labelStyle}>Confirme o novo e-mail<input type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={254} value={confirmation} onChange={event=>setConfirmation(event.target.value)} style={inputStyle}/></label>
      <div className={styles.actions}><button type="submit" className={styles.action}>{busy?'Solicitando confirmação…':'Solicitar alteração de e-mail'}</button>
       <button type="button" className={styles.action} onClick={()=>{setEmail('');setConfirmation('');setError('');setMessage('');}}>Limpar campos</button></div>
     </fieldset>
    </form>
   </section>
  </>}
 </main></div>;
}

export default function OwnAdminAccessPage(){
 return <AdminAccess permission="permissions.manage" loginRedirect="/admin/login"><OwnAccessContent/></AdminAccess>;
}
