'use client';
import {useRef,useState} from 'react';
import {exportClientPlan} from '../../../lib/platform/ultra/client/plan.mjs';
import {parseLocalReport,buildLocalDashboard,reportCsv,formatFinancialAmount} from '../../../lib/platform/ultra/client/reporting.mjs';
import {ULTRA_PERIODS} from '../../../lib/platform/ultra/reporting.mjs';
import css from './PlatformUltraControl.module.css';
function download(body,type,name){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function UltraClientSetup({plan,current}){
 const [error,setError]=useState('');
 function configuration(){try{setError('');download(JSON.stringify(exportClientPlan(plan),null,2),'application/json','jenios-ultra-configuracao.json');}catch(e){setError(e.message);}}
 return <div><h3>O Ultra no seu computador ou VPS</h3><p>Você conecta o robô à sua própria corretora. A JENIOS não recebe sua senha, chave de negociação ou acesso à conta.</p>
  <ol><li>Baixe o pacote e extraia os arquivos no ambiente em que o robô ficará instalado.</li><li>Guarde sua configuração acima e baixe o arquivo para esse ambiente.</li><li>Siga o guia incluído para verificar sua conexão local com Binance, MT5 ou Profit.</li></ol>
  <div className={css.actions}><a className={css.primary} href="/downloads/jenios-ultra-r116.zip" download>Baixar pacote local</a><button disabled={!plan||!current} onClick={configuration}>Baixar minha configuração</button></div>
  {!current&&plan&&<p className={css.muted}>Guarde as alterações antes de baixar a configuração atualizada.</p>}
  <p className={css.muted}>Disponível nesta versão: preparação e diagnóstico local. A execução automática ainda aguarda a conclusão e validação das pontes dos três mercados. Instalar este pacote não inicia operações.</p>
  {error&&<p className={css.error} role="alert">{error}</p>}
 </div>;
}
export function UltraLocalResults(){
 const [input,setInput]=useState(null),[period,setPeriod]=useState('30d'),[page,setPage]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const file=useRef(null),sequence=useRef(0);
 async function open(event){const chosen=event.target.files?.[0];if(!chosen)return;const ticket=++sequence.current;setBusy(true);setError('');
  try{if(chosen.size>5_000_000)throw Error('size');const parsed=parseLocalReport(JSON.parse(await chosen.text()));if(ticket===sequence.current){setInput(parsed);setPage(0);}}
  catch{if(ticket===sequence.current){setInput(null);setError('Não foi possível ler esse relatório. Use o formato de resultados do pacote Ultra, com operações encerradas e custos completos (até 5 MB).');}}
  finally{if(ticket===sequence.current)setBusy(false);event.target.value='';}
 }
 const report=input?buildLocalDashboard(input,{period,page}):null;
 return <details><summary>Resultados do meu ambiente local</summary>
  <p className={css.muted}>Abra o relatório do conector para consultar operações, períodos e acumulado. O arquivo permanece neste navegador e não é enviado à JENIOS. Valores importados não têm confirmação independente pela plataforma.</p>
  <input ref={file} type="file" accept="application/json,.json" hidden onChange={open}/>
  <div className={css.actions}><button disabled={busy} onClick={()=>file.current?.click()}>{busy?'Lendo…':'Abrir relatório local'}</button>{input&&<><button onClick={()=>download(reportCsv(input,{period}),'text/csv;charset=utf-8','jenios-ultra-resultados.csv')}>Exportar período em CSV</button><button onClick={()=>{++sequence.current;setInput(null);setPage(0);setError('');}}>Remover relatório</button></>}</div>
  {error&&<p role="alert" className={css.error}>{error}</p>}
  {report&&<><div className={css.sectionHead}><h3>{input.connectionLabel} · {input.environment==='demo'?'DEMONSTRAÇÃO':'Conta real · arquivo importado'}</h3><label>Período local<select value={period} onChange={e=>{setPeriod(e.target.value);setPage(0);}}>{ULTRA_PERIODS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label></div>
   <p className={css.muted}>Arquivo gerado em {new Date(input.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Bahia'})}. O acumulado considera as operações contidas neste arquivo. Depósitos, saques e posições abertas não entram no lucro realizado.</p>
   {[['No período',report.totals],['Acumulado do arquivo',report.lifetime]].map(([label,totals])=><div key={label}><h3>{label}</h3>{!totals.length?<p className={css.empty}>Nenhuma operação encerrada no período.</p>:<div className={css.totals}>{totals.map(t=><section key={t.currency} className={css.totalCard}><strong>{t.currency} · {t.operations} operações</strong><dl>{[['gains','Ganhos líquidos'],['losses','Perdas líquidas'],['gross','Resultado bruto'],['fees','Taxas'],['financing','Financiamento'],['net','Lucro / prejuízo líquido']].map(([key,title])=><div key={key}><dt>{title}</dt><dd>{formatFinancialAmount(t[key],t.currency)}</dd></div>)}</dl></section>)}</div>}</div>)}
   <h3>Por operação</h3><div className={css.tableWrap}><table><thead><tr><th>Encerramento</th><th>Ativo</th><th>Direção</th><th>Bruto</th><th>Taxas</th><th>Financiamento</th><th>Líquido</th></tr></thead><tbody>{report.operations.map(t=><tr key={t.id}><td>{new Date(t.closedAt).toLocaleString('pt-BR',{timeZone:'America/Bahia'})}</td><td>{t.symbol}</td><td>{t.side==='buy'?'Compra':'Venda'}</td><td>{formatFinancialAmount(t.gross,t.currency)}</td><td>{formatFinancialAmount(t.fees,t.currency)}</td><td>{formatFinancialAmount(t.financing,t.currency)}</td><td>{formatFinancialAmount(t.net,t.currency)}</td></tr>)}</tbody></table></div>
   {report.count>0&&<div className={css.actions}><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} · {report.count} operações</span><button disabled={(page+1)*50>=report.count} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>}
   {!!report.days.length&&<details><summary>Resultado por dia</summary><div className={css.tableWrap}><table><thead><tr><th>Dia</th><th>Moeda</th><th>Ganhos</th><th>Perdas</th><th>Líquido</th></tr></thead><tbody>{report.days.map(d=><tr key={d.day+d.currency}><td>{d.day.split('-').reverse().join('/')}</td><td>{d.currency}</td><td>{formatFinancialAmount(d.gains,d.currency)}</td><td>{formatFinancialAmount(d.losses,d.currency)}</td><td>{formatFinancialAmount(d.net,d.currency)}</td></tr>)}</tbody></table></div></details>}
  </>}
 </details>;
}
