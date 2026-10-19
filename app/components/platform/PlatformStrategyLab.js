'use client';
import {useEffect,useRef,useState} from 'react';
import {studyHistoricalCandles} from '../../../lib/platform/market-study.mjs';
import {inspectHistoricalBars} from '../../../lib/platform/historical-quality.mjs';
import {replayHistoricalScenario} from '../../../lib/platform/paper-replay.mjs';
import {assessPaperStrategy,simulationModeLabels} from '../../../lib/platform/paper-policy.mjs';
import {readSimulatedBalance,readSimulationPaused} from '../../../lib/platform/simulation-account.mjs';
import {readSimJournal} from '../../../lib/platform/simulation-journal.mjs';
import {observeSimulatedBehavior} from '../../../lib/platform/behavioral-observation.mjs';
import {multiTimeframeStudy} from '../../../lib/platform/multi-timeframe-study.mjs';
import {evaluateRollingPaperWindows} from '../../../lib/platform/rolling-paper-validation.mjs';
import {auditLocalProspectiveCohort,prospectiveReadinessLabel} from '../../../lib/platform/prospective-cohort.mjs';
import {captureProspectiveObservation,readProspectiveObservations,prospectiveCoverage} from '../../../lib/platform/prospective-observation.mjs';

const inputCss={width:'100%',boxSizing:'border-box',background:'#fff',border:'1px solid #cbd5e1',padding:10,borderRadius:8,font:'inherit'};
const panelCss={border:'1px solid #d8cafa',borderRadius:16,padding:'clamp(14px,3vw,22px)',background:'#fff',margin:'20px 0',color:'#172033'};
function parseLocalBars(text){
 if(text.length>180000)throw Error('O arquivo é muito grande para o laboratório.');
 try{
  const j=JSON.parse(text);
  return Array.isArray(j)?j:j?.candles;
 }catch{
  const lines=text.trim().split(/\r?\n/);
  if(lines.length<61||lines.length>501)throw Error('Use JSON ou CSV com 60 a 500 candles.');
  const header=lines.shift().split(',').map(x=>x.trim().toLowerCase());
  if(header.join(',')!=='time,open,high,low,close,volume')throw Error('CSV deve ter colunas: time,open,high,low,close,volume.');
  return lines.map(row=>{
   const f=row.split(',');
   if(f.length!==6)throw Error('Linha CSV inválida.');
   return {time:f[0].trim(),open:Number(f[1]),high:Number(f[2]),
    low:Number(f[3]),close:Number(f[4]),volume:Number(f[5])};
  });
 }
}
export default function PlatformStrategyLab({userId=null,balance=100000}){
 const [input,setInput]=useState(''),[timeframe,setTimeframe]=useState('swing');
 const [mode,setMode]=useState('direto'),[allocation,setAllocation]=useState(1000);
 const [stop,setStop]=useState(500),[result,setResult]=useState(null),[error,setError]=useState('');
 const [quality,setQuality]=useState(null),[replay,setReplay]=useState(null);
 const [multiStudy,setMultiStudy]=useState(null),[rollingEvaluation,setRollingEvaluation]=useState(null);
 const [publicProduct,setPublicProduct]=useState('BTC-USD'),[publicInterval,setPublicInterval]=useState(300);
 const [sourceLoading,setSourceLoading]=useState(false),[publicCapture,setPublicCapture]=useState(null);
 const [prospectiveRows,setProspectiveRows]=useState([]);
 const requestVersion=useRef(0);
 const [paused,setPaused]=useState(false),[simBalance,setSimBalance]=useState(balance);
 useEffect(()=>{
  const refresh=()=>{
   if(!userId){setPaused(true);setSimBalance(0);return;}
   setPaused(readSimulationPaused(window.sessionStorage,userId));
   setSimBalance(readSimulatedBalance(window.sessionStorage,userId));
  };
  refresh();window.addEventListener('focus',refresh);
  return()=>window.removeEventListener('focus',refresh);
 },[userId,balance]);
 useEffect(()=>{
  requestVersion.current++;
  setSourceLoading(false);setPublicCapture(null);setMultiStudy(null);setRollingEvaluation(null);
  if(!userId){setProspectiveRows([]);return;}
  setProspectiveRows(readProspectiveObservations(window.sessionStorage,userId,publicProduct,publicInterval));
  return()=>{requestVersion.current++;};
 },[userId,publicProduct,publicInterval]);
 const localAudit=prospectiveRows.length?auditLocalProspectiveCohort(prospectiveRows,{granularity:publicInterval}):null;
 const observations=userId&&typeof window!=='undefined'?
  observeSimulatedBehavior({events:readSimJournal(window.sessionStorage,userId),paused,selectedMode:mode}):null;
 const plan=assessPaperStrategy({mode,balance:simBalance,allocation:Number(allocation),dailyStop:Number(stop),paused,analysis:result,observations});
 async function loadPublicSample(){
  const rev=++requestVersion.current;
  setSourceLoading(true);setError('');setPublicCapture(null);setReplay(null);setMultiStudy(null);setRollingEvaluation(null);
  try{
   const params=new URLSearchParams({product:publicProduct,granularity:String(publicInterval)});
   const response=await fetch('/api/platform/market-observation?'+params,{
    method:'GET',cache:'no-store'
   });
   const data=await response.json();
   if(!response.ok||data?.available!==true||!Array.isArray(data?.candles))
    throw Error('A fonte pública não confirmou candles recentes completos nesta consulta.');
   const quality=inspectHistoricalBars(data.candles);
   if(!quality.replayEligible)throw Error('A série pública apresenta lacunas incompatíveis com o estudo.');
   const studied=studyHistoricalCandles(data.candles,{timeframe});
   let grouped=null;
   if(quality.replayEligible&&data.candles.length>=180){
    try{grouped=multiTimeframeStudy(data.candles,{baseIntervalMs:quality.typicalIntervalMs,timeframe});}
    catch{grouped=null;}
   }
   if(requestVersion.current!==rev)return;
   setInput(JSON.stringify(data.candles));setResult(studied);setQuality(quality);setMultiStudy(grouped);
   setPublicCapture(data);setReplay(null);
  }catch(e){
   if(requestVersion.current===rev)setError(e?.message||'Fonte pública indisponível.');
  }finally{if(requestVersion.current===rev)setSourceLoading(false);}
 }
 function saveProspectiveSnapshot(){
  if(!userId||!publicCapture){setError('Entre na Social ou Platform e consulte primeiro a fonte pública.');return;}
  const recorded=captureProspectiveObservation(window.sessionStorage,userId,publicCapture);
  if(!recorded.ok){
   setError(recorded.reason==='NO_NEW_COMPLETE_CANDLE'?
    'O último candle já foi registrado. Volte quando um novo candle estiver completo.':
    'Não foi possível confirmar o horário desta observação. Consulte a fonte novamente.');
   return;
  }
  setProspectiveRows(recorded.rows);setError('');
 }
 function calculate(){
  setError('');setResult(null);setQuality(null);setReplay(null);setPublicCapture(null);setMultiStudy(null);setRollingEvaluation(null);
  try{
   const bars=parseLocalBars(input);
   const audit=inspectHistoricalBars(bars);
   const next=studyHistoricalCandles(bars,{timeframe});
   let grouped=null;
   if(audit.replayEligible&&bars.length>=180){
    try{grouped=multiTimeframeStudy(bars,{baseIntervalMs:audit.typicalIntervalMs,timeframe});}
    catch{grouped=null;}
   }
   setQuality(audit);setResult(next);setMultiStudy(grouped);
  }catch(e){setError(e?.message||'Não foi possível validar os candles.');}
 }
 function simulateReplay(){
  setError('');setReplay(null);setRollingEvaluation(null);
  if(!plan.rehearsalAllowed){setError('A pausa, alocação ou os limites fictícios impedem o replay nesta conta.');return;}
  try{
   const bars=parseLocalBars(input);
   const hypothetical=replayHistoricalScenario(bars,{
     mode,initialBalance:simBalance,allocationPct:Number(allocation)/simBalance,
     feeBps:10,slippageBps:10,stopPct:0.02
   });
   if(!hypothetical.ok){setError('Dados insuficientes ou com lacunas para o replay; confira a qualidade da série.');return;}
   setReplay(hypothetical);
   if(bars.length>=180){
    const rolling=evaluateRollingPaperWindows(bars,{
     initialBalance:simBalance,allocationPct:Number(allocation)/simBalance
    });
    setRollingEvaluation(rolling.valid?rolling:null);
   }
  }catch(e){setError(e?.message||'Não foi possível executar o replay histórico.');}
 }
 return <section style={panelCss} aria-label="Laboratório técnico da JENIOS Platform">
  <span style={{color:'#6d28d9',fontSize:11,fontWeight:800,letterSpacing:1}}>LABORATÓRIO B79–B80 · SEM OPERAÇÕES REAIS</span>
  <h2 style={{fontSize:21,margin:'8px 0'}}>Estudo do momento e estratégias</h2>
  <p style={{fontSize:12,lineHeight:1.6}}>Importe 60–500 candles históricos OHLCV em JSON ou CSV, ordenados do mais antigo ao mais recente. A análise usa dez leituras técnicas reproduzíveis. Dados enviados pelo usuário não são cotação de mercado validada.</p>
  <div aria-label="Fonte pública de candles" style={{marginTop:15,padding:14,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12}}>
   <h3 style={{fontSize:15,margin:'0 0 8px'}}>Candles públicos recentes · Coinbase Exchange</h3>
   <p style={{fontSize:12,color:'#475569',lineHeight:1.55}}>Coleta apenas quando você solicitar. Não é streaming; candles podem chegar atrasados ou faltar. Sem login na corretora, sem sinais automáticos e sem operações reais.</p>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
    <label style={{fontSize:12}}>Par público
     <select value={publicProduct} style={{...inputCss,marginTop:5}} onChange={e=>setPublicProduct(e.target.value)}>
      {['BTC-USD','ETH-USD','SOL-USD'].map(x=><option key={x} value={x}>{x}</option>)}
     </select>
    </label>
    <label style={{fontSize:12}}>Candles
     <select value={publicInterval} style={{...inputCss,marginTop:5}}
       onChange={e=>setPublicInterval(Number(e.target.value))}>
      <option value={60}>1 minuto</option><option value={300}>5 minutos</option><option value={3600}>1 hora</option>
     </select>
    </label>
    <button type="button" onClick={loadPublicSample} disabled={sourceLoading}
     style={{padding:'11px 13px',background:'#6d28d9',color:'#fff',border:0,borderRadius:9,cursor:'pointer',fontWeight:700}}>
     {sourceLoading?'Consultando…':'Consultar fonte pública'}
    </button>
   </div>
   {publicCapture&&<div role="status" style={{fontSize:12,lineHeight:1.6,marginTop:10}}>
    <p>{publicCapture.product} · {publicCapture.sampleCount} candles completos. Último candle: {new Date(publicCapture.lastCompleteCandle).toLocaleString('pt-BR')}.
       {' '}Observação coletada: {new Date(publicCapture.obtainedAt).toLocaleString('pt-BR')}.</p>
    <p>Fonte: API pública Coinbase Exchange. Estes dados alimentam a análise histórica local, não um motor conectado à corretora.</p>
    {userId&&<button type="button" onClick={saveProspectiveSnapshot}
      style={{background:'#fff',padding:'10px 12px',border:'1px solid #8b5cf6',borderRadius:9,color:'#5b21b6',fontWeight:700}}>
      Registrar observação prospectiva
    </button>}
   </div>}
   {userId&&prospectiveRows.length>0&&<p role="status" style={{fontSize:12,color:'#475569'}}>
    Diário prospectivo local: {prospectiveRows.length} candles únicos registrados ao longo de {prospectiveCoverage(prospectiveRows).hours} hora(s).
    {' '}{prospectiveReadinessLabel(localAudit)}
    {' '}Os horários do navegador não são testemunhados por servidor independente e não demonstram lucros ou desempenho de robôs.
   </p>}
  </div>

  <label style={{display:'grid',gap:6,fontSize:12,fontWeight:700}}>Candles históricos
   <textarea value={input} rows={4} maxLength={180000} onChange={e=>{requestVersion.current++;setInput(e.target.value);setResult(null);setQuality(null);setReplay(null);setPublicCapture(null);setMultiStudy(null);setRollingEvaluation(null);}}
    style={{...inputCss,resize:'vertical'}} placeholder={'JSON: [{"time":"2026-10-16T14:00:00Z","open":100,"high":102,"low":99,"close":101,"volume":1200}, ...]'} />
  </label>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end',marginTop:12}}>
   <label style={{fontSize:12}}>Horizonte<br/>
    <select value={timeframe} onChange={e=>{requestVersion.current++;setTimeframe(e.target.value);setResult(null);setQuality(null);setReplay(null);setPublicCapture(null);setMultiStudy(null);setRollingEvaluation(null);}} style={inputCss}>
     <option value="intraday">Intradiário histórico</option><option value="swing">Swing trade histórico</option>
    </select>
   </label>
   <button type="button" onClick={calculate} style={{padding:'10px 14px',border:0,borderRadius:9,background:'#6d28d9',color:'#fff',fontWeight:800,cursor:'pointer'}}>Analisar amostra</button>
   <label style={{fontSize:12}}>Ou selecionar arquivo local
    <input type="file" accept=".json,.csv,text/csv,application/json" onChange={async e=>{
     const file=e.target.files?.[0];if(!file)return;
     if(file.size>180000){setError('Arquivo maior que o limite de 180 KB.');return;}
     try{requestVersion.current++;setInput(await file.text());setError('');setResult(null);setQuality(null);setReplay(null);setPublicCapture(null);setMultiStudy(null);setRollingEvaluation(null);}
     catch{setError('Não foi possível ler o arquivo local.');}
    }} style={{display:'block',maxWidth:230}}/>
   </label>
  </div>
  {error&&<p role="alert" style={{color:'#991b1b',fontSize:12}}>{error}</p>}
  {result&&<div aria-label="Indicadores técnicos históricos">
   <h3 style={{fontSize:16,marginTop:17}}>Leitura histórica: {result.consensus.replaceAll('_',' ')}</h3>
   <p style={{fontSize:12}}>Último candle: {new Date(result.lastObservation).toLocaleString('pt-BR')} · {result.observations} observações. Tendências: {result.up} de alta / {result.down} de baixa.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:8}}>
    {result.indicators.map(x=><div key={x.id} style={{padding:10,background:'#f8fafc',borderRadius:9,fontSize:12}}>
     <strong>{x.name}</strong><p style={{margin:'5px 0'}}>Leitura: {x.direction}</p>
     <small>{x.value===null?'Estrutura qualitativa':x.value} {x.unit||''}</small>
    </div>)}
   </div>
   <p style={{fontSize:11,color:'#92400e'}}>{result.caution}</p>
  </div>}
  {multiStudy&&<section aria-label="Estudo de três tempos gráficos" style={{marginTop:15,padding:15,border:'1px solid #ddd6fe',borderRadius:12,background:'#faf9ff'}}>
   <h3 style={{fontSize:16,margin:'0 0 8px'}}>Confluência histórica de três tempos gráficos</h3>
   <p style={{fontSize:12}}>Leitura: <strong>{multiStudy.consensus.replaceAll('_',' ')}</strong>. {multiStudy.comment}</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:9}}>
    {multiStudy.series.map(x=><article key={x.multiple} style={{border:'1px solid #e2e8f0',borderRadius:9,padding:12,background:'#fff',fontSize:12}}>
     <strong>{x.minutes} minutos · {x.closedBars} candles completos</strong>
     <p>Tendência: {x.bias.replaceAll('_',' ')} · Alta/baixa: {x.up}/{x.down}</p>
     <small>Suporte: {x.support.toFixed(2)} · Resistência: {x.resistance.toFixed(2)}</small>
    </article>)}
   </div>
   <p style={{fontSize:11,color:'#92400e'}}>Acumulação ou distribuição não estão comprovadas por fluxo. Não é aconselhamento personalizado nem ordem.</p>
  </section>}
  {quality&&<div aria-label="Qualidade da série histórica" style={{borderTop:'1px solid #e2e8f0',marginTop:15,paddingTop:13,fontSize:12}}>
    <strong>Auditoria da série importada</strong>
    <p>{quality.count} candles · Intervalo típico: {Math.round(quality.typicalIntervalMs/1000)} segundos
      {' '}· Lacunas identificadas: {quality.gaps.length}
      {' '}· Volume ausente: {quality.zeroVolume}</p>
    <p role="status">{quality.replayEligible?'Série adequada para replay ilustrativo, sem certificação de origem.':
      'Replay bloqueado: amostra insuficiente, lacunas ou sinais relevantes de baixa qualidade.'}</p>
    {quality.warnings.map((x,i)=><p key={i} style={{color:'#92400e'}}>{x}</p>)}
  </div>}
    <div style={{marginTop:18,paddingTop:12,borderTop:'1px solid #e2e8f0'}}>
   <h3 style={{fontSize:16}}>Três modos — apenas roteiro de estudo</h3>
   <label style={{fontSize:12}}>Modo simulado
    <select value={mode} onChange={e=>{setMode(e.target.value);setReplay(null);setRollingEvaluation(null);}} style={{...inputCss,marginTop:6}}>
     {simulationModeLabels().map(x=><option value={x.code} key={x.code}>{x.label}</option>)}
    </select>
   </label>
   <p style={{fontSize:12}}>{plan.playbook}</p>
   <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
    <label style={{fontSize:12}}>Alocação fictícia (R$)<input type="number" min="0" value={allocation} onChange={e=>{setAllocation(e.target.value);setReplay(null);setRollingEvaluation(null);}} style={{...inputCss,width:145}}/></label>
    <label style={{fontSize:12}}>Limite diário fictício (R$)<input type="number" min="0" value={stop} onChange={e=>{setStop(e.target.value);setReplay(null);setRollingEvaluation(null);}} style={{...inputCss,width:145}}/></label>
   </div>
   <p style={{fontSize:12}}>Saldo virtual identificado: R$ {simBalance.toLocaleString('pt-BR')} · Antifúria: {paused?'pausado':'não pausado'}.</p>
   {plan.reasons.length>0&&<ul style={{fontSize:12,lineHeight:1.6,color:'#92400e',paddingLeft:18}}>
    {plan.reasons.map((r,i)=><li key={i}>{r}</li>)}
   </ul>}
   {quality&&<div style={{border:'1px solid #e4d8fc',borderRadius:12,padding:13,marginTop:14}} aria-label="Replay histórico hipotético">
    <h4 style={{margin:'0 0 8px'}}>Replay histórico fora da amostra</h4>
    <p style={{fontSize:12,lineHeight:1.6}}>Usa apenas candles já concluídos para formar hipóteses e simula a entrada no candle seguinte. Reserva os últimos 30% da amostra para avaliação; inclui custos e slippage ilustrativos de 0,10% cada e stop hipotético de 2% por posição. Não é o motor operacional protegido dos robôs.</p>
    <button type="button" disabled={!quality.replayEligible||!plan.rehearsalAllowed} onClick={simulateReplay}
      style={{background:'#4c1d95',color:'#fff',border:0,borderRadius:8,padding:'11px 15px',fontWeight:800,cursor:'pointer'}}>Executar replay hipotético</button>
    {replay&&<div role="status" style={{marginTop:13,fontSize:12,lineHeight:1.6}}>
      <p>Modo: {replay.mode} · {replay.evaluationBars} candles de avaliação · {replay.entries} entradas hipotéticas · {replay.closedTrades} saídas simuladas · {replay.paperStops} stops ilustrativos.</p>
      <p>Variação hipotética da conta: {replay.hypotheticalReturnPct.toLocaleString('pt-BR')}%.
         {' '}Benchmark ilustrativo (comprar e manter): {replay.hypotheticalBenchmarkPct.toLocaleString('pt-BR')}%.
         {' '}Queda máxima estimada: {replay.hypotheticalMaxDrawdownPct.toLocaleString('pt-BR')}%.</p>
      <p style={{color:'#92400e'}}>{replay.caution}</p>
    </div>}
   </div>}
   {rollingEvaluation&&<div aria-label="Avaliação em janelas consecutivas" style={{border:'1px solid #ddd6fe',background:'#faf9ff',borderRadius:10,padding:13,marginTop:12,fontSize:12}}>
    <strong>Estresse histórico com janelas de avaliação não sobrepostas</strong>
    <p>{rollingEvaluation.windows.length} janelas · {rollingEvaluation.scenarioRows.length} cenários com custos e stops fixados antes da avaliação. Não são operações dos robôs originais.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',gap:8}}>
     {rollingEvaluation.modeSummary.map(x=><article key={x.mode} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:9,padding:11}}>
      <strong>{x.mode} (ilustrativo)</strong>
      <p>Retorno mediano hipotético: {x.hypotheticalMedianReturnPct}%</p>
      <p>Pior cenário: {x.hypotheticalWorstReturnPct}%</p>
      <p>Maior drawdown hipotético: {x.hypotheticalWorstDrawdownPct}%</p>
     </article>)}
    </div>
    <p style={{color:'#92400e'}}>{rollingEvaluation.caution}</p>
   </div>}
   <small style={{color:'#64748b'}}>Este laboratório não executa operações, não altera os motores protegidos e não atribui resultados financeiros. Limites de 25% e 2% são barreiras internas demonstrativas, não orientação personalizada.</small>
  </div>
 </section>;
}
