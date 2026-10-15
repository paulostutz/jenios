'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {readReceipt} from '../../lib/pay/browser-receipts.mjs';
export default function BankscorePaidReport({orderId}){
  const [codigo,setCodigo]=useState(''),[periodo,setPeriodo]=useState(''),[report,setReport]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const epoch=useRef(0);
  useEffect(()=>{
    const version=++epoch.current;setReport(null);setCodigo('');setPeriodo('');setMessage('');setBusy(false);
    supabase?.auth.getSession().then(({data})=>{if(version!==epoch.current||!data?.session)return;const receipt=readReceipt(window.sessionStorage,data.session.user.id,orderId);if(receipt?.productCode==='social-bankscore-report'){setCodigo(String(receipt.target?.codigo||''));setPeriodo(String(receipt.target?.periodo||''));}});
    const subscription=supabase?.auth.onAuthStateChange(event=>{if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;epoch.current++;setReport(null);setCodigo('');setPeriodo('');setMessage('Conta atualizada. Informe os dados do pedido desta conta.');setBusy(false);});
    return()=>{epoch.current++;subscription?.data?.subscription?.unsubscribe();};
  },[orderId]);
  async function issue(format='json'){
    const version=++epoch.current;setBusy(true);setMessage('');setReport(null);
    try{
      if(!supabase)throw Error('Entre na sua conta para emitir o laudo.');
      const {data}=await supabase.auth.getSession();if(!data?.session)throw Error('Entre na conta que realizou a contratação.');
      const response=await fetch('/api/bankscore/detailed',{method:'POST',cache:'no-store',headers:{'content-type':'application/json',authorization:'Bearer '+data.session.access_token},body:JSON.stringify({orderId,target:{codigo,periodo},format})});
      if(!response.ok){const body=await response.json();throw Error(body.error||'Não foi possível emitir o laudo.');}
      if(format==='json'){const body=await response.json();if(version===epoch.current)setReport(body.report);}
      else{const blob=await response.blob();if(version!==epoch.current)return;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='jenios-bankscore-detalhado.pdf';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);}
    }catch(error){if(version===epoch.current)setMessage(error.message);}
    finally{if(version===epoch.current)setBusy(false);}
  }
  function change(setter,value){epoch.current++;setReport(null);setMessage('');setBusy(false);setter(value);}
  return <section style={{background:'#fff',borderRadius:16,padding:24,color:'#172033'}}>
    <h1>Laudo BankScore contratado</h1><p>Indicador de capitalização disponível, interpretação e histórico. Não é análise financeira completa nem rating. O período e a instituição devem ser os mesmos da contratação.</p>
    <small>Pedido: {orderId||'não informado'}</small>
    <form onSubmit={event=>{event.preventDefault();issue();}} style={{display:'grid',gap:12,marginTop:16}}>
      <label>Código da instituição<input required value={codigo} onChange={event=>change(setCodigo,event.target.value)} maxLength={13} style={{display:'block',padding:10}}/></label>
      <label>Período contratado (AAAAMM)<input required value={periodo} onChange={event=>change(setPeriodo,event.target.value)} pattern="[0-9]{6}" maxLength={6} style={{display:'block',padding:10}}/></label>
      <button disabled={busy||!orderId}>{busy?'Consultando…':'Abrir laudo'}</button>
      <button type="button" disabled={busy||!orderId||!codigo||!periodo} onClick={()=>issue('pdf')}>Baixar PDF</button>
    </form>
    {message&&<p role="alert">{message}</p>}
    {report&&<article><h2>{report.instituicao.nome}</h2><p>Referência: {report.instituicao.periodo} · Basileia provisória: {report.instituicao.percentual}%</p><p><strong>{report.classificacao}</strong></p><p>{report.interpretacao}</p><p>{report.criterio}</p><h3>Histórico disponível</h3>{report.historico.map(item=><p key={item.periodo}>{item.periodo}: {item.percentual===null?'Sob revisão':item.percentual+'%'} · {item.revisao}</p>)}{report.evolucao&&<p>Diferença ante {report.evolucao.periodoAnterior}: {report.evolucao.diferencaPontosPercentuais} pontos percentuais.</p>}<p>{report.conclusao}</p><h3>Limites e verificações</h3><ul>{report.pendencias.map(item=><li key={item}>{item}</li>)}</ul><p>Fonte: {report.fonte}. Emissão: {new Date(report.emitidoEm).toLocaleString('pt-BR')}.</p></article>}
  </section>;
}
