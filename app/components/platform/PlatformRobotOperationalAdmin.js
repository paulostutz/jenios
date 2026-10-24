'use client';
import {useEffect,useRef,useState} from 'react';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {requireR64AdminFeed} from '../../../lib/platform/research/robot-r64-admin-view.mjs';
import PlatformRobotOperationalReport from './PlatformRobotOperationalReport';

export default function PlatformRobotOperationalAdmin(){
  const [feed,setFeed]=useState(null),[status,setStatus]=useState('loading');
  const inFlight=useRef(null),epoch=useRef(0),alive=useRef(true);
  async function refresh(){
    if(inFlight.current)return;
    const controller=new AbortController(),current=++epoch.current;inFlight.current={controller,current};
    const update=(next,data=null)=>{if(alive.current&&current===epoch.current){setStatus(next);setFeed(data);}};
    try{
      const session=await platformSupabase?.auth?.getSession(),token=session?.data?.session?.access_token;
      if(session?.error||!token){update('disabled');return;}
      const response=await fetch('/api/platform/admin/robot-observations',{headers:{Authorization:`Bearer ${token}`},
        cache:'no-store',redirect:'error',signal:controller.signal});
      if([401,403,404].includes(response.status)){update('disabled');return;}
      if(!response.ok)throw new Error('R64_UNAVAILABLE');
      update('ready',requireR64AdminFeed(await response.json()));
    }catch{update('error');}
    finally{if(inFlight.current?.current===current)inFlight.current=null;}
  }
  useEffect(()=>{
    alive.current=true;void refresh();
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};
    const timer=setInterval(visible,60000);document.addEventListener('visibilitychange',visible);
    return()=>{alive.current=false;epoch.current++;inFlight.current?.controller.abort();inFlight.current=null;
      clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[]);
  if(status==='disabled')return null;
  const latest=feed?.reports?.reduce((a,b)=>!a||b.generatedAtMs>a.generatedAtMs?b:a,null);
  return <section aria-label="Observação operacional em homologação" style={{display:'grid',gap:14,minWidth:0}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
      <h2 style={{fontSize:19}}>Observação operacional em homologação</h2>
      <button type="button" onClick={()=>void refresh()} style={{padding:10,borderRadius:8,border:'1px solid #c4b5fd',background:'#fff'}}>Atualizar observações</button>
    </div>
    {status==='loading'?<p role="status">Consultando registros persistidos…</p>:null}
    {status==='error'?<p role="alert">Observações indisponíveis. Nenhuma análise foi presumida.</p>:null}
    {feed?.pendingCycles>0?<p role="alert">Há {feed.pendingCycles} ciclo(s) em processamento ou aguardando reconciliação. Uma chamada incerta não será repetida automaticamente.</p>:null}
    {status==='ready'&&!latest?<p role="status">Ainda não há relatório concluído para este escopo de QA.</p>:null}
    {latest?<PlatformRobotOperationalReport report={latest}/>:null}
  </section>;
}
