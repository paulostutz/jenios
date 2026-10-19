'use client';
import {useEffect,useRef,useState} from 'react';
import {platformAdminFetch} from './PlatformAdminAccess';

const configs=[
 {key:'diagnostics',name:'Diagnósticos registrados',note:'Laudos da Platform confirmados no banco'},
 {key:'riskEvents',name:'Eventos de risco registrados',note:'Registros do backend, sem projeções financeiras'},
 {key:'adminPermissions',name:'Autorizações administrativas',note:'Permissões concedidas, não quantidade de usuários'}
];

export default function PlatformAdminOverview(){
 const [data,setData]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const alive=useRef(true),epoch=useRef(0);
 async function reload(){
  const rev=++epoch.current;setBusy(true);setError('');
  try{
   const result=await(await platformAdminFetch('/api/platform/admin/overview')).json();
   if(!result || result.verified!==true || result.source!=='platform_dedicated_database'
       || configs.some(({key})=>!Number.isSafeInteger(result[key])||result[key]<0))throw Error('Dados não verificáveis.');
   if(alive.current&&rev===epoch.current)setData(result);
  }catch{
   if(alive.current&&rev===epoch.current){setData(null);setError('Não foi possível confirmar os indicadores do banco exclusivo da Platform.');}
  }finally{if(alive.current&&rev===epoch.current)setBusy(false);}
 }
 useEffect(()=>{alive.current=true;void reload();return()=>{alive.current=false;epoch.current++;};},[]);
 return <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:'clamp(18px,3vw,26px)',display:'grid',gap:16}}>
  <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
   <div><h2 style={{margin:0,fontSize:19}}>Indicadores da homologação</h2>
    <p style={{margin:'5px 0 0',color:'#64748b',fontSize:12}}>Somente totais do Supabase exclusivo da Platform</p></div>
   <button type="button" disabled={busy} onClick={()=>void reload()} style={{border:0,borderRadius:10,background:'#6d28d9',color:'white',fontWeight:800,padding:'10px 14px',cursor:'pointer'}}>{busy?'Consultando…':'Atualizar indicadores'}</button>
  </header>
  {error&&<p role="alert" style={{background:'#fff7ed',padding:12,color:'#92400e',borderRadius:10,fontSize:12}}>{error}</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
   {configs.map(c=><article key={c.key} style={{border:'1px solid #ddd6fe',background:'#faf9ff',padding:17,borderRadius:12}}>
     <strong style={{fontSize:26,color:'#4c1d95'}}>{data?data[c.key].toLocaleString('pt-BR'):'—'}</strong>
     <h3 style={{margin:'6px 0',fontSize:13}}>{c.name}</h3>
     <p style={{margin:0,fontSize:11,color:'#64748b',lineHeight:1.55}}>{c.note}</p>
   </article>)}
  </div>
  <p role="status" style={{fontSize:11,color:'#64748b',margin:0}}>{busy?'Consultando informações autenticadas…':data?'Dados verificados no servidor; última consulta: '+new Date(data.updatedAt).toLocaleString('pt-BR'):'Nenhum número foi presumido.'}</p>
  <p style={{fontSize:11,color:'#64748b',margin:0}}>O número de eventos não é um valor de losses evitados. Para esse cálculo, precisamos de evidência e metodologia auditadas.</p>
 </section>;
}
