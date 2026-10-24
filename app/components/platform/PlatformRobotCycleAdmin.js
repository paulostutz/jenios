'use client';
import {useEffect,useRef,useState} from 'react';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {requireR65AdminFeed} from '../../../lib/platform/research/robot-r65-admin-view.mjs';
import PlatformRobotCycleReport from './PlatformRobotCycleReport';

const button={padding:'10px 14px',borderRadius:8,border:'1px solid #c4b5fd',background:'#fff',cursor:'pointer'};
const field={display:'grid',gap:6,minWidth:0};
const operationId=()=>`op:${crypto.randomUUID().replaceAll('-','')}`;
function costNano(text){
  if(!/^\d{1,6}(?:\.\d{1,9})?$/.test(text))throw new Error('Informe um custo em dólares com até nove casas decimais.');
  const [whole,fraction='']=text.split('.'),value=Number(whole)*1e9+Number(fraction.padEnd(9,'0'));
  if(!Number.isSafeInteger(value))throw new Error('Custo fora do limite permitido.');return value;
}

function CostReconciliationForm({pending,busy,onAction,onError}){
  const [resolution,setResolution]=useState('CONFIRMED_NO_CHARGE');
  const [cost,setCost]=useState('0'),[providerId,setProviderId]=useState(''),[evidence,setEvidence]=useState('');
  return <form onSubmit={event=>{event.preventDefault();try{onAction({action:'RECONCILE_COST',cycleId:pending.cycleId,expectedFingerprint:pending.requestFingerprint,
      resolution:{kind:resolution,costNanoUsd:resolution==='CONFIRMED_NO_CHARGE'?0:costNano(cost),providerResponseId:resolution==='CONFIRMED_NO_CHARGE'?null:providerId},evidenceDigest:evidence});}catch(error){onError(error.message);}}}
      style={{display:'grid',gap:12,padding:18,border:'1px solid #ddd6fe',borderRadius:12,minWidth:0}} aria-label="Reconciliar custo pendente">
      <h3>Registrar evidência de custo</h3><p style={{overflowWrap:'anywhere'}}>Ciclo pendente: {pending.cycleId}. Use somente evidência conferida do provedor. Esta ação não habilita chamadas pagas.</p>
      <label style={field}>Resultado confirmado<select value={resolution} onChange={event=>setResolution(event.target.value)}><option value="CONFIRMED_NO_CHARGE">Sem cobrança confirmada</option><option value="CONFIRMED_USAGE">Uso e custo confirmados</option></select></label>
      {resolution==='CONFIRMED_USAGE'?<><label style={field}>Custo confirmado em USD<input required inputMode="decimal" value={cost} onChange={event=>setCost(event.target.value)}/></label>
        <label style={field}>Identificador da resposta do provedor<input required pattern="resp_[A-Za-z0-9_-]{1,160}" value={providerId} onChange={event=>setProviderId(event.target.value)}/></label></>:null}
      <label style={field}>SHA-256 da evidência verificada<input required pattern="[a-f0-9]{64}" maxLength={64} value={evidence} onChange={event=>setEvidence(event.target.value)}/></label>
      <button type="submit" disabled={busy} style={button}>Registrar reconciliação</button>
    </form>;
}

