'use client';
import BankscoreFinancialAppendix from './BankscoreFinancialAppendix';
import {downloadVerifiedReportPdf} from '../../lib/reports/pdf-download.mjs';
import ReportAccountGate from './ReportAccountGate';
import {isPrelaunchReport} from '../../lib/reports/prelaunch.mjs';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {readReceipt} from '../../lib/pay/browser-receipts.mjs';
export default function BankscorePaidReport(props){
 const prelaunch=!props.admin&&isPrelaunchReport('social-bankscore-report');
 return prelaunch?<ReportAccountGate><BankscoreReportContent {...props} prelaunch/></ReportAccountGate>:<BankscoreReportContent {...props}/>;
}
function BankscoreReportContent({orderId,admin=false,prelaunch=false,initialCodigo='',initialPeriodo=''}){
 const [codigo,setCodigo]=useState(''),[periodo,setPeriodo]=useState(''),[report,setReport]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const epoch=useRef(0);
 useEffect(()=>{
  const version=++epoch.current;setReport(null);setCodigo(initialCodigo);setPeriodo(initialPeriodo);setMessage('');setBusy(false);
  Promise.resolve(supabase?.auth.getSession()).then(result=>{const data=result?.data;if(version!==epoch.current)return;const receipt=readReceipt(window.sessionStorage,data?.session?.user?.id||'guest',orderId);if(receipt?.productCode==='social-bankscore-report'&&!initialCodigo){setCodigo(String(receipt.target?.codigo||''));setPeriodo(String(receipt.target?.periodo||''));}});
  const subscription=supabase?.auth.onAuthStateChange(event=>{if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;epoch.current++;setReport(null);setCodigo('');setPeriodo('');setMessage('Conta atualizada. Confira os dados da consulta e emita novamente.');setBusy(false);});
  return()=>{epoch.current++;subscription?.data?.subscription?.unsubscribe();};
 },[orderId,initialCodigo,initialPeriodo]);
 async function issue(format='json'){
  const version=++epoch.current;setBusy(true);setMessage('');setReport(null);
  try{
   const result=await supabase?.auth.getSession();if(result?.error)throw Error('Não foi possível verificar sua sessão.');const data=result?.data;
   if(prelaunch&&(!data?.session?.access_token||data.session.user?.is_anonymous))throw Error('Entre na sua conta da Social para emitir o relatório.');
   const response=await fetch(admin?'/api/admin/consultas':'/api/bankscore/detailed',{method:'POST',cache:'no-store',headers:{'content-type':'application/json',...(data?.session?.access_token?{authorization:'Bearer '+data.session.access_token}:{})},body:JSON.stringify({kind:'bankscore',orderId,target:{codigo,periodo},format})});
   if(!response.ok){const body=await response.json();throw Error(body.error||'Não foi possível emitir o laudo.');}
   if(format==='json'){const body=await response.json();if(version===epoch.current)setReport(body.report);}
   else{await downloadVerifiedReportPdf(response,'jenios-bankscore-detalhado.pdf',{isCurrent:()=>version===epoch.current});}
  }catch(error){if(version===epoch.current)setMessage(error.message);}
  finally{if(version===epoch.current)setBusy(false);}
 }
 function change(setter,value){epoch.current++;setReport(null);setMessage('');setBusy(false);setter(value);}
 return <section style={{background:'#fff',borderRadius:16,padding:24,color:'#172033'}}>
  <h1>{admin?'Consulta administrativa BankScore':prelaunch?'Laudo completo BankScore':'Laudo BankScore contratado'}</h1><p>Capitalização, histórico e dados contábeis disponíveis para o período informado. A cobertura e as pendências são informadas no laudo; não é rating de crédito. {!admin&&!prelaunch&&'O período e a instituição devem ser os mesmos da contratação.'}</p>
  {prelaunch&&<p><strong>Gratuito no pré-lançamento.</strong> Sua conta na Social dá acesso à visualização e ao download em PDF, sem cobrança.</p>}
  {!admin&&!prelaunch&&<small>Pedido: {orderId||'não informado'}</small>}
  <form onSubmit={event=>{event.preventDefault();issue();}} style={{display:'grid',gap:12,marginTop:16}}>
   <label>Código da instituição<input required value={codigo} onChange={event=>change(setCodigo,event.target.value)} maxLength={13} style={{display:'block',padding:10}}/></label>
   <label>Período (AAAAMM)<input required value={periodo} onChange={event=>change(setPeriodo,event.target.value)} pattern="[0-9]{6}" maxLength={6} style={{display:'block',padding:10}}/></label>
   <button disabled={busy||(!admin&&!prelaunch&&!orderId)}>{busy?'Consultando…':'Abrir laudo'}</button>
   <button type="button" disabled={busy||(!admin&&!prelaunch&&!orderId)||!codigo||!periodo} onClick={()=>issue('pdf')}>Baixar PDF</button>
  </form>
  {message&&<p role="alert">{message}</p>}
  {report&&<article><h2>{report.instituicao.nome}</h2><p>Referência: {report.instituicao.periodo} · Basileia provisória: {report.instituicao.percentual}%</p><p><strong>{report.classificacao}</strong></p><p>{report.interpretacao}</p><p>{report.criterio}</p><BankscoreFinancialAppendix data={report.financial}/><h3>Fundamentos técnicos</h3><ul>{report.fundamentos.map(item=><li key={item}>{item}</li>)}</ul><p>{report.metodologia}</p><h3>Histórico disponível</h3>{report.historico.map(item=><p key={item.periodo}>{item.periodo}: {item.percentual===null?'Sob revisão':item.percentual+'%'} · {item.revisao}</p>)}{report.evolucao&&<p>Diferença ante {report.evolucao.periodoAnterior}: {report.evolucao.diferencaPontosPercentuais} pontos percentuais.</p>}<p>{report.conclusao}</p>{report.coverageNotice&&<p>{report.coverageNotice}</p>}{report.coverage&&<section><h3>Cobertura dos dados</h3><p>{report.coverage.reason}</p>{report.coverage.dimensions.map(x=><p key={x.label}><strong>{x.label}:</strong> {x.explanation}</p>)}<h3>Indicadores complementares disponíveis</h3>{report.coverage.supplementalIndicators.map((x,i)=><p key={i}>{x.name||x.code}: {x.rawValue??'Não informado'} · Unidade: {x.unit}</p>)}</section>}<h3>Limites e verificações</h3><ul>{report.pendencias.map(item=><li key={item}>{item}</li>)}</ul><p>Fonte: {report.fonte}. Emissão: {new Date(report.emitidoEm).toLocaleString('pt-BR')}.</p></article>}
 </section>;
}
