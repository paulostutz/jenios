'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';

const API='/api/platform/admin/robots/host-health';
const LOGIN='/platform/entrar?dedicated=1&next=/platform/admin/robos';
const card={background:'#fff',border:'1px solid #dce3ef',borderRadius:16,padding:'clamp(18px,3vw,25px)',color:'#17233b'};
const labels={
 SYNTHETIC_ACTIVE:'Núcleo privado ativo em simulação',
 STALE:'Host sem atualização recente',
 DEGRADED:'Host com atividade degradada',
 UNVERIFIED:'Estado não verificado — revisão necessária',
 NOT_CONFIGURED:'Host ainda não registrado'
};
function validate(value){
 const host=value?.host;
 if(value?.schema!=='JENIOS_R76_PRIVATE_HOST_HEALTH_V1'||value.ok!==true||
  value.canPlaceOrders!==false||value.executionCertified!==false||value.brokerAccountVerified!==false||
  value.ownerFundsCustodied!==false||!Object.hasOwn(labels,host?.state)||
  typeof value.checkedAt!=='string'||!Number.isFinite(Date.parse(value.checkedAt))||
  typeof host.configurationAlert!=='boolean'||typeof host.errorReported!=='boolean'||
  (host.realOrdersSent!==null&&(!Number.isSafeInteger(host.realOrdersSent)||host.realOrdersSent<0))||
  (host.paperOrdersSent!==null&&(!Number.isSafeInteger(host.paperOrdersSent)||host.paperOrdersSent<0)))
  throw Error('INVALID_HOST_STATUS');
 return host;
}
const time=x=>x?new Date(x).toLocaleString('pt-BR'):'Não informada';
export default function PlatformRobotHostHealth(){
 const [view,setView]=useState({phase:'loading',host:null});
 const revision=useRef(0),controller=useRef(null),alive=useRef(false),authTimer=useRef(null);
 const refresh=useCallback(async()=>{
  if(!alive.current)return;
  const requestId=++revision.current;
  controller.current?.abort();
  const pending=new AbortController();
  controller.current=pending;
  const active=()=>alive.current&&requestId===revision.current;
  setView({phase:'loading',host:null});
  try{
   const first=await platformSupabase?.auth?.getSession(),session=first?.data?.session;
   if(!active())return;
   if(first?.error||!session?.user?.id||session.user.is_anonymous||!session.access_token){
    setView({phase:'access',host:null});return;
   }
   const response=await fetch(API,{headers:{Authorization:'Bearer '+session.access_token},
    cache:'no-store',redirect:'error',signal:pending.signal});
   if(!active())return;
   if([401,403].includes(response.status)){setView({phase:'access',host:null});return;}
   if(!response.ok)throw Error('HOST_UNAVAILABLE');
   const host=validate(await response.json()),latest=await platformSupabase.auth.getSession();
   if(!active())return;
   if(latest.error||latest.data?.session?.user?.id!==session.user.id||
    latest.data?.session?.user?.is_anonymous||latest.data?.session?.access_token!==session.access_token){
    setView({phase:'access',host:null});return;
   }
   setView({phase:'ready',host});
  }catch(e){if(active()&&e.name!=='AbortError')setView({phase:'error',host:null});}
 },[]);
 useEffect(()=>{
  alive.current=true;
  const subscription=platformSupabase?.auth?.onAuthStateChange(event=>{
   if(!['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))return;
   ++revision.current;controller.current?.abort();
   setView({phase:'loading',host:null});
   clearTimeout(authTimer.current);
   authTimer.current=setTimeout(()=>{void refresh();},0);
  });
  void refresh();
  return()=>{alive.current=false;++revision.current;controller.current?.abort();
   clearTimeout(authTimer.current);subscription?.data?.subscription?.unsubscribe?.();};
 },[refresh]);
 const host=view.host;
 return <section style={card} aria-labelledby="jenios-r76-host-title">
  <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',alignItems:'center',gap:12}}>
   <h2 id="jenios-r76-host-title" style={{margin:0,fontSize:20}}>Motor privado R74</h2>
   <button type="button" onClick={()=>void refresh()} disabled={view.phase==='loading'}
    style={{border:'1px solid #d5dbea',borderRadius:9,padding:'9px 14px',background:'#fff',color:'#42358a'}}>
    Atualizar estado</button>
  </div>
  <p style={{color:'#526079',fontSize:14,lineHeight:1.6}}>
   Esta consulta mostra a atividade registrada no servidor. Não envia ordens nem altera configurações da corretora.</p>
  {view.phase==='loading'?<p role="status">Conferindo o host...</p>:null}
  {view.phase==='access'?<p role="status">Entre com acesso exclusivo da Platform. <Link href={LOGIN}>Fazer login</Link></p>:null}
  {view.phase==='error'?<p role="alert">Não foi possível confirmar a atividade do host.</p>:null}
  {host?<div style={{display:'grid',gap:8,fontSize:14}}>
   <strong>{labels[host.state]}</strong>
   <div>Último sinal: {time(host.heartbeatAt)}</div>
   <div>Último ciclo: {time(host.cycleAt)}</div>
   <div>Ordens reais registradas: {host.realOrdersSent??'Não verificado'}</div>
   <div>Ordens Paper externas registradas: {host.paperOrdersSent??'Não verificado'}</div>
   {host.configurationAlert?<p role="alert" style={{color:'#991b1b'}}>Configuração ou contadores inconsistentes; revisar os bloqueios de execução.</p>:null}
   {host.errorReported?<p role="alert" style={{color:'#991b1b'}}>O servidor registrou uma ocorrência. Verificar os logs administrativos.</p>:null}
   <p style={{marginBottom:0,color:'#7c2d12',fontWeight:700}}>
    Negociação real não homologada. Ciclos sintéticos não representam operações ou resultados financeiros de clientes.</p>
  </div>:null}
 </section>;
}
