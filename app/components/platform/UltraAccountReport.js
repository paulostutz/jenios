'use client';
import {useEffect,useRef,useState} from 'react';
import {parseWorkspaceReport,workspaceReportView,ULTRA_ACCESS_PREPARATION} from '../../../lib/platform/ultra/client/workspace-report.mjs';
import {OPERATION_STATES} from '../../../lib/platform/ultra/operation.mjs';
import {formatFinancialAmount as money} from '../../../lib/platform/ultra/client/reporting.mjs';
import {ULTRA_PERIODS} from '../../../lib/platform/ultra/reporting.mjs';
import css from './UltraAccountReport.module.css';
const time=v=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Bahia',dateStyle:'short',timeStyle:'short'}):'Pendente';
function Totals({rows}){return rows.length?<div className={css.cards}>{rows.map(r=><article key={r.currency}><h4>{r.currency} · {r.operations} operações</h4><dl>{[['gains','Ganhos'],['losses','Perdas'],['gross','Bruto realizado'],['fees','Custos e rebates da corretora'],['financing','Funding / financiamento'],['net','Resultado após custos da corretora']].map(([k,label])=><div key={k}><dt>{label}</dt><dd>{money(r[k],r.currency)}</dd></div>)}</dl></article>)}</div>:<p className={css.empty}>Nenhum encerramento com custos completos neste recorte.</p>}
export default function UltraAccountReport({ownerKey,verifySession,platform='jenios'}){
 const [stored,setStored]=useState(null),[period,setPeriod]=useState('30d'),[page,setPage]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const file=useRef(null),generation=useRef(0),activeOwner=useRef(ownerKey);activeOwner.current=ownerKey;
 function clear(){generation.current++;setStored(null);setPage(0);setError('');setBusy(false)}
 useEffect(()=>{clear();return()=>{generation.current++;};},[ownerKey]);
 useEffect(()=>{const invalidate=()=>clear();const restore=e=>{if(e.persisted)clear()};const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('flow-free-invalidate'):null;if(channel)channel.onmessage=invalidate;window.addEventListener('pageshow',restore);return()=>{channel?.close();window.removeEventListener('pageshow',restore)}},[]);
 async function open(e){const chosen=e.target.files?.[0];if(!chosen)return;const current=++generation.current,owner=ownerKey;setStored(null);setBusy(true);setError('');
  try{if(!owner||chosen.size>5_000_000)throw Error();await verifySession();const report=parseWorkspaceReport(JSON.parse(await chosen.text()));if(current!==generation.current||owner!==activeOwner.current)return;setStored({owner,report});setPage(0)}
  catch{if(current===generation.current)setError('Não foi possível abrir. Confirme sua sessão e use o relatório de operações do pacote Ultra, de uma única conta e ambiente, com até 5 MB.')}
  finally{if(current===generation.current)setBusy(false);e.target.value=''}
 }
 const report=stored?.owner===ownerKey?stored.report:null;
 const view=report?workspaceReportView(report,{period,page}):null;
 return <section className={css.panel} aria-labelledby="ultra-account-report-title" data-platform={platform}>
  <div className={css.heading}><div><p className={css.eyebrow}>ULTRA · ÁREA INDIVIDUAL</p><h2 id="ultra-account-report-title">Uma conta de cada vez.</h2><p>Operações abertas e encerradas, custos e resultados do seu ambiente local.</p></div><span className={css.badge}>Consulta local</span></div>
  <p className={css.note}>O arquivo fica somente nesta tela. Cada importação substitui a anterior; contas, ambientes e moedas não são somados. O relatório não confirma conexão atual nem saldo da corretora ou da carteira da plataforma.</p>
  <input ref={file} type="file" accept="application/json,.json" onChange={open} hidden/>
  <div className={css.actions}><button type="button" disabled={!ownerKey||busy} onClick={()=>file.current?.click()}>{busy?'Conferindo…':'Abrir relatório de operações'}</button>{report&&<button type="button" onClick={clear}>Remover da tela</button>}</div>
  {error&&<p role="alert" className={css.error}>{error}</p>}
  {!ownerKey&&<p role="status">Confirme sua sessão para consultar um arquivo.</p>}
  {view?<>
   <div className={css.context}><div><strong>{view.connectionLabel}</strong><span>{view.provider.toUpperCase()} · {view.environment==='demo'?'Demonstração':'Conta real · arquivo importado'}</span></div><div><strong>Conexão e robô</strong><span>Estado atual não confirmado</span></div><div><strong>Arquivo gerado</strong><span>{time(view.generatedAt)}</span></div></div>
   <p className={css.note}>Perda de conexão, pausa e revogação de sincronização não confirmam cancelamento de ordens ou fechamento de posições. Confira esses estados no seu ambiente de negociação.</p>
   <label className={css.filter}>Período<select value={period} onChange={e=>{setPeriod(e.target.value);setPage(0)}}>{ULTRA_PERIODS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
   <h3>No período</h3><Totals rows={view.totals}/><h3>Acumulado deste arquivo</h3><Totals rows={view.lifetime}/>
   <p className={css.note}>{view.openCount} em aberto · {view.uncertainCount} com envio/execução a conferir · {view.awaitingCosts} encerradas aguardando custos. Somente encerramentos com custos completos entram nos totais.</p>
   <h3>Histórico por operação</h3><div className={css.table}><table><thead><tr><th>Operação</th><th>Estado</th><th>Executada / encerrada</th><th>Bruto</th><th>Custos corretora</th><th>Funding</th><th>Resultado corretora</th><th>Detalhes</th></tr></thead><tbody>{view.operations.map(o=><tr key={o.id}><td><strong>{o.symbol}</strong><small>{o.side==='buy'?'Compra':'Venda'} · {o.currency}</small></td><td>{OPERATION_STATES[o.state]}</td><td>{o.entryQuantity} / {o.exitQuantity}</td><td>{o.gross===null?'Pendente':money(o.gross,o.currency)}</td><td>{o.fees===null?'Pendente':money(o.fees,o.currency)}</td><td>{o.financing===null?'Pendente':money(o.financing,o.currency)}</td><td>{o.net===null?'Não consolidado':money(o.net,o.currency)}</td><td><details><summary>Ver operação</summary><dl><dt>ID</dt><dd>{o.id}</dd><dt>Preparação</dt><dd>{time(o.createdAt)}</dd><dt>Abertura / encerramento</dt><dd>{time(o.openedAt)} / {time(o.closedAt)}</dd><dt>Quantidade solicitada</dt><dd>{o.requestedQuantity}</dd><dt>Preço entrada / saída</dt><dd>{o.entryPrice??'Pendente'} / {o.exitPrice??'Pendente'}</dd><dt>Resultado em aberto</dt><dd>{o.unrealized===null?'Pendente':money(o.unrealized,o.currency)}</dd><dt>Referências da corretora</dt><dd>{o.brokerRefs.join(', ')||'Pendente'}</dd></dl></details></td></tr>)}</tbody></table></div>
   {!view.count&&<p className={css.empty}>Nenhuma operação neste período.</p>}
   <div className={css.actions}><button disabled={!page} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} · {view.count} registros</span><button disabled={(page+1)*50>=view.count} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
  </>:<div className={css.empty}><h3>Seu histórico aparece aqui</h3><p>Abra o relatório de uma conta do seu conector local. Nenhuma conta de corretora está conectada por esta tela.</p></div>}
  <details className={css.costs}><summary>Assinatura, abertura e performance</summary><dl><dt>Ultra avulso</dt><dd>R$ 19,90/mês ou R$ 199,00 em um pagamento por 12 meses após confirmação Letter.</dd><dt>Ultra incluído</dt><dd>{platform==='flow'?'Pessoal DeFi: contratação separada. Demais planos: incluído para o titular. No Profissional, os clientes contratam à parte.':'Incluído nos demais planos JENIOS; contratação avulsa separada para quem não possui um desses planos.'}</dd><dt>Taxa de abertura</dt><dd>R$ {(ULTRA_ACCESS_PREPARATION.openingFeeCents/100).toFixed(2).replace('.',',')} no início/start, prevista para a carteira da plataforma. Débito ainda desativado; parciais, recusa, cancelamento, saldo insuficiente e estorno dependem das condições finais.</dd><dt>Performance</dt><dd>Apuração por operação e tratamento das perdas em confirmação. Cobrança desativada.</dd><dt>Resultado líquido definitivo</dt><dd>Assinatura, abertura e performance não foram descontadas dos resultados da corretora. Sem esses custos completos, o resultado final permanece pendente.</dd></dl></details>
 </section>
}
