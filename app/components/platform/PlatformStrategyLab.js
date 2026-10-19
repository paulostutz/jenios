'use client';
import {useEffect,useState} from 'react';
import {studyHistoricalCandles} from '../../../lib/platform/market-study.mjs';
import {inspectHistoricalBars} from '../../../lib/platform/historical-quality.mjs';
import {replayHistoricalScenario} from '../../../lib/platform/paper-replay.mjs';
import {assessPaperStrategy,simulationModeLabels} from '../../../lib/platform/paper-policy.mjs';
import {readSimulatedBalance,readSimulationPaused} from '../../../lib/platform/simulation-account.mjs';
import {readSimJournal} from '../../../lib/platform/simulation-journal.mjs';
import {observeSimulatedBehavior} from '../../../lib/platform/behavioral-observation.mjs';

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
 const observations=userId&&typeof window!=='undefined'?
  observeSimulatedBehavior({events:readSimJournal(window.sessionStorage,userId),paused,selectedMode:mode}):null;
 const plan=assessPaperStrategy({mode,balance:simBalance,allocation:Number(allocation),dailyStop:Number(stop),paused,analysis:result,observations});
 function calculate(){
  setError('');setResult(null);setQuality(null);setReplay(null);
  try{
   const bars=parseLocalBars(input);
   const audit=inspectHistoricalBars(bars);
   const next=studyHistoricalCandles(bars,{timeframe});
   setQuality(audit);setResult(next);
  }catch(e){setError(e?.message||'Não foi possível validar os candles.');}
 }
 function simulateReplay(){
  setError('');setReplay(null);
  if(!plan.rehearsalAllowed){setError('A pausa, alocação ou os limites fictícios impedem o replay nesta conta.');return;}
  try{
   const bars=parseLocalBars(input);
   const hypothetical=replayHistoricalScenario(bars,{
     mode,initialBalance:simBalance,allocationPct:Number(allocation)/simBalance,
     feeBps:10,slippageBps:10,stopPct:0.02
   });
   if(!hypothetical.ok){setError('Dados insuficientes ou com lacunas para o replay; confira a qualidade da série.');return;}
   setReplay(hypothetical);
  }catch(e){setError(e?.message||'Não foi possível executar o replay histórico.');}
 }
 return <section style={panelCss} aria-label="Laboratório técnico da JENIOS Platform">
  <span style={{color:'#6d28d9',fontSize:11,fontWeight:800,letterSpacing:1}}>LABORATÓRIO B79–B80 · SEM OPERAÇÕES REAIS</span>
  <h2 style={{fontSize:21,margin:'8px 0'}}>Estudo do momento e estratégias</h2>
  <p style={{fontSize:12,lineHeight:1.6}}>Importe 60–500 candles históricos OHLCV em JSON ou CSV, ordenados do mais antigo ao mais recente. A análise usa dez leituras técnicas reproduzíveis. Dados enviados pelo usuário não são cotação de mercado validada.</p>
  <label style={{display:'grid',gap:6,fontSize:12,fontWeight:700}}>Candles históricos
   <textarea value={input} rows={4} maxLength={180000} onChange={e=>{setInput(e.target.value);setResult(null);setQuality(null);setReplay(null);}}
    style={{...inputCss,resize:'vertical'}} placeholder={'JSON: [{"time":"2026-10-16T14:00:00Z","open":100,"high":102,"low":99,"close":101,"volume":1200}, ...]'} />
  </label>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end',marginTop:12}}>
   <label style={{fontSize:12}}>Horizonte<br/>
    <select value={timeframe} onChange={e=>{setTimeframe(e.target.value);setResult(null);setQuality(null);setReplay(null);}} style={inputCss}>
     <option value="intraday">Intradiário histórico</option><option value="swing">Swing trade histórico</option>
    </select>
   </label>
   <button type="button" onClick={calculate} style={{padding:'10px 14px',border:0,borderRadius:9,background:'#6d28d9',color:'#fff',fontWeight:800,cursor:'pointer'}}>Analisar amostra</button>
   <label style={{fontSize:12}}>Ou selecionar arquivo local
    <input type="file" accept=".json,.csv,text/csv,application/json" onChange={async e=>{
     const file=e.target.files?.[0];if(!file)return;
     if(file.size>180000){setError('Arquivo maior que o limite de 180 KB.');return;}
     try{setInput(await file.text());setError('');setResult(null);setQuality(null);setReplay(null);}
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
    <select value={mode} onChange={e=>setMode(e.target.value)} style={{...inputCss,marginTop:6}}>
     {simulationModeLabels().map(x=><option value={x.code} key={x.code}>{x.label}</option>)}
    </select>
   </label>
   <p style={{fontSize:12}}>{plan.playbook}</p>
   <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
    <label style={{fontSize:12}}>Alocação fictícia (R$)<input type="number" min="0" value={allocation} onChange={e=>setAllocation(e.target.value)} style={{...inputCss,width:145}}/></label>
    <label style={{fontSize:12}}>Limite diário fictício (R$)<input type="number" min="0" value={stop} onChange={e=>setStop(e.target.value)} style={{...inputCss,width:145}}/></label>
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
   <small style={{color:'#64748b'}}>Este laboratório não executa operações, não altera os motores protegidos e não atribui resultados financeiros. Limites de 25% e 2% são barreiras internas demonstrativas, não orientação personalizada.</small>
  </div>
 </section>;
}
