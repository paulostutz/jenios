'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase as socialClient} from '../../../lib/supabase';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {resolveSocialReportGate} from '../../../lib/reports/social-report-gate.mjs';
import {inspectIndependentSessions} from '../../../lib/platform/identity-inspection.mjs';

export default function PlatformIdentityInspection(){
 const [state,setState]=useState(null);
 const seq=useRef(0);
 useEffect(()=>{
  let mounted=true;
  async function refresh(){
   const revision=++seq.current;
   try{
    const next=await inspectIndependentSessions({
     socialClient,platformClient:platformSupabase,socialProfileGate:resolveSocialReportGate
    });
    if(mounted&&revision===seq.current)setState(next);
   }catch{if(mounted&&revision===seq.current)setState(null);}
  }
  void refresh();
  const onFocus=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener('focus',onFocus);
  const s=socialClient?.auth?.onAuthStateChange?.(event=>{
   if(event!=='TOKEN_REFRESHED'&&event!=='INITIAL_SESSION')void refresh();
  });
  const p=platformSupabase?.auth?.onAuthStateChange?.(event=>{
   if(event!=='TOKEN_REFRESHED'&&event!=='INITIAL_SESSION')void refresh();
  });
  return()=>{mounted=false;seq.current++;
   window.removeEventListener('focus',onFocus);
   s?.data?.subscription?.unsubscribe?.();
   p?.data?.subscription?.unsubscribe?.();
  };
 },[]);
 return <section aria-label="Estado dos acessos" role="status"
   style={{margin:'14px 0',padding:'15px 17px',background:'#faf8ff',border:'1px solid #ddd6fe',borderRadius:12}}>
  <strong style={{fontSize:14,color:'#4c1d95'}}>Identidades verificadas</strong>
  {!state?<p style={{fontSize:12}}>Consultando provedores independentes…</p>:<>
   <p style={{fontSize:12,marginBottom:7}}>Social: {state.socialVerified?'verificada':'não verificada'} · Platform: {state.platformVerified?'verificada':'não verificada'}.</p>
   <p style={{fontSize:12,margin:0}}>Vínculo entre os dois bancos: <strong>não certificado</strong>.
    {' '}Acesso Social libera somente simulação; diagnóstico privado, administração e assinaturas dependem de autorização própria.</p>
  </>}
 </section>;
}
