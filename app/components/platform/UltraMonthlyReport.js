'use client';
import {useId,useMemo,useState} from 'react';
import {monthlyReportView,monthInZone} from '../../../lib/platform/ultra/client/monthly-report-um001.mjs';
import {formatFinancialAmount} from '../../../lib/platform/ultra/client/reporting.mjs';
import {OPERATION_STATES} from '../../../lib/platform/ultra/operation.mjs';
import css from './UltraAccountReport.module.css';

const TIME_ZONE='America/Bahia';
const PAGE_SIZE=50;
const amount=(value,currency)=>value===null||value===undefined?'Pendente':formatFinancialAmount(value,currency);
const date=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:TIME_ZONE,dateStyle:'short',timeStyle:'short'}):'Pendente';
const classifications={confirmed:'Fechada · custos completos',closed_complete:'Fechada · custos completos',closed:'Fechada · custos completos',open:'Em aberto',provisional:'Resultado provisório',awaiting_costs:'Custos pendentes',pending_costs:'Custos pendentes',partial:'Encerramento parcial',open_at_period_end:'Em aberto no fim do mês · posição a confirmar',non_realized:'Sem resultado realizado',uncertain:'Execução a conferir',conflict:'Conciliação pendente'};
const figures=[['gains','Ganhos brutos'],['losses','Perdas brutas'],['gross','Resultado bruto'],['fees','Custos e rebates confirmados'],['financing','Funding / financiamento'],['net','Resultado após custos confirmados']];

function MonthlyOperations({group}){
 const [page,setPage]=useState(0);
 const rows=group.operations.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 const total=group.operationCount??group.operations.length;
 return <details className={css.monthlyDetails}>
  <summary>Operações deste mês · {total} registros em {group.currency}</summary>
  <div className={css.table}><table><caption className={css.monthlyCaption}>Somente esta conta, ambiente, mês e moeda. Os identificadores originais são preservados.</caption><thead><tr><th scope="col">Operação</th><th scope="col">Estado</th><th scope="col">Bruto</th><th scope="col">Custos</th><th scope="col">Financiamento</th><th scope="col">Resultado fechado</th><th scope="col">Origem e datas</th></tr></thead><tbody>
   {rows.map(o=><tr key={o.id}><td><strong>{o.symbol}</strong><small>{o.id}</small></td><td>{OPERATION_STATES[o.state]??'Pendente'}<small>{classifications[o.classification]??(o.net===null?'Resultado não consolidado':'Custos completos')}</small></td><td>{amount(o.gross,group.currency)}</td><td>{amount(o.fees,group.currency)}</td><td>{amount(o.financing,group.currency)}</td><td>{amount(o.net,group.currency)}</td><td><details><summary>Consultar registro</summary><dl><dt>Preparação</dt><dd>{date(o.createdAt)}</dd><dt>Abertura</dt><dd>{date(o.openedAt)}</dd><dt>Encerramento</dt><dd>{date(o.closedAt)}</dd><dt>Atualização</dt><dd>{date(o.updatedAt)}</dd><dt>Referências da corretora</dt><dd>{o.brokerRefs?.join(', ')||'Pendente'}</dd><dt>Resultado em aberto informado</dt><dd>{amount(o.unrealized,group.currency)}</dd></dl></details></td></tr>)}
  </tbody></table></div>
  {group.operationsTruncated&&<p className={css.note}>Esta resposta contém {group.operations.length} de {total} registros. Os totais mensais consideram o conjunto validado pelo servidor; os detalhes exibidos são uma amostra.</p>}
  {!group.operations.length&&<p className={css.note}>Nenhum registro identificado neste recorte.</p>}
  {group.operations.length>PAGE_SIZE&&<div className={css.actions}><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} de {Math.ceil(group.operations.length/PAGE_SIZE)}</span><button type="button" disabled={(page+1)*PAGE_SIZE>=group.operations.length} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>}
 </details>;
}

