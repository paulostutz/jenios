'use client';
import {useEffect,useRef,useState} from 'react';
import {OPERATION_STATES} from '../../../lib/platform/ultra/operation.mjs';
import {formatFinancialAmount as money} from '../../../lib/platform/ultra/client/reporting.mjs';
import {ULTRA_PERIODS} from '../../../lib/platform/ultra/reporting.mjs';
import css from './PlatformUltraControl.module.css';
const time=v=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Bahia',dateStyle:'short',timeStyle:'short'}):'—';
const states={idle:'Aguardando primeiro envio',monitoring:'Acompanhando',running:'Em operação',paused:'Pausado',reconciling:'Conferindo execuções',error:'Verifique o ambiente local'};
function Totals({rows}){return !rows?.length?<p className={css.empty}>Ainda não há operações encerradas com custos completos.</p>:<div className={css.totals}>{rows.map(t=><section className={css.totalCard} key={t.currency}><strong>{t.currency} · {t.operations} operações</strong><dl>{[['gains','Total de ganhos líquidos'],['losses','Total de perdas líquidas'],['gross','Resultado bruto'],['fees','Taxas e rebates'],['financing','Funding / financiamento'],['net','Lucro / prejuízo líquido']].map(([key,label])=><div key={key}><dt>{label}</dt><dd className={key==='net'?(String(t.net).startsWith('-')?css.negative:css.positive):undefined}>{money(t[key],t.currency)}</dd></div>)}</dl></section>)}</div>;}
export default function UltraOperations({call}){
 const [environment,setEnvironment]=useState('live'),[period,setPeriod]=useState('30d'),[page,setPage]=useState(0),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[checked,setChecked]=useState(null);
 const [label,setLabel]=useState('Meu Ultra'),[provider,setProvider]=useState('mt5'),[token,setToken]=useState(null),[notice,setNotice]=useState('');
 const generation=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let stopped=false,inFlight=false;const current=++generation.current;setData(null);setChecked(null);setError('');
  async function read(){if(stopped||inFlight||document.hidden)return;inFlight=true;
   try{const result=await call('/api/platform/ultra/devices?environment='+environment+'&period='+period+'&page='+page);if(!stopped&&current===generation.current){setData(result);setChecked(new Date());setError('');}}
   catch(e){if(!stopped&&current===generation.current)setError(e.message);}finally{inFlight=false;}
  }
  read();const timer=setInterval(read,15000);document.addEventListener('visibilitychange',read);
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',read);};
 },[environment,period,page,refresh,call]);
 async function create(e){e.preventDefault();setBusy(true);setError('');setNotice('');setToken(null);
  try{const result=await call('/api/platform/ultra/devices',{action:'create',label,provider,market:{profit:'b3',binance:'crypto',mt5:'forex'}[provider],environment});if(mounted.current){setToken(result);setRefresh(x=>x+1);}}
  catch(e){if(mounted.current)setError(e.message);}finally{if(mounted.current)setBusy(false);}
 }
 async function revoke(id){setBusy(true);setError('');try{await call('/api/platform/ultra/devices',{action:'revoke',deviceId:id});if(mounted.current){if(token?.device.id===id)setToken(null);setNotice('Sincronização revogada. O histórico foi preservado. Para pausar o robô ou encerrar posições, use o ambiente local.');setRefresh(x=>x+1);}}catch(e){if(mounted.current)setError(e.message);}finally{if(mounted.current)setBusy(false);}}
 async function copy(){try{await navigator.clipboard.writeText(token.token);setNotice('Código copiado. Cole somente na configuração local de sincronização do seu robô.');}catch{setNotice('Selecione e copie o código exibido.');}}
 const r=data?.report;
 return <div className={css.operationPanel}>
  <div className={css.sectionHead}><div><h3>Operações do seu robô</h3><p className={css.muted}>Registro por operação, resultado por período e acumulado. As informações são enviadas pelo seu ambiente local, sem acesso da JENIOS à corretora.</p></div>
   <div className={css.actions}><label>Ambiente<select value={environment} onChange={e=>{setEnvironment(e.target.value);setPage(0);}}><option value="live">Conta real</option><option value="demo">Demonstração</option></select></label><label>Período<select value={period} onChange={e=>{setPeriod(e.target.value);setPage(0);}}>{ULTRA_PERIODS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label></div>
  </div>
  {error&&<p className={css.error} role="alert">{error}{checked?' Os dados abaixo são da última atualização bem-sucedida.':''}</p>}
  {notice&&<p role="status">{notice}</p>}
  {checked&&<p className={css.muted}>Consulta atualizada em {time(checked)}. O horário de cada conexão indica quando o robô enviou seus dados. Valores sem confirmação independente da plataforma; moedas e ambientes separados.</p>}
  {r&&<><h3>No período</h3><Totals rows={r.totals}/><h3>Geral acumulado</h3><Totals rows={r.lifetime}/>
   <p className={css.muted}>{r.openCount} posições abertas · {r.awaitingCosts} encerradas aguardando custos. Posições abertas e encerramentos incompletos não entram no lucro líquido consolidado.</p>
   <h3>Cada operação</h3>{!r.operations.length?<p className={css.empty}>Nenhum registro recebido neste período. O histórico aparecerá quando o conector enviar as execuções.</p>:<>
    <div className={css.tableWrap}><table><thead><tr><th>Operação / ativo</th><th>Estado</th><th>Direção</th><th>Quantidade executada</th><th>Bruto realizado</th><th>Custos</th><th>Lucro / prejuízo líquido</th><th>Detalhes</th></tr></thead><tbody>{r.operations.map(o=><tr key={o.deviceId+o.id}>
     <td><strong>{o.symbol}</strong><small>{o.deviceLabel} · {time(o.createdAt)}</small></td><td>{OPERATION_STATES[o.state]}</td><td>{o.side==='buy'?'Compra':'Venda'}</td><td>{o.entryQuantity}<small>Encerrada: {o.exitQuantity}</small></td><td>{o.gross===null?'Aguardando':money(o.gross,o.currency)}</td><td>{o.fees===null?'Aguardando':money(o.fees,o.currency)}<small>Financiamento: {o.financing===null?'aguardando':money(o.financing,o.currency)}</small></td><td className={o.net!==null?(String(o.net).startsWith('-')?css.negative:css.positive):undefined}>{o.net!==null?money(o.net,o.currency):o.state==='closed'?'Conferindo custos':'Ainda não consolidado'}</td>
     <td><details><summary>Ver operação</summary><dl className={css.operationDetails}><dt>Identificador</dt><dd>{o.id}</dd><dt>Última atualização</dt><dd>{time(o.updatedAt)}</dd><dt>Abertura / encerramento</dt><dd>{time(o.openedAt)} / {time(o.closedAt)}</dd><dt>Quantidade solicitada</dt><dd>{o.requestedQuantity}</dd><dt>Preço médio de entrada / saída</dt><dd>{o.entryPrice??'—'} / {o.exitPrice??'—'}</dd><dt>Resultado em aberto</dt><dd>{o.unrealized===null?'Indisponível':money(o.unrealized,o.currency)}</dd><dt>Referências da corretora</dt><dd>{o.brokerRefs.join(', ')||'Aguardando'}</dd>{o.reason&&<><dt>Registro do conector</dt><dd>{o.reason}</dd></>}</dl></details></td>
    </tr>)}</tbody></table></div>
    <div className={css.actions}><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} · {r.count} registros</span><button disabled={(page+1)*50>=r.count} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
   </>}
   {!!r.days.length&&<details><summary>Resultado por dia</summary><div className={css.tableWrap}><table><thead><tr><th>Dia</th><th>Moeda</th><th>Operações</th><th>Ganhos</th><th>Perdas</th><th>Líquido</th></tr></thead><tbody>{r.days.map(d=><tr key={d.day+d.currency}><td>{d.day.split('-').reverse().join('/')}</td><td>{d.currency}</td><td>{d.operations}</td><td>{money(d.gains,d.currency)}</td><td>{money(d.losses,d.currency)}</td><td>{money(d.net,d.currency)}</td></tr>)}</tbody></table></div></details>}
  </>}
  {!r&&!error&&<p role="status">Consultando histórico…</p>}
  <details className={css.syncSetup}><summary>Conectar o histórico do meu robô</summary>
   <p>Crie um código de sincronização e configure-o no seu computador ou VPS. Ele permite apenas enviar os registros desse robô ao seu painel. Não é uma chave da corretora e não permite negociar, sacar ou consultar outras contas.</p>
   <form onSubmit={create}><div className={css.fields}><label>Nome do ambiente<input maxLength={80} required value={label} onChange={e=>setLabel(e.target.value)}/></label><label>Conector<select value={provider} onChange={e=>setProvider(e.target.value)}><option value="mt5">MT5 · Forex e índices</option><option value="binance">Binance · Cripto</option><option value="profit">Profit · B3</option></select></label></div><p className={css.muted}>Código para {environment==='live'?'conta real':'demonstração'}, válido por 90 dias. A coleta depende da ponte do conector; criar o código não conecta a corretora nem ativa operações.</p><button disabled={busy||!label.trim()}>Gerar código de sincronização</button></form>
   {token&&<div className={css.syncToken}><strong>Copie agora: o código não será exibido novamente.</strong><p>Conexão: {token.device.label} · {token.device.environment==='live'?'Conta real':'Demonstração'}</p><label>Código de sincronização<input readOnly value={token.token} autoComplete="off" spellCheck={false} onFocus={e=>e.target.select()}/></label><div className={css.actions}><button onClick={copy}>Copiar código</button><button onClick={()=>setToken(null)}>Já guardei · ocultar</button></div></div>}
   {!!data?.devices?.length&&<><h4>Meus ambientes</h4>{data.devices.map(d=><div className={css.deviceRow} key={d.id}><div><strong>{d.label}</strong><small>{d.provider.toUpperCase()} · {d.environment==='live'?'Conta real':'Demonstração'} · {d.revoked_at?'Sincronização revogada':Date.parse(d.expires_at)<=Date.now()?'Código expirado':(d.last_seen_at&&Date.now()-Date.parse(d.last_seen_at)>60000?'Sem atualização recente':states[d.runtime_state]||'Aguardando')}</small><small>Último envio: {time(d.last_seen_at)} · Validade: {time(d.expires_at)}</small></div>{!d.revoked_at&&<button disabled={busy} onClick={()=>revoke(d.id)}>Revogar sincronização</button>}</div>)}<p className={css.muted}>Revogar preserva o histórico e impede novos envios. Essa ação não pausa o robô e não encerra posições na corretora.</p></>}
  </details>
 </div>;
}
