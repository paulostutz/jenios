'use client';
import {useEffect,useRef,useState} from 'react';
import {validateOwnerState} from '../../../lib/platform/ultra/web/state-contract.mjs';
import {formatFinancialAmount} from '../../../lib/platform/ultra/client/reporting.mjs';
import {ULTRA_PERIODS} from '../../../lib/platform/ultra/reporting.mjs';
import css from './UltraOwnerState.module.css';
const money=(n,c='BRL')=>n===null?'Pendente':new Intl.NumberFormat('pt-BR',{style:'currency',currency:c}).format(n/100);
const amount=(n,c)=>n===null?'Pendente':formatFinancialAmount(n,c);
const date=v=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Bahia',dateStyle:'short',timeStyle:'short'}):'Pendente';
const labels={active:'Ativo',pending:'Pendente',blocked:'Bloqueado',expired:'Expirado',paused:'Pausado',closed:'Encerrada',open:'Aberta',partially_closed:'Fechamento parcial',unknown:'Aguardando conciliação',awaiting_payment:'Aguardando pagamento',paid:'Confirmado',ready:'Disponível',start_recorded:'Ciclo iniciado',ended:'Encerrado',pending_costs:'Custos pendentes'};
const label=v=>labels[v]??v;
function Section({title,value,children}){return <section className={css.card}><h3>{title}</h3>{value?.status==='available'?<><p className={css.meta}>{value.mode==='demo'?'Demonstração · dados fictícios':'Dados da sua conta'} · {date(value.observedAt)}</p>{children(value.data)}</>:<p className={css.unavailable}>{value?.reason??'Fonte autorizada indisponível.'}</p>}</section>}
export default function UltraOwnerState({platform='jenios',subject,load}){
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [period,setPeriod]=useState('30d');
 const epoch=useRef(0);
 useEffect(()=>{
  let active=true,controller=null;
  const refresh=async()=>{
   const ticket=++epoch.current;controller?.abort();controller=new AbortController();setState(null);setError('');
   if(!subject){setBusy(false);return;}setBusy(true);
   try{const result=validateOwnerState(await load(controller.signal),{platform,subject});if(active&&ticket===epoch.current)setState(result);}
   catch(e){if(active&&ticket===epoch.current&&e?.name!=='AbortError')setError('Não foi possível consultar os dados. Nenhum saldo foi estimado.');}
   finally{if(active&&ticket===epoch.current)setBusy(false);}
  };
  const restore=()=>{void refresh()};void refresh();window.addEventListener('focus',restore);window.addEventListener('pageshow',restore);
  return()=>{active=false;epoch.current++;controller?.abort();window.removeEventListener('focus',restore);window.removeEventListener('pageshow',restore)};
 },[platform,subject,load,revision]);
 const current=state?.owner?.subject===subject?state:null,s=current?.sections??{},hasData=Object.values(s).some(section=>section.status==='available');
 return <section className={css.root} aria-labelledby="ultra-owner-state-title">
  <div className={css.heading}><div><span className={css.eyebrow}>ULTRA · SUA CONTA</span><h2 id="ultra-owner-state-title">Carteira de taxas e acompanhamento</h2><p>O saldo da plataforma é separado do capital mantido na corretora.</p></div><button disabled={busy||!subject} onClick={()=>setRevision(v=>v+1)}>{busy?'Consultando…':'Atualizar dados'}</button></div>
  {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Consultando sua conta…</p>}
  {!busy&&subject&&!hasData&&<p className={css.unavailable}>Fonte autorizada indisponível. Carteira, plano, ciclos e operações aguardam confirmação.</p>}
  {!busy&&subject&&hasData&&<div className={css.grid}>
   <Section title="Plano contratado" value={s.entitlement}>{d=><><strong>{d.planName}</strong><p>{label(d.status)} · {d.ultraIncluded?'Ultra incluído':'Contratação individual'}</p><p>Performance mensal: {d.performanceRate===null?'pendente':d.performanceRate+'%'}</p><p>Vigência: {date(d.periodEnd)}</p></>}</Section>
   <Section title="Carteira da plataforma" value={s.wallet}>{d=><dl><div><dt>Saldo confirmado</dt><dd>{money(d.balanceMinor,d.currency)}</dd></div><div><dt>Reservado</dt><dd>{money(d.reservedMinor,d.currency)}</dd></div><div><dt>Disponível</dt><dd>{money(d.availableMinor,d.currency)}</dd></div><div><dt>Autorização de débito</dt><dd>{d.debitAuthorized?'Confirmada':'Pendente'}</dd></div></dl>}</Section>
   <Section title="Robô" value={s.runtime}>{d=><><strong>{label(d.phase)}</strong><p>{d.reason}</p><p>{d.canStart?'Início disponível no executor conectado.':'Início aguardando conexão e condições confirmadas.'}</p></>}</Section>
   <Section title="Configuração salva" value={s.configuration}>{d=><>{d.markets.map(m=><p key={m.id}>{m.id==='b3'?'Mini índice e mini dólar':'Cripto'} · {m.provider??'conector pendente'} · {m.currency} · capital {m.capital??'pendente'} · {m.leverage??'—'}x</p>)}<p>Salva em {date(d.createdAt)}</p></>}</Section>
  </div>}
  {!busy&&subject&&hasData&&<>
   <Section title="Conexões" value={s.connections}>{rows=>rows.length?<ul>{rows.map(c=><li key={c.id}><strong>{c.label}</strong> · {c.provider} · {c.environment==='demo'?'Demonstração':'Real'} · {label(c.status)}<small>Última observação: {date(c.lastObservedAt)}</small></li>)}</ul>:<p>Nenhuma conexão registrada para sua conta.</p>}</Section>
   <Section title="Ciclos comerciais" value={s.cycles}>{rows=>rows.length?<div className={css.scroll}><table><thead><tr><th>Início</th><th>Status</th><th>Reserva</th><th>Encerramento confirmado</th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td>{date(c.startedAt)}</td><td>{label(c.phase)}</td><td>{money(c.reservationMinor)}</td><td>{date(c.endedAt)}</td></tr>)}</tbody></table></div>:<p>Nenhum ciclo registrado.</p>}</Section>
   <Section title="Performance mensal e obrigações" value={s.obligations}>{rows=>rows.length?<div className={css.scroll}><table><thead><tr><th>Mês</th><th>Valor</th><th>Estado</th></tr></thead><tbody>{rows.map(o=><tr key={o.id}><td>{o.month}</td><td>{money(o.amountMinor,o.currency)}</td><td>{label(o.status)}</td></tr>)}</tbody></table></div>:<p>Nenhuma obrigação registrada.</p>}</Section>
   <Section title="Operações do executor conectado" value={s.operations}>{d=><><label>Período <select value={period} onChange={e=>setPeriod(e.target.value)}>{ULTRA_PERIODS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><div className={css.grid}>{d.summaries.filter(r=>r.period===period).map(r=><div key={r.connectionId+r.environment+r.currency}><p>{r.connectionId} · {r.environment==='demo'?'Demonstração':'Real'} · {r.currency}</p><dl><div><dt>Ganhos</dt><dd>{amount(r.gains,r.currency)}</dd></div><div><dt>Perdas</dt><dd>{amount(r.losses,r.currency)}</dd></div><div><dt>Custos da corretora</dt><dd>{amount(r.fees,r.currency)} + {amount(r.financing,r.currency)}</dd></div><div><dt>Resultado após esses custos</dt><dd>{amount(r.net,r.currency)}</dd></div></dl></div>)}</div>{!d.summaries.some(r=>r.period===period)&&<p>Nenhum encerramento com custos completos neste período.</p>}{d.costsPending!==null&&d.costsPending>0&&<p>{d.costsPending} operações aguardam custos ou confirmação.</p>}{d.rows.length?<div className={css.scroll}><table><thead><tr><th>Conta / ambiente</th><th>Ativo</th><th>Estado</th><th>Bruto</th><th>Custos</th><th>Após custos da corretora</th></tr></thead><tbody>{d.rows.map(o=><tr key={o.connectionId+o.id}><td>{o.connectionId}<small>{o.environment==='demo'?'Demonstração':'Real'} · {o.currency}</small></td><td>{o.symbol}</td><td>{label(o.state)}</td><td>{amount(o.gross,o.currency)}</td><td>{o.costsComplete?<>{amount(o.fees,o.currency)} + {amount(o.financing,o.currency)}</>:'Pendentes'}</td><td>{amount(o.net,o.currency)}</td></tr>)}</tbody></table></div>:<p>Nenhuma operação registrada.</p>}{d.hasMore&&<p>Há mais operações no relatório do executor.</p>}</>}</Section>
  </>}
 </section>;
}
