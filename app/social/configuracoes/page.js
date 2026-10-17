'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../../lib/supabase';
import {DELETION_CONFIRMATION} from '../../../lib/social/account-deletion.mjs';
import {CANCEL_CONFIRMATION} from '../../../lib/social/account-deletion-cancel.mjs';
import {deletionAction} from '../../../lib/social/deletion-ui-state.mjs';
import '../account-controls.css';
export default function SocialAccountSettings(){
 const [session,setSession]=useState(null),[loaded,setLoaded]=useState(false),[record,setRecord]=useState(null);
 const [confirmation,setConfirmation]=useState(''),[cancelConfirmation,setCancelConfirmation]=useState(''),[understood,setUnderstood]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const epoch=useRef(0),lock=useRef(false);
 useEffect(()=>{
  let active=true;
  const reset=async(next)=>{
   const version=++epoch.current;setSession(next);setLoaded(true);setRecord(null);setConfirmation('');setCancelConfirmation('');setUnderstood(false);setMessage('');setError('');lock.current=false;setBusy(false);
   if(!next)return;
   try{const response=await fetch('/api/social/account-deletion',{headers:{authorization:'Bearer '+next.access_token},cache:'no-store'});const data=await response.json();if(!active||version!==epoch.current)return;if(!response.ok)throw new Error(data.error);setRecord(data.request||null);}catch(e){if(active&&version===epoch.current)setError(e.message||'Não foi possível consultar solicitações.');}
  };
  if(!supabase){setLoaded(true);setError('Conexão indisponível.');return;}
  const initialEpoch=epoch.current;
  supabase.auth.getSession().then(({data})=>{if(active&&epoch.current===initialEpoch)void reset(data.session);}).catch(()=>{if(active&&epoch.current===initialEpoch){setLoaded(true);setError('Não foi possível confirmar a sessão. Entre novamente.');}});
  const {data}=supabase.auth.onAuthStateChange((event,next)=>{if(active&&event!=='INITIAL_SESSION'&&event!=='TOKEN_REFRESHED')void reset(next);});
  return()=>{active=false;epoch.current++;data.subscription.unsubscribe();};
 },[]);
 async function submit(event){
  event.preventDefault();if(lock.current||!session)return;
  lock.current=true;setBusy(true);setError('');setMessage('');const version=epoch.current;
  try{
   const {data:auth}=await supabase.auth.getSession();if(version!==epoch.current)return;if(auth?.session?.user?.id!==session.user.id)throw new Error('A conta mudou. Reabra esta página.');
   const response=await fetch('/api/social/account-deletion',{method:'POST',headers:{authorization:'Bearer '+auth.session.access_token,'content-type':'application/json'},body:JSON.stringify({confirmation,understood}),cache:'no-store'});
   const result=await response.json();if(version!==epoch.current)return;if(!response.ok)throw new Error(result.error||'Não foi possível registrar.');setRecord(result.request);setMessage(result.message||'Sua solicitação está registrada. A conta ainda não foi excluída.');setConfirmation('');setUnderstood(false);
  }catch(e){if(version===epoch.current)setError(e.message);}finally{if(version===epoch.current){lock.current=false;setBusy(false);}}
 }
 async function cancelRequest(event){
  event.preventDefault();if(lock.current||!session||record?.status!=='pending'||cancelConfirmation!==CANCEL_CONFIRMATION)return;
  lock.current=true;setBusy(true);setError('');setMessage('');const version=epoch.current;
  try{
   const {data:auth}=await supabase.auth.getSession();if(version!==epoch.current)return;
   if(!auth?.session?.access_token||auth.session.user?.id!==session.user.id)throw Error('A conta mudou. Entre novamente.');
   const response=await fetch('/api/social/account-deletion/cancel',{
    method:'POST',cache:'no-store',headers:{authorization:'Bearer '+auth.session.access_token,'content-type':'application/json'},
    body:JSON.stringify({confirmation:cancelConfirmation})
   });
   const result=await response.json();if(version!==epoch.current)return;
   if(!response.ok)throw Error(result.error||'Não foi possível cancelar.');
   setRecord(result.request);setCancelConfirmation('');setMessage(result.message||'Solicitação cancelada.');
  }catch(e){if(version===epoch.current)setError(e.message||'Não foi possível cancelar.');}
  finally{if(version===epoch.current){lock.current=false;setBusy(false);}}
 }
 return <main className="social-account-page"><section className="social-account-card">
  <Link href="/social">← Voltar à Social</Link><h1>Conta e privacidade</h1>
  {!loaded&&<p role="status">Carregando sua conta…</p>}
  {loaded&&!session&&<p>Entre na sua conta para continuar. <Link href="/login">Fazer login</Link></p>}
  {session&&<><h2>Excluir minha conta</h2><p>A conta JENIOS também dá acesso a outros módulos. A solicitação abaixo precisa considerar conteúdos publicados, arquivos e eventuais vínculos com serviços.</p>
   <p><strong>Solicitar não significa excluir imediatamente.</strong> A conta permanece ativa até o processamento. Nenhum prazo ou exclusão integral é confirmado por este formulário.</p>
   {record?<div role="status"><strong>Solicitação registrada</strong><p>Protocolo: {record.id}</p><p>Status: {({pending:'Aguardando processamento',processing:'Em processamento',completed:'Processamento concluído',cancelled:'Cancelada'})[record.status]||'Em análise'}</p><p>Não envie novamente a mesma solicitação.</p>
    {deletionAction(record.status)==='cancel'&&<form onSubmit={cancelRequest}>
      <p>Você pode cancelar uma solicitação ainda pendente. Nenhum conteúdo da conta é excluído pelo cancelamento.</p>
      <label htmlFor="cancel-deletion-confirmation">Digite {CANCEL_CONFIRMATION} para cancelar</label>
      <input id="cancel-deletion-confirmation" value={cancelConfirmation} onChange={e=>setCancelConfirmation(e.target.value)} autoComplete="off" disabled={busy}/>
      <button type="submit" disabled={busy||cancelConfirmation!==CANCEL_CONFIRMATION}>Cancelar solicitação de exclusão</button>
      <p>Por segurança, é necessário ter feito login recentemente.</p>
    </form>}
    {deletionAction(record.status)==='reopen'&&<form onSubmit={submit}>
      <p>Esta solicitação foi cancelada e sua conta permanece ativa. Se desejar retomar a exclusão, confirme novamente. O pedido será reaberto apenas para sua própria conta, após login recente.</p>
      <label className="social-confirm-checkbox"><input type="checkbox" checked={understood} onChange={e=>setUnderstood(e.target.checked)} required disabled={busy}/>Compreendo que estou reabrindo minha solicitação de exclusão e que a conta não será excluída imediatamente.</label>
      <label htmlFor="reopen-deletion-confirmation">Digite {DELETION_CONFIRMATION}</label>
      <input id="reopen-deletion-confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" required disabled={busy}/>
      <button type="submit" className="social-danger" disabled={busy||!understood||confirmation!==DELETION_CONFIRMATION}>{busy?'Reabrindo…':'Reabrir solicitação de exclusão'}</button>
      <p>Por segurança, entre novamente se seu login tiver mais de 15 minutos. <Link href="/login">Entrar novamente</Link>.</p>
    </form>}
   </div>:<form onSubmit={submit}>
    <label className="social-confirm-checkbox"><input type="checkbox" checked={understood} onChange={e=>setUnderstood(e.target.checked)} required disabled={busy}/>Compreendo que estou solicitando a exclusão da minha própria conta e que o processamento não é imediato.</label>
    <label htmlFor="deletion-confirmation">Digite {DELETION_CONFIRMATION}</label><input id="deletion-confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" required disabled={busy}/>
    <button type="submit" className="social-danger" disabled={busy||!understood||confirmation!==DELETION_CONFIRMATION}>{busy?'Registrando…':'Solicitar exclusão da conta'}</button>
    <p>Por segurança, a confirmação exige login realizado nos últimos 15 minutos. <Link href="/login">Entrar novamente</Link>.</p>
   </form>}
  </>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section></main>;
}
