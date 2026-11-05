'use client';
import {useCallback,useEffect,useState} from 'react';
import {platformAdminFetch} from './PlatformAdminAccess';

const API='/api/platform/admin/robots/ultrafast';
const choices=[
 {id:'favorable',label:'Mercado favorável',detail:'Condições hipotéticas de liquidez e custos adequados'},
 {id:'risk',label:'Token arriscado',detail:'Livro raso, custos e risco do token elevados'},
 {id:'stale',label:'Dados desatualizados',detail:'Bloqueio por feed e reconciliação'}
];
const tile={border:'1px solid #dce3ed',background:'#fff',borderRadius:15,padding:18,minWidth:0};
const fmt=(value,digits=2)=>typeof value==='number'&&Number.isFinite(value)?
 value.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'Não confirmado';
function Status({ok,label}){return <span style={{display:'inline-flex',gap:6,alignItems:'center',color:ok?'#166534':'#92400e',fontSize:13,fontWeight:750}}>
 <span aria-hidden="true">{ok?'●':'◯'}</span>{label|| (ok?'Aprovado para pesquisa':'Bloqueado')}</span>}
function Indicators({data}){
 const shadow=data.simulators?.shadowPerformance;
 const v2=data.v2||{},v3=data.v3||{};
 return <div style={{display:'grid',gap:18}} aria-live="polite">
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,225px),1fr))',gap:12}}>
   <section style={tile}><small style={{color:'#64748b'}}>Pesquisa V2 · R111</small>
    <p><Status ok={v2.eligibleForFurtherResearch}/></p>
    <p style={{fontSize:12,color:'#64748b',marginBottom:0}}>Gates históricos R18, R23, R28 e R53 preservados.</p></section>
   <section style={tile}><small style={{color:'#64748b'}}>Pesquisa V3 · R112</small>
    <p><Status ok={v3.canContinueOfflineResearch}/></p>
    <p style={{fontSize:12,color:'#64748b',marginBottom:0}}>Integridade, risco, regras e monitoramento sintéticos.</p></section>
   <section style={tile}><small style={{color:'#64748b'}}>Resultado do replay ilustrativo</small>
    <p style={{fontWeight:800,fontSize:23,margin:'8px 0'}}>{fmt(shadow?.realizedHypotheticalNetPnlUsd)} USD</p>
    <p style={{fontSize:12,color:'#64748b',margin:0}}>**HIPOTÉTICO**, nunca P&L de corretora.</p></section>
  </div>
  <section style={tile}>
   <h2 style={{fontSize:17,margin:'0 0 13px'}}>Diagnóstico da análise</h2>
   <div style={{display:'grid',gap:9}}>
    {[
     ['Book íntegro',v3.bookIntegrity],['Regras de preço e quantidade',v3.exchangeRuleResearchOnly],
     ['Orçamento de risco',v3.stressBudgetResearchOnly],['Monitoramento íntegro',v3.watchdogHealthy]
    ].map(([label,ok])=><div key={label} style={{display:'flex',justifyContent:'space-between',gap:16,borderBottom:'1px solid #eef2f7',paddingBottom:8,fontSize:13}}>
      <span>{label}</span><Status ok={ok}/>
    </div>)}
   </div>
   {v3.blockers?.length>0&&<div style={{background:'#fff7ed',borderRadius:10,padding:12,marginTop:12}}>
    <strong style={{color:'#9a3412',fontSize:12}}>Motivos de bloqueio</strong>
    <p style={{fontSize:12,color:'#9a3412',overflowWrap:'anywhere',marginBottom:0}}>{v3.blockers.join(' · ')}</p>
   </div>}
   {v3.tokenRiskFlags?.length>0&&<p style={{fontSize:12,color:'#92400e',lineHeight:1.6}}>Alertas de token: {v3.tokenRiskFlags.join(' · ')}</p>}
  </section>
  <section style={tile}>
   <h2 style={{fontSize:17,margin:'0 0 12px'}}>Métricas simuladas e transparência</h2>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,170px),1fr))',gap:12}}>
     {[
      ['Operações hipotéticas',shadow?.hypotheticalTradeCount?.toString()||'0'],
      ['Acerto hipotético',shadow?.hypotheticalWinRate===null?'—':fmt(shadow.hypotheticalWinRate*100,1)+'%'],
      ['Drawdown hipotético',fmt(shadow?.hypotheticalMaxDrawdownPct,3)+'%'],
      ['Custos hipotéticos',fmt(shadow?.totalHypotheticalFeesUsd)+' USD'],
      ['Fill maker hipotético',fmt(data.simulators?.makerQueue?.filledHypotheticalQty,3)],
      ['Desvio de execução',fmt(data.simulators?.executionQuality?.priceSlippageBps,3)+' bps']
     ].map(([label,value])=><div key={label} style={{padding:12,background:'#f8fafc',borderRadius:10}}>
       <p style={{fontSize:11,color:'#64748b',margin:'0 0 5px'}}>{label}</p>
       <strong style={{fontSize:15}}>{value}</strong>
      </div>)}
   </div>
   <p style={{fontSize:12,color:'#64748b',lineHeight:1.6,marginBottom:0}}>
    A seleção de oportunidades, o fluxo de negociações, o risco de tokens, a execução, a alocação e o estudo estatístico estão conectados em **modo de pesquisa**. Nenhum botão transmite ordens, conecta carteiras, autoriza dinheiro real ou altera parâmetros de estratégias.
   </p>
  </section>
 </div>;
}
export default function PlatformUltraResearchLab(){
 const [scenario,setScenario]=useState('favorable');
 const [result,setResult]=useState(null);
 const [quote,setQuote]=useState(null);
 const [busy,setBusy]=useState(false),[quoteBusy,setQuoteBusy]=useState(false);
 const [error,setError]=useState(''),[quoteError,setQuoteError]=useState('');
 const run=useCallback(async(mode)=>{
  setBusy(true);setError('');setResult(null);
  try{
   const res=await platformAdminFetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({scenario:mode})});
   const body=await res.json();if(!res.ok||body.ok!==true)throw Error(body.error||'Laboratório indisponível.');
   if(body.schema!=='JENIOS_R113_ULTRA_READONLY_LAB_V1'||body.liveExecutionEnabled!==false||body.ordersSent!==0)
     throw Error('A resposta não passou pela verificação de segurança.');
   setResult(body);
  }catch(e){setError(e.message||'Falha de consulta.');}finally{setBusy(false);}
 },[]);
 const refreshQuotes=useCallback(async()=>{
  setQuoteBusy(true);setQuoteError('');setQuote(null);
  try{
   const res=await platformAdminFetch(API,{method:'GET'});
   const body=await res.json();if(!res.ok||body.ok!==true)throw Error(body.error||'Feed indisponível.');
   if(body.schema!=='JENIOS_R113_PUBLIC_TICKER_OBSERVATION_V1'||body.ordersSent!==0||
    body.liveExecutionEnabled!==false)throw Error('Cotações não verificadas.');
   setQuote(body);
  }catch(e){setQuoteError(e.message||'Feed indisponível.');}finally{setQuoteBusy(false);}
 },[]);
 useEffect(()=>{void run('favorable');},[run]);
 return <div style={{display:'grid',gap:18,fontFamily:'system-ui'}}>
  <section style={{background:'linear-gradient(125deg,#1b1942,#41377f)',color:'white',borderRadius:18,padding:'clamp(18px,4vw,30px)'}}>
    <p style={{letterSpacing:1.4,fontWeight:800,fontSize:11,color:'#c4b5fd',margin:0}}>JENIOS PLATFORM · LABORATÓRIO ADMINISTRATIVO</p>
    <h1 style={{fontSize:'clamp(25px,4vw,32px)',margin:'10px 0'}}>UltraFast V2 + V3</h1>
    <p style={{color:'#e2e8f0',fontSize:14,lineHeight:1.7,maxWidth:780,margin:0}}>
     Pesquisa R111/R112 integrada, com controles de liquidez, volatilidade, book, taxas, risco e execução hipotética. Não é um robô operando dinheiro real.
    </p>
    <p style={{fontWeight:800,color:'#fde68a',fontSize:12,margin:'14px 0 0'}}>SEM ORDENS REAIS · SEM PAPER EXTERNO · SEM PREVISÃO DE LUCRO</p>
  </section>
  <section style={tile}>
   <h2 style={{fontSize:18,margin:'0 0 8px'}}>Simule os filtros de proteção</h2>
   <p style={{color:'#64748b',fontSize:12,lineHeight:1.6}}>Os três cenários são inteiramente sintéticos. Não usam preços de mercado, saldo ou credenciais pessoais.</p>
   <div role="group" aria-label="Cenário da pesquisa" style={{display:'flex',flexWrap:'wrap',gap:8}}>
    {choices.map(item=><button type="button" key={item.id}
      aria-pressed={scenario===item.id} onClick={()=>{setScenario(item.id);void run(item.id);}}
      disabled={busy} title={item.detail}
      style={{cursor:busy?'progress':'pointer',borderRadius:99,padding:'10px 14px',fontWeight:700,fontSize:13,
       background:scenario===item.id?'#6d28d9':'#f8fafc',border:'1px solid #c4b5fd',color:scenario===item.id?'#fff':'#334155'}}>
       {item.label}
    </button>)}
   </div>
   {busy&&<p role="status" style={{fontSize:13,color:'#475569'}}>Executando avaliação offline…</p>}
   {error&&<p role="alert" style={{fontSize:13,color:'#991b1b'}}>{error}</p>}
  </section>
  {result&&<Indicators data={result}/>}
  <section style={tile}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
    <div><h2 style={{fontSize:18,margin:'0 0 6px'}}>Cotações públicas da Kraken</h2>
     <p style={{fontSize:12,color:'#64748b',margin:0}}>Ticker REST amostral · não é streaming de book, arbitragem ou sinal de negociação.</p></div>
    <button type="button" disabled={quoteBusy} onClick={()=>void refreshQuotes()}
      style={{cursor:quoteBusy?'progress':'pointer',padding:'10px 16px',background:'#ede9fe',color:'#5b21b6',border:'1px solid #c4b5fd',fontWeight:750,borderRadius:10}}>
      {quoteBusy?'Consultando…':'Consultar cotações'}
    </button>
   </div>
   {quoteError&&<p role="alert" style={{color:'#9a3412',fontSize:12}}>{quoteError}</p>}
   {quote&&<div style={{marginTop:14,display:'grid',gap:10}}>
    {quote.markets?.map(row=><div key={row.symbol} style={{display:'flex',gap:12,justifyContent:'space-between',flexWrap:'wrap',borderBottom:'1px solid #e2e8f0',padding:'8px 0',fontSize:13}}>
     <strong>{row.symbol}</strong><span>Último: US$ {fmt(row.last,5)}</span><span>Spread: {fmt(row.spreadBps,2)} bps</span>
    </div>)}
    <p style={{fontSize:11,color:'#64748b',margin:0}}>Consultado em {new Date(quote.observedAt).toLocaleString('pt-BR')} · Fonte pública, sem verificação de conta e sem ordens.</p>
   </div>}
  </section>
 </div>;
}