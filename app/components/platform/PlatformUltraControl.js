'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {ULTRA_MARKETS,assessUltraLeverage,normalizeUltraConfig} from '../../../lib/platform/ultra/policy-r125.mjs';
import {ultraProvidersForMarket,ultraRouteForMarket} from '../../../lib/platform/ultra/routes-r125.mjs';
import {ULTRA_PERIODS} from '../../../lib/platform/ultra/reporting.mjs';
import {BrandLockup,BrandFooter} from '../brand/BrandSignature';
import css from './PlatformUltraControl.module.css';
import {UltraClientSetup,UltraLocalResults} from './PlatformUltraLocal';
import UltraOperations from './PlatformUltraOperations';
import UltraAccountReport from './UltraAccountReport';
import {formatFinancialAmount} from '../../../lib/platform/ultra/client/reporting.mjs';

const initial={markets:[],sessionMinutes:60,maxPositions:3,tradeRiskPct:0.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
const amount=formatFinancialAmount;
const pct=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
const time=v=>new Date(v).toLocaleString('pt-BR',{timeZone:'America/Bahia',dateStyle:'short',timeStyle:'short'});
async function call(path,body){
 const {data}=await platformSupabase?.auth?.getSession()||{};
 const token=data?.session?.access_token;
 if(!token)throw Error('Entre com sua conta da Platform para guardar configurações e consultar resultados.');
 const response=await fetch(path,{method:body?'POST':'GET',cache:'no-store',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();
 if(!response.ok||!result.ok)throw Error(result.error||'Não foi possível concluir.');
 return result;
}
function Totals({rows,empty}){
 if(!rows?.length)return <p className={css.empty}>{empty}</p>;
 return <div className={css.totals}>{rows.map(row=><section key={row.currency} className={css.totalCard}>
  <div className={css.sectionHead}><strong>{row.currency}</strong><span>{row.operations} operações encerradas</span></div>
  <dl><div><dt>Total de ganhos líquidos</dt><dd className={css.positive}>{amount(row.gains,row.currency)}</dd></div>
   <div><dt>Total de perdas líquidas</dt><dd className={css.negative}>{amount(row.losses,row.currency)}</dd></div>
   <div><dt>Resultado bruto</dt><dd>{amount(row.gross,row.currency)}</dd></div>
   <div><dt>Taxas</dt><dd>{amount(row.fees,row.currency)}</dd></div>
   <div><dt>Funding / financiamento (líquido)</dt><dd>{amount(row.financing,row.currency)}</dd></div>
   <div className={css.net}><dt>{Number(row.net)>=0?'Lucro líquido':'Prejuízo líquido'}</dt><dd className={Number(row.net)>=0?css.positive:css.negative}>{amount(row.net,row.currency)}</dd></div>
  </dl></section>)}</div>;
}
export default function PlatformUltraControl(){
 const [reportOwner,setReportOwner]=useState(null);
 useEffect(()=>{let active=true,authRevision=0;const initialRevision=authRevision;platformSupabase?.auth?.getSession().then(({data})=>{if(active&&initialRevision===authRevision)setReportOwner(data?.session?.user?.id??null)}).catch(()=>{if(active&&initialRevision===authRevision)setReportOwner(null)});const listener=platformSupabase?.auth?.onAuthStateChange((_event,session)=>{authRevision++;if(active)setReportOwner(session?.user?.id??null)});return()=>{active=false;listener?.data?.subscription?.unsubscribe()};},[]);
 async function verifyReportSession(){const {data,error}=await platformSupabase.auth.getUser();if(error||!reportOwner||data?.user?.id!==reportOwner)throw Error('SESSION_CHANGED');}
 const [config,setConfig]=useState(initial),[drafts,setDrafts]=useState(Object.fromEntries(ULTRA_MARKETS.map(m=>[m.id,{id:m.id,capital:0,leverage:1,currency:m.currency,provider:m.provider}])));
 const [period,setPeriod]=useState('30d'),[page,setPage]=useState(0),[data,setData]=useState(null),[loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [review,setReview]=useState(null),[accepted,setAccepted]=useState(false),[excludedText,setExcludedText]=useState('');
 const sequence=useRef(0),dialog=useRef(null),returnFocus=useRef(null),restored=useRef(false);
 const latest=useRef(config);latest.current=config;
 useEffect(()=>{
  const current=++sequence.current;let live=true;setLoading(true);setError('');
  call('/api/platform/ultra?period='+period+'&page='+page).then(result=>{
   if(!live||current!==sequence.current)return;
   setData(result);setLoaded(true);
   if(!restored.current&&result.plan){
    const restoredConfig={...result.plan.config,markets:result.plan.config.markets.filter(m=>['b3','crypto'].includes(m.id)).map(m=>({...m,provider:m.provider??(m.id==='b3'?'profit':'binance')}))};setConfig(restoredConfig);if(JSON.stringify(restoredConfig)!==JSON.stringify(result.plan.config))setNotice('Escopo atual: mini índice, mini dólar e cripto, com preferência pela Genial e Binance opcional. Revise e guarde a configuração atualizada; os históricos anteriores foram preservados.');setExcludedText(result.plan.config.excludedSymbols.join(', '));setDrafts(old=>({...old,...Object.fromEntries(restoredConfig.markets.map(m=>[m.id,m]))}));
   }
   restored.current=true;
  }).catch(e=>{if(live&&current===sequence.current){setError(e.message);setLoaded(false);setData(null);}})
   .finally(()=>{if(live&&current===sequence.current)setLoading(false);});
  return()=>{live=false;};
 },[period,page,reportOwner]);
 useEffect(()=>{setData(null);setLoaded(false);setConfig(initial);setDrafts(Object.fromEntries(ULTRA_MARKETS.map(m=>[m.id,{id:m.id,capital:0,leverage:1,currency:m.currency,provider:m.provider}])));setExcludedText('');restored.current=false;setReview(null);setAccepted(false);setNotice('');},[reportOwner]);
 useEffect(()=>{if(review&&!dialog.current?.open)dialog.current?.showModal();},[review]);
 function invalidate(){setReview(null);setAccepted(false);setNotice('');}
 function change(key,value){invalidate();restored.current=true;setConfig(old=>({...old,[key]:value}));}
 function setMarket(id,field,value){
  invalidate();restored.current=true;
  setDrafts(old=>({...old,[id]:{...old[id],[field]:value}}));
  setConfig(old=>({...old,markets:old.markets.map(m=>m.id===id?{...m,[field]:value}:m)}));
 }
 function toggle(id){invalidate();restored.current=true;setConfig(old=>({...old,markets:old.markets.some(m=>m.id===id)?old.markets.filter(m=>m.id!==id):[...old.markets,drafts[id]]}));}
 let preview=null;try{preview=assessUltraLeverage(config);}catch{}
 function closeReview(){dialog.current?.close();setReview(null);setAccepted(false);returnFocus.current?.focus();}
 async function save(assessment,reviewDigest,riskAcknowledged){
  if(JSON.stringify(latest.current)!==JSON.stringify(config))return;
  const result=await call('/api/platform/ultra',{action:'save',config:assessment.config,reviewDigest,riskAcknowledged});
  setData(old=>({...old,plan:result.plan}));setNotice('Configuração guardada na sua conta. Baixe a configuração para o ambiente em que você instalará o robô.');closeReview();
 }
 async function prepare(){
  returnFocus.current=document.activeElement;setBusy(true);setError('');setNotice('');
  const submitted=JSON.stringify(config);
  try{
   const result=await call('/api/platform/ultra',{action:'evaluate',config});
   if(submitted!==JSON.stringify(latest.current)){setError('A configuração mudou. Revise novamente.');return;}
   if(result.assessment.requiresAcknowledgement){setAccepted(false);setReview(result);}
   else await save(result.assessment,result.reviewDigest,false);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function confirm(){if(!review||!accepted||busy)return;setBusy(true);setError('');try{await save(review.assessment,review.reviewDigest,true);}catch(e){setError(e.message);}finally{setBusy(false);}}
 const report=data?.report;
 let planCurrent=false;try{planCurrent=JSON.stringify(normalizeUltraConfig(config))===JSON.stringify(data?.plan?.config);}catch{}
 return <main className={css.page}><div className={css.wrap}>
  <header className={css.top}><Link href="/dashboard-logado"><BrandLockup tone="light" context="Platform" compact/></Link><Link href="/dashboard">Voltar à negociação</Link></header>
  <section className={css.hero}><span className={css.kicker}>JENIOS ULTRA</span><h1>Seu capital. Suas escolhas.</h1><p>Prepare a seleção automática de ativos, defina a exposição e acompanhe os resultados em um só lugar.</p><span className={css.status}>Aguardando conexão operacional</span></section>
  <nav className={css.tabs} aria-label="Seções do Ultra"><a href="#ultra-config">Configuração</a><a href="#ultra-results">Resultados</a><a href="#ultra-connections">Corretoras</a><Link href="/platform/ultra/teste">Teste sem dinheiro real</Link></nav>
  {error&&<p role="alert" className={css.error}>{error}</p>}{notice&&<p role="status" className={css.notice}>{notice}</p>}
  <section className={css.panel} id="ultra-config"><div className={css.sectionHead}><div><span className={css.kicker}>01 · CONFIGURAÇÃO</span><h2>Mercados e capital</h2></div><span>Seleção automática dentro dos mercados escolhidos</span></div>
   <p className={css.muted}>Genial é a preferência para concentrar as operações. Mini índice e mini dólar têm os caminhos MT5/Profit; a API de cripto Genial ainda precisa ser comprovada. Binance é uma alternativa opcional para cripto. O Ultra está limitado a mini índice, mini dólar e cripto, sem alterar o acesso aos demais produtos. O capital permanece na sua conta. Futures depende da elegibilidade da conta, inclusive por país. Cripto via API da Genial segue não comprovado.</p>
   <fieldset disabled={busy||loading} className={css.fieldset}><div className={css.markets}>
    {ULTRA_MARKETS.map(m=>{const active=config.markets.some(x=>x.id===m.id),row=config.markets.find(x=>x.id===m.id)||drafts[m.id];return <section key={m.id} className={`${css.market} ${active?css.selected:''}`}>
     <label className={css.marketTitle}><input type="checkbox" checked={active} onChange={()=>toggle(m.id)}/>{m.label}</label>
     {<label>Plataforma da conta<select aria-label={'Plataforma · '+m.label} value={row.provider??m.provider} disabled={!active} onChange={e=>setMarket(m.id,'provider',e.target.value)}>{ultraProvidersForMarket(m.id).map(route=><option key={route.provider} value={route.provider}>{route.label}</option>)}</select></label>}
     <label>Moeda da conta<select aria-label={'Moeda · '+m.label} value={row.currency} disabled={!active||m.id==='b3'} onChange={e=>setMarket(m.id,'currency',e.target.value)}>{(m.id==='b3'?['BRL']:['USD','USDT','BRL','EUR']).map(c=><option key={c}>{c}</option>)}</select></label>
     <label>Capital destinado ({row.currency})<input aria-label={'Capital · '+m.label} type="number" inputMode="decimal" min="0.01" step="0.01" value={row.capital||''} placeholder="Informe o valor" disabled={!active} onChange={e=>setMarket(m.id,'capital',Number(e.target.value))}/></label>
     <label>Alavancagem máxima<input aria-label={'Alavancagem · '+m.label} type="number" inputMode="decimal" min="1" max="1000" step="0.1" value={row.leverage} disabled={!active} onChange={e=>setMarket(m.id,'leverage',Number(e.target.value))}/></label>
     <small>1x = sem alavancagem. O máximo disponível será confirmado pela corretora.</small>
    </section>;})}
   </div>
   <h3>Limites da sessão</h3><div className={css.fields}>
    {[
     ['sessionMinutes','Duração (minutos)',1,1440,1],['maxPositions','Máximo de posições',1,20,1],
     ['tradeRiskPct','Risco estimado por operação (%)',0.01,100,0.01],['dailyLossPct','Pausa após perda diária (%)',0.01,100,0.1],['maxAssetPct','Capital por ativo, no máximo (%)',1,100,1]
    ].map(([key,label,min,max,step])=><label key={key}>{label}<input type="number" min={min} max={max} step={step} value={config[key]} onChange={e=>change(key,Number(e.target.value))}/></label>)}
    <label>Ativos que não deseja operar<input placeholder="Ex.: BTCUSDT, contrato WIN ou WDO" value={excludedText} onChange={e=>{setExcludedText(e.target.value);change('excludedSymbols',e.target.value.split(',').map(s=>s.trim()).filter(Boolean));}}/></label>
   </div></fieldset>
   <p className={css.muted}>A seleção considerará liquidez, tendência, volatilidade, spread e custos. O Ultra poderá aguardar sem abrir posições. Aumentar a alavancagem não obriga o robô a usar todo o limite.</p>
   {preview&&<div className={css.exposure}><h3>Entenda a exposição escolhida</h3><div className={css.markets}>{preview.markets.map(m=><article key={m.id}><strong>{ULTRA_MARKETS.find(x=>x.id===m.id).label}</strong><p>Exposição máxima ilustrativa: <b>{amount(m.exposure,m.currency)}</b></p><p>Movimento contrário de 2%: <b>{amount(m.scenarios[1].loss,m.currency)}</b> ({pct(m.scenarios[1].capitalLossPct)} do capital).</p><small>Com todo o capital exposto, antes dos custos.</small></article>)}</div></div>}
   <div className={css.actions}><button className={css.primary} disabled={busy||loading||!preview} onClick={prepare}>{busy?'Guardando…':'Revisar e guardar configuração'}</button>{data?.plan&&<small>Último registro: {time(data.plan.created_at)}</small>}</div>
   <p className={css.muted}>Guardar a configuração não inicia operações. O aceite de risco não substitui margem disponível, permissões da conta ou confirmação da corretora.</p>
  </section>
  <section className={css.panel} id="ultra-results"><div className={css.sectionHead}><div><span className={css.kicker}>02 · RESULTADOS FINANCEIROS</span><h2>Ganhos, perdas e resultado líquido</h2></div></div>
   <UltraOperations key={reportOwner??"unauthenticated"} call={call}/><details><summary>Registros com confirmação independente</summary><label>Período<select value={period} onChange={e=>{setPeriod(e.target.value);setPage(0);}}>{ULTRA_PERIODS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><p className={css.muted}>Operações encerradas e confirmadas pela corretora. Períodos no horário da Bahia; moedas apresentadas separadamente. Ganhos e perdas já incluem os custos de cada operação.</p>
   {loading?<p role="status">Consultando resultados…</p>:!loaded?<p className={css.empty}>Não foi possível consultar os resultados. Nenhum valor foi estimado.</p>:<>
    <h3>No período selecionado</h3><Totals rows={report?.totals} empty="Nenhuma operação encerrada confirmada neste período."/>
    <h3>Resultado geral acumulado</h3><Totals rows={report?.lifetime} empty="Ainda não há operações encerradas confirmadas para esta conta."/>
    <p className={css.muted}>Resultado de posições abertas: {report?.unrealized===null?'aguardando consulta de posições na corretora.':'indisponível.'} Não incluído no resultado realizado acima.</p>
    {!!report?.days?.length&&<details><summary>Resultado por dia</summary><div className={css.tableWrap}><table><thead><tr><th>Dia</th><th>Moeda</th><th>Operações</th><th>Ganhos</th><th>Perdas</th><th>Líquido</th></tr></thead><tbody>{report.days.map(d=><tr key={d.day+d.currency}><td>{d.day.split('-').reverse().join('/')}</td><td>{d.currency}</td><td>{d.operations}</td><td>{amount(d.gains,d.currency)}</td><td>{amount(d.losses,d.currency)}</td><td>{amount(d.net,d.currency)}</td></tr>)}</tbody></table></div></details>}
    <h3>Por operação</h3>{!report?.operations?.length?<p className={css.empty}>As operações aparecerão aqui após a confirmação da corretora.</p>:<><div className={css.tableWrap}><table><thead><tr><th>Encerramento</th><th>Ativo / mercado</th><th>Direção</th><th>Bruto</th><th>Taxas</th><th>Financiamento</th><th>Lucro / prejuízo líquido</th></tr></thead><tbody>{report.operations.map(t=><tr key={t.id}><td>{time(t.closed_at)}</td><td>{t.symbol}<small>{ULTRA_MARKETS.find(m=>m.id===t.market)?.label??(t.market==='forex'?'Forex · histórico':t.market)}</small></td><td>{t.side==='buy'?'Compra':'Venda'}</td><td>{amount(t.gross_realized,t.currency)}</td><td>{amount(t.fees,t.currency)}</td><td>{amount(t.financing,t.currency)}</td><td className={Number(t.net_realized)>=0?css.positive:css.negative}>{amount(t.net_realized,t.currency)}</td></tr>)}</tbody></table></div><div className={css.actions}><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} · {report.count} operações</span><button disabled={(page+1)*50>=report.count} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></>}
   </>}
   </details><UltraAccountReport ownerKey={reportOwner} verifySession={verifyReportSession}/><UltraLocalResults/>
  </section>
  <section className={css.panel} id="ultra-connections"><span className={css.kicker}>03 · CONEXÕES</span><h2>Você conecta. O capital fica com você.</h2><UltraClientSetup plan={data?.plan} current={planCurrent}/><p className={css.muted}>Cada trader utiliza sua própria conta e as permissões de sua corretora. Não é necessário fornecer acesso à JENIOS.</p><div className={css.markets}>{ULTRA_MARKETS.map(base=>{const chosen=config.markets.find(m=>m.id===base.id)||drafts[base.id],m={...base,...ultraRouteForMarket(base.id,chosen?.provider)};return <article className={css.market} key={m.id}><h3>{m.label}</h3><span className={css.status}>Conexão pendente</span><ul>{m.requirements.map(s=><li key={s}>{s}</li>)}</ul>{m.guide&&<Link href={m.guide}>Ver preparação da conexão →</Link>}</article>;})}</div><p className={css.muted}>MT5 e Profit são caminhos diferentes. A Genial informa permitir robôs próprios MQL5 para seu MT5 brasileiro; isso não confirma Forex, cripto à vista ou execução deste conector. São necessárias a conta, a plataforma compatível e as permissões do titular, não uma aprovação individual de robô presumida pela JENIOS.</p></section>
  <BrandFooter tone="light" scope="Ultra"/>
  <dialog ref={dialog} className={css.dialog} onCancel={e=>{e.preventDefault();if(!busy)closeReview();}} aria-labelledby="ultra-risk-title">
   {review&&<><span className={css.kicker}>SUA DECISÃO</span><h2 id="ultra-risk-title">Essa exposição pode comprometer sua conta</h2><p>A alavancagem amplia ganhos e perdas. Um movimento contrário pode consumir todo o capital destinado ao Ultra; conforme o produto e as garantias, a perda pode ultrapassar esse valor.</p>
    {review.assessment.warnings.map(w=><p key={w}>{w}</p>)}
    {review.assessment.markets.map(m=><div className={css.riskRow} key={m.id}><strong>{ULTRA_MARKETS.find(x=>x.id===m.id).label} · {m.leverage}x</strong><p>Capital: {amount(m.capital,m.currency)} · Exposição: {amount(m.exposure,m.currency)}</p><p>Oscilação contrária de 5%: perda ilustrativa de {amount(m.scenarios[2].loss,m.currency)} ({pct(m.scenarios[2].capitalLossPct)} do capital).</p></div>)}
    <p className={css.muted}>{review.assessment.explanation}</p>
    <label className={css.accept}><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>setAccepted(e.target.checked)}/>Entendi o impacto e desejo manter esta configuração.</label>
    {error&&<p role="alert" className={css.error}>{error}</p>}
    <div className={css.actions}><button disabled={busy} onClick={closeReview}>Rever valores</button><button className={css.primary} disabled={!accepted||busy} onClick={confirm}>{busy?'Guardando…':'Entendi os riscos e quero continuar'}</button></div>
   </>}
  </dialog>
 </div></main>;
}
