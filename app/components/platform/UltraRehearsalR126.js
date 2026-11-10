'use client';
import {useState} from 'react';
import Link from 'next/link';
import {REHEARSAL_ROUTES,rehearsalReport,OPERATION_STATES} from '../../../lib/platform/ultra/rehearsal-r126.mjs';
import {formatFinancialAmount} from '../../../lib/platform/ultra/client/reporting.mjs';
import css from './PlatformUltraControl.module.css';

export default function UltraRehearsalR126(){
 const [route,setRoute]=useState('mt5'),[example,setExample]=useState(null),[error,setError]=useState('');
 function reset(){setExample(null);setError('');}
 function open(){try{setError('');setExample(rehearsalReport(route));}catch{reset();setError('Não foi possível carregar o exemplo fictício.');}}
 return <main className={css.page}><div className={css.wrap}>
  <header className={css.top}><Link href="/platform/ultra">Voltar ao Ultra</Link><strong>JENIOS ULTRA · TESTE</strong></header>
  <section className={css.hero}><span className={css.kicker}>ENSAIO SEM DINHEIRO REAL</span><h1>Confira a experiência antes de conectar sua conta.</h1><p>Esta tela usa somente dados fictícios. Não conecta corretoras, não testa uma estratégia no mercado e não envia ordens nem cobranças.</p><span className={css.status}>Integração nativa ainda não validada</span></section>
  <section className={css.panel}><h2>1. Escolha o exemplo</h2><label>Rota de demonstração<select value={route} onChange={event=>{reset();setRoute(event.target.value);}}>{REHEARSAL_ROUTES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
   <div className={css.actions}><button className={css.primary} onClick={open}>Carregar exemplo fictício</button><button disabled={!example} onClick={reset}>Limpar teste</button></div>
   <p className={css.muted}>Cada cliente usa a própria conta. MT5 e Profit dependem do ambiente e da habilitação do titular. Cripto Genial continua sem rota comprovada. Binance é alternativa explícita, sujeita à elegibilidade da conta e do produto.</p>
   {error&&<p role="alert" className={css.error}>{error}</p>}
   {example&&<div role="region" aria-label="Resultado fictício"><h3>{example.report.connectionLabel}</h3><p role="status">Exemplo carregado: 9 registros fictícios; nenhuma ordem ou cobrança.</p>
    <p>Somente a operação encerrada com custos completos entra no total: <strong>{formatFinancialAmount(example.view.totals[0].net,example.route.currency)}</strong>. O registro com custos pendentes fica de fora. Abertos: {example.view.openCount}. Incertos/enviados: {example.view.uncertainCount}. Encerrados com custos pendentes: {example.view.awaitingCosts}.</p>
    <div className={css.tableWrap}><table><thead><tr><th>Registro fictício</th><th>Estado</th><th>Quantidade entrada / saída</th><th>Resultado líquido</th></tr></thead><tbody>{example.view.operations.map(o=><tr key={o.id}><td>{o.symbol}{o.reason==='COSTS_PENDING'?' · custos pendentes':''}</td><td>{OPERATION_STATES[o.state]}</td><td>{o.entryQuantity} / {o.exitQuantity}</td><td>{o.net===null?'Pendente':formatFinancialAmount(o.net,o.currency)}</td></tr>)}</tbody></table></div>
   </div>}
  </section>
  <section className={css.panel}><h2>2. Teste o ciclo no seu computador</h2><p>O pacote R126 inclui um ensaio offline que reutiliza o motor, o diário durável e a reconciliação existentes. Exercita resposta perdida, retomada, parcial, recusa, cancelamento e custos pendentes com um simulador local, sem SDK ou credenciais.</p><div className={css.actions}><a href="/downloads/jenios-ultra-r126-rehearsal.zip" download className={css.primary}>Baixar pacote de teste R126</a></div><p className={css.muted}>Leia o LEIA-ME antes de executar. Requer Node.js 24. O resultado do ensaio não comprova proteção de posições, rentabilidade ou conexão real.</p></section>
  <section className={css.panel}><h2>3. Antes de operar</h2><p>Conexão nativa, conta elegível, dados e posições da corretora, proteções e recuperação precisam de validação no ambiente do titular. Pausar o robô não comprova que uma posição foi encerrada. Nenhum limite garante saída exatamente em zero.</p><p>Este teste é gratuito e não cria assinatura nem saldo. A regra comercial informada para o Ultra é R$ 5 por sessão/Start, sem comissão de performance; a cobrança permanece desativada. As assinaturas existentes e o DeFi da Flow não são alterados por esta tela.</p></section>
 </div></main>;
}
