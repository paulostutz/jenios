'use client';
import {useEffect,useRef,useState} from 'react';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {fetchR63AdminFeed,requireR63AdminFeed} from '../../../lib/platform/research/robot-r63-admin-client.mjs';
import PlatformRobotEvolutionReport from './PlatformRobotEvolutionReport';

/** Existing PlatformAdminAccess controls rendering; API rechecks authorization. */
export default function PlatformRobotEvolutionAdmin(){
  const [reports,setReports]=useState([]),[status,setStatus]=useState('loading');
  const epoch=useRef(0),alive=useRef(true),inFlight=useRef(null);
  async function reload(){
    if(inFlight.current)return;
    const current=++epoch.current,controller=new AbortController();inFlight.current={current,controller};
    try{
      const response=await fetchR63AdminFeed({getSession:()=>platformSupabase?.auth?.getSession(),signal:controller.signal});
      if([401,403,404].includes(response.status)){if(alive.current&&epoch.current===current){setReports([]);setStatus('disabled');}return;}
      if(!response.ok)throw Error('R63_REPORT_UNAVAILABLE');
      const data=requireR63AdminFeed(await response.json());
      if(alive.current&&epoch.current===current){setReports(data.reports);setStatus('ready');}
    }catch{if(alive.current&&epoch.current===current){setReports([]);setStatus('error');}}
    finally{if(inFlight.current?.current===current)inFlight.current=null;}
  }
  useEffect(()=>{
    alive.current=true;void reload();
    const refresh=()=>{if(document.visibilityState==='visible')void reload();};
    const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
    return()=>{alive.current=false;epoch.current++;inFlight.current?.controller.abort();inFlight.current=null;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  if(status==='disabled')return null;
  return <section aria-label="Relatórios de melhoria contínua" style={{display:'grid',gap:14,minWidth:0}}>
    <div style={{display:'flex',gap:12,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
      <h2 style={{fontSize:19}}>Relatórios de melhoria contínua</h2>
      <button type="button" onClick={()=>void reload()} style={{padding:10,borderRadius:8,border:'1px solid #c4b5fd',background:'#fff'}}>Atualizar relatórios</button>
    </div>
    {status==='loading'?<p role="status">Consultando relatórios administrativos…</p>:null}
    {status==='error'?<p role="alert">Relatórios indisponíveis. Nenhuma melhoria foi presumida.</p>:null}
    {status==='ready'&&!reports.length?<p role="status">Ainda não há relatórios no registro privado de pesquisa.</p>:null}
    {reports.length?<PlatformRobotEvolutionReport report={reports.at(-1)}/>:null}
  </section>;
}