export default function UltraMonthlyReport({report,platform,preparedView,selectedMonth,onMonthChange}){
 const titleId=useId();
 const [localMonth,setLocalMonth]=useState(()=>selectedMonth??preparedView?.month??monthInZone(report?.generatedAt??Date.now(),TIME_ZONE));
 const month=selectedMonth??localMonth;
 function selectMonth(value){if(onMonthChange){if(/^\d{4}-\d{2}$/.test(value))onMonthChange(value);}else setLocalMonth(value);}
 const state=useMemo(()=>{
  if(!/^\d{4}-\d{2}$/.test(month))return {view:null,error:'Selecione um mês para consultar.'};
  if(preparedView)return preparedView.month===month?{view:preparedView,error:null}:{view:null,error:'Atualizando o mês selecionado…'};
  if(!report)return {view:null,error:'Aguardando o relatório mensal.'};
  try{return {view:monthlyReportView(report,{month,timeZone:TIME_ZONE,now:Date.now(),platform}),error:null};}
  catch{return {view:null,error:'Não foi possível consolidar este mês. Os dados do arquivo permanecem disponíveis no histórico.'};}
 },[report,preparedView,month,platform]);
 const view=state.view;
 return <section className={preparedView?`${css.panel} ${css.monthly}`:css.monthly} data-platform={platform} aria-labelledby={titleId}>
  <div className={css.monthlyHeading}><div><p className={css.eyebrow}>EXTRATO MENSAL</p><h3 id={titleId}>O resultado do mês, por moeda.</h3></div><label className={css.monthControl}>Mês de consulta<input type="month" value={month} onChange={e=>selectMonth(e.target.value)} aria-describedby={`${titleId}-zone`}/></label></div>
  <p className={css.note} id={`${titleId}-zone`}>Fuso desta consulta: America/Bahia. A competência de cobrança depende do calendário confirmado na apuração.</p>
  {state.error&&<p role="status" className={css.error}>{state.error}</p>}
  {view&&<>
   <div className={css.monthlyStatus}><span className={css.badge}>{view.periodClosed?'Mês encerrado · apuração pendente':Date.now()<Date.parse(view.periodStart)?'Mês ainda não iniciado':'Mês em andamento · resultado provisório'}</span><span>{view.environment==='demo'?'Demonstração':'Conta real · arquivo importado'}</span></div>
   <p className={css.note}>Conta: {view.connectionLabel} · {view.provider.toUpperCase()}. Cobertura completa do mês: {view.sourceComplete?'confirmada na fonte':'pendente de confirmação'}. Cada moeda mantém seu próprio total.</p>
   {!view.groups.length&&<p className={css.empty}>Nenhuma operação foi identificada para este mês no arquivo. A ausência de registros não confirma resultado zero.</p>}
   <div className={css.monthlyGroups}>{view.groups.map(group=><article className={css.monthlyGroup} key={group.currency}>
    <h4>{group.currency}</h4>
    <dl className={css.monthlyCounts}>{[['closed','Fechadas com custos completos'],['open','Em aberto'],['provisional','Provisórias'],['awaitingCosts','Custos pendentes'],['uncertain','Execução a conferir'],['duplicates','Repetições identificadas'],['conflicts','Conflitos a conciliar']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{group.counts[key]===null||group.counts[key]===undefined?'Pendente':group.counts[key]}</dd></div>)}</dl>
    <h5>Encerramentos com custos completos</h5>
    <dl className={css.monthlyFigures}>{figures.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{amount(group.confirmed[key],group.currency)}</dd></div>)}</dl>
    <details className={css.monthlyDetails}><summary>Memória de cálculo e valores provisórios</summary><p className={css.note}>Ganhos brutos − perdas brutas − custos e rebates − financiamento = resultado dos encerramentos completos. Custos negativos representam créditos e preservam seu sinal no cálculo.</p><p className={css.monthlyFormula}>{amount(group.confirmed.gains,group.currency)} − ({amount(group.confirmed.losses,group.currency)}) − ({amount(group.confirmed.fees,group.currency)}) − ({amount(group.confirmed.financing,group.currency)}) = {amount(group.confirmed.net,group.currency)}</p><h5>Informações provisórias, fora do total confirmado</h5><dl className={css.monthlyFigures}>{[['gross','Bruto informado'],['fees','Custos informados'],['financing','Financiamento informado'],['net','Resultado provisório']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{amount(group.provisional[key],group.currency)}</dd></div>)}</dl><p className={css.note}>Operações em aberto, resultados provisórios e custos incompletos não integram o resultado fechado.</p></details>
    <div className={css.monthlyFinal}><span>Resultado final do mês</span><strong>{amount(group.finalNet,group.currency)}</strong></div>
    {group.pendingReasons.length>0&&<details className={css.monthlyDetails}><summary>Pendências para concluir a apuração</summary><ul className={css.monthlyPending}>{group.pendingReasons.map((reason,index)=><li key={`${reason.code}-${index}`}>{reason.label}</li>)}</ul></details>}
    <MonthlyOperations key={`${month}-${group.currency}`} group={group}/>
   </article>)}</div>
   <details className={css.monthlyDetails}><summary>Performance mensal e assinatura</summary><p>Sobre o lucro geral elegível do mês: 20% para o Ultra individual ou 10% nos planos com essa condição confirmada. Um lucro elegível de R$ 1.000 corresponde a R$ 200 ou R$ 100. Mês com prejuízo não gera performance.</p><p>A apuração permanece pendente até confirmar o plano aplicável, a cobertura das operações, os custos e as regras necessárias. Perdas de meses anteriores e conversão de moedas não são presumidas.</p><p>Mensalidade e performance são separadas. O plano anual não dispensa a performance. Nenhuma cobrança é emitida nesta consulta.{platform==='flow'?' A performance do DeFi permanece separada.':''}</p></details>
  </>}
 </section>;
}