export default function PlatformRobotCycleAdmin({readOnly=false,showAccessNotice=false}){
  const [feed,setFeed]=useState(null),[status,setStatus]=useState('loading'),[busy,setBusy]=useState(false);
  const [notice,setNotice]=useState(''),[preview,setPreview]=useState(null);
  const inFlight=useRef(null),epoch=useRef(0),alive=useRef(true),retry=useRef(null);
  const authIdentity=useRef(undefined);
  async function request(action){
    if(inFlight.current)return;
    const controller=new AbortController(),current=++epoch.current;inFlight.current={controller,current};setBusy(true);
    const active=()=>alive.current&&current===epoch.current;
    try{
      const session=await platformSupabase?.auth?.getSession(),token=session?.data?.session?.access_token;
      if(session?.error||!token){if(active()){setStatus('disabled');setFeed(null);}return;}
      const headers={Authorization:`Bearer ${token}`};
      if(action)headers['Content-Type']='application/json';
      const response=await fetch('/api/platform/admin/robot-evolution-cycle',{method:action?'POST':'GET',headers,
        body:action?JSON.stringify(action):undefined,cache:'no-store',redirect:'error',signal:controller.signal});
      if([401,403,404].includes(response.status)){if(active()){setStatus('disabled');setFeed(null);setPreview(null);}return;}
      const data=await response.json();
      if(!response.ok)throw new Error(data?.error||'O ciclo está indisponível.');
      if(!active())return;
      if(action){
        if(data.schema!=='JENIOS_R65_ADMIN_ACTION_V1'||data.action!==action.action||data.productionChanged!==false)throw new Error('Resposta administrativa inválida.');
        retry.current=null;
        if(action.action==='ARCHIVE_PREVIEW')setPreview(data.result);
        if(action.action==='ARCHIVE_COMMIT')setPreview(null);
        setNotice(action.action==='ARCHIVE_PREVIEW'?'Prévia preparada. Confira as quantidades antes de arquivar.':'Ação registrada. Atualizando o relatório…');
        const updated=await fetch('/api/platform/admin/robot-evolution-cycle',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:controller.signal});
        if([401,403,404].includes(updated.status)){if(active()){setStatus('disabled');setFeed(null);}return;}
        if(!updated.ok)throw new Error('Ação registrada; atualize o relatório para consultar o estado.');
        const next=requireR65AdminFeed(await updated.json());if(active()){setFeed(next);setStatus('ready');}
      }else{const next=requireR65AdminFeed(data);if(active()){setFeed(next);setStatus('ready');}}
    }catch(error){if(active()){setNotice(error.message||'Não foi possível confirmar o resultado. Atualize o relatório.');if(!feed)setStatus('error');}}
    finally{if(inFlight.current?.current===current){inFlight.current=null;if(alive.current)setBusy(false);}}
  }
  function act(body){
    if(inFlight.current)return;
    // Retain the exact command across a transport failure; do not mint a second operation.
    const signature=JSON.stringify(body);
    const value=retry.current?.signature===signature?retry.current.value:
      (['ROLLBACK','ARCHIVE_COMMIT','RECONCILE_COST'].includes(body.action)?{...body,operationId:operationId()}:body);
    retry.current={signature,value};void request(value);
  }
  useEffect(()=>{
    alive.current=true;void request();
    const visible=()=>{if(document.visibilityState==='visible')void request();};
    const timer=setInterval(visible,60000);document.addEventListener('visibilitychange',visible);
    let authTimer;
    const authListener=platformSupabase?.auth?.onAuthStateChange((event,session)=>{
      const identity=session?.user?.id??null;
      const changed=event==='SIGNED_OUT'||(authIdentity.current!==undefined&&identity!==authIdentity.current);
      authIdentity.current=identity;
      if(!changed)return;
      epoch.current++;inFlight.current?.controller.abort();inFlight.current=null;retry.current=null;
      setFeed(null);setPreview(null);setNotice('');setBusy(false);setStatus('loading');
      clearTimeout(authTimer);authTimer=setTimeout(()=>{if(alive.current)void request();},0);
    });
    return()=>{alive.current=false;epoch.current++;inFlight.current?.controller.abort();inFlight.current=null;clearInterval(timer);clearTimeout(authTimer);authListener?.data?.subscription?.unsubscribe();document.removeEventListener('visibilitychange',visible);};
  },[]);
  if(status==='disabled')return showAccessNotice?<p role="status">Entre com uma conta administrativa da Platform para consultar o ciclo de QA.</p>:null;
  const pending=feed?.pendingReconciliations[0],state=feed?.state;
  return <section aria-label="Administração do ciclo de evolução" style={{display:'grid',gap:16,minWidth:0}}>
    <h2 style={{fontSize:20}}>Ciclo de evolução em homologação</h2>
    <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
      <button type="button" disabled={busy} style={button} onClick={()=>void request()}>Atualizar ciclo</button>
      {!readOnly?<button type="button" disabled={busy} style={button} onClick={()=>act({action:'TICK'})}>Avançar ciclo de QA</button>:null}
      {!readOnly&&state?.activeVersion.maxAgeMs===500?<button type="button" disabled={busy} style={button} onClick={()=>act({action:'ROLLBACK',expectedRevision:state.revision,previousDigest:state.stateDigest,reason:'OWNER_REQUEST'})}>Restaurar configuração anterior</button>:null}
    </div>
    {status==='loading'?<p role="status">Consultando o ciclo persistido…</p>:null}
    {notice?<p role="status">{notice}</p>:null}
    {feed?<PlatformRobotCycleReport feed={feed}/>:null}
    {!readOnly&&feed?<section style={{padding:18,border:'1px solid #ddd6fe',borderRadius:12}} aria-label="Preparar arquivamento">
      <h3>Preparar arquivo verificável</h3>
      <p>A prévia inclui até dez eventos e dez ciclos elegíveis. Os originais serão preservados.</p>
      <button type="button" disabled={busy} style={button} onClick={()=>act({action:'ARCHIVE_PREVIEW',cutoffMs:Date.now(),limit:10})}>Preparar prévia</button>
      {preview?<div style={{overflowWrap:'anywhere'}}><p>{preview.eventCount} evento(s) e {preview.cycleCount} ciclo(s). Identificador de integridade: {preview.manifestDigest}</p>
        <button type="button" disabled={busy} style={button} onClick={()=>act({action:'ARCHIVE_COMMIT',archiveId:preview.archiveId,manifestDigest:preview.manifestDigest})}>Confirmar arquivo desta prévia</button></div>:null}
    </section>:null}
    {!readOnly&&pending?<CostReconciliationForm key={`${pending.cycleId}:${pending.requestFingerprint}`} pending={pending} busy={busy} onAction={act} onError={setNotice}/>:null}
  </section>;
}
