'use client';
import {useEffect,useState} from 'react';
import {readSimJournal} from '../../../lib/platform/simulation-journal.mjs';
import {readSimulationPaused} from '../../../lib/platform/simulation-account.mjs';
import {observeSimulatedBehavior} from '../../../lib/platform/behavioral-observation.mjs';
export default function PlatformBehaviorReview({userId,diagnostic=null}){
 const [result,setResult]=useState(null);
 useEffect(()=>{
  function update(){
   if(!userId){setResult(null);return;}
   setResult(observeSimulatedBehavior({
    initialDiagnostic:diagnostic,
    events:readSimJournal(window.sessionStorage,userId),
    paused:readSimulationPaused(window.sessionStorage,userId),
    selectedMode:diagnostic?.verified?diagnostic.mode:'manual'
   }));
  }
  update();
  const focus=()=>{if(document.visibilityState==='visible')update();};
  window.addEventListener('focus',focus);
  document.addEventListener('visibilitychange',focus);
  return()=>{window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[userId,diagnostic?.verified,diagnostic?.mode]);
 return <section style={{marginTop:12,padding:17,borderRadius:12,border:'1px solid #d5cbef',background:'#fff'}} aria-label="Revisão comportamental educativa">
  <h2 style={{fontSize:17,margin:'0 0 7px'}}>Revisão de decisões simuladas</h2>
  {!result?<p role="status" style={{fontSize:12}}>Entre na simulação para consultar as intenções desta sessão.</p>:<>
   <p style={{fontSize:12}}>Intenções locais: <strong>{result.intentions}</strong>
    {' '}· Intervalos curtos: {result.rapidSequences}
    {' '}· Ativos em observação: {result.trackedAssets}</p>
   <p style={{fontSize:12}}>Laudo inicial da Platform: {result.diagnosticVerified?'confirmado no servidor':'não confirmado nesta conta'}.</p>
   <ul style={{fontSize:12,lineHeight:1.65,paddingLeft:18}}>
    {result.notes.map((note,i)=><li key={i}>{note}</li>)}
   </ul>
   <small style={{color:'#64748b'}}>Sem inferir desempenho, lucro, perda evitada ou condição clínica. Informações exclusivamente educacionais.</small>
  </>}
 </section>;
}
