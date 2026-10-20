'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
import {PERSONAS} from '../../lib/assistant/contracts.mjs';
import styles from './pro.module.css';
const tasks=[
 ['Perguntas avançadas','Respostas aprofundadas com contexto e referências da JENIOS'],
 ['Gráfico por imagem','Envie uma captura nítida para interpretação educacional de padrões e riscos'],
 ['Momento de mercado','Estude tendências e cenários quando houver candles recentes e verificados'],
 ['Suporte manual','Análises para apoiar decisões do operador, sem enviar ordens']
];
export default function GeniosPro(){
 const [state,setState]=useState({kind:'checking'}),[error,setError]=useState('');
 useEffect(()=>{let live=true,abort=new AbortController();
  async function load(){
   try{
    const r=await supabase?.auth.getSession();
    if(!r?.data?.session?.access_token){if(live)setState({kind:'guest'});return;}
    const res=await fetch('/api/assistant/pro/access',{headers:{authorization:'Bearer '+r.data.session.access_token},
     signal:abort.signal,cache:'no-store'});
    const json=await res.json();
    if(!res.ok)throw Error(json.error||'Não foi possível verificar sua conta.');
    if(live)setState({kind:'ready',data:json});
   }catch(e){if(live&&!abort.signal.aborted){setState({kind:'unavailable'});setError(e.message);}}
  }
  void load();return()=>{live=false;abort.abort();};
 },[]);
 const data=state.data||{};
 return <main className={styles.page}>
  <div className={styles.wrap}>
   <header className={styles.header}><Link href="/social">← JENIOS Social</Link><div className={styles.tag}>JENIOS · INTELIGÊNCIA AVANÇADA</div>
    <h1>Gênio Pro e Gênia Pro</h1><p>Continue com o atendimento gratuito. Use o Pro para pesquisas mais profundas, gráficos e acompanhamento educacional do mercado.</p>
   </header>
   <div className={styles.personas}>{PERSONAS.map(p=><div key={p.id} className={styles.character}>
     <img src={p.image} alt="" width="92" height="92"/><strong>{p.name} Pro</strong>
    </div>)}</div>
   <section className={styles.panel} aria-label="O que está incluído">
    <h2>Quais acessos você tem?</h2>
    {state.kind==='checking'?<p role="status">Verificando sua conta…</p>:state.kind==='guest'?<p>O atendimento gratuito está disponível sem cadastro. Para Pro e Universidade, entre com sua conta para verificar seu plano ou comprar acesso.</p>:
    state.kind==='unavailable'?<p role="alert">{error}</p>:<>
     <p><strong>Seu plano:</strong> {data.planCode||'Nenhuma assinatura verificada'}.</p>
     <p><strong>Universidade:</strong> {data.universityIncluded?'Incluída no seu plano':'Exige contratação separada'}.</p>
     <p><strong>Gênio/Gênia Pro:</strong> {data.proIncluded?'Incluído no seu plano, com franquia de consumo':'Disponível por créditos pré-pagos'}.</p>
     <p>Saldo verificado: {data.wallet?.status==='verified'
      ?(data.wallet.availableMicroUsd/1000000).toFixed(4)+' dólares em créditos de varejo':'Carregamento ainda não habilitado'}.</p>
     <p>Geração paga: {data.paidGenerationEnabled?'Disponível':'Aguardando integração e confirmação do provedor'}.</p>
    </>}
    <nav className={styles.links}><Link href="/platform/aprender">Universidade JENIOS →</Link><Link href="/platform/assistente">Atendimento autenticado →</Link><Link href="/login">Entrar na JENIOS →</Link></nav>
   </section>
   <section className={styles.panel}><h2>Recursos Pro</h2>
    <div className={styles.cards}>{tasks.map(([name,desc])=><article key={name}><h3>{name}</h3><p>{desc}</p></article>)}</div>
    <p>As leituras exigem fontes identificadas. Informações desatualizadas, fotos ambíguas ou dados insuficientes não serão apresentados como oportunidades confirmadas. Nenhuma ordem será executada.</p>
   </section>
   <section className={styles.panel}><h2>Créditos JENIOS Pro</h2>
    <p><strong>Pacote inicial projetado:</strong> US$ 10 em créditos comerciais (cobrança em reais, convertida pela cotação verificada no checkout).</p>
    <p>O valor consumido corresponde a duas vezes o custo da API OpenAI no momento da utilização. O sistema mantém frações de centavo e mostra a cobrança contabilizada após cada resposta.</p>
    <p role="status"><strong>Contratação ainda não habilitada:</strong> os créditos só poderão ser vendidos após concluir a conciliação com a JENIOS PAY e confirmar a cobrança. Esta tela não solicita pagamento.</p>
   </section>
  </div>
 </main>;
}
