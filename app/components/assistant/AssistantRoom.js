"use client";
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import {PERSONAS} from '../../../lib/assistant/contracts.mjs';
import s from './AssistantRoom.module.css';
const quick=['Como começar na plataforma?','Como funcionam as trilhas de aprendizado?','Qual a diferença entre day e swing trade?','O modo reverso garante lucro?'];
const networks=['ethereum','bitcoin','bsc','tron','solana','polygon','arbitrum','base','avalanche'];
function ResultCard({r,onChooseBank}){
 if(!r)return null;
 return <article className={s.reply}>
  <div className={s.tag}>{r.mode==='ai'?'Resposta de IA':r.mode==='tool'?'Consulta ao serviço':'Material de suporte'}</div>
  <h3>{r.title||r.name||'Atendimento'}</h3>
  {r.explanation&&<p className={s.prose}>{r.explanation}</p>}
  {r.consultedAt&&<small>Consulta feita em {new Date(r.consultedAt).toLocaleString('pt-BR')}</small>}
  {!!r.facts?.length&&<dl>{r.facts.map((f,i)=><div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
  {r.institutions&&<div className={s.choices}>{r.institutions.length?r.institutions.map(i=><button type="button" key={i.codigo} onClick={()=>onChooseBank(i,r.periodo)}>{i.nome} · {i.codigo}</button>):<p>Nenhuma instituição encontrada neste cadastro.</p>}{r.partial&&<small>Lista parcial. Refine o nome ou consulte o BankScore.</small>}</div>}
  {r.sections?.map(section=><section key={section.key} className={s.section}><h4>{section.title}</h4><small>{section.status?.disponivel===false?'Fonte indisponível':section.status?.historico?'Movimentos históricos':'Confira o horário de cada registro'}</small>{section.items.length?section.items.map((i,n)=><p key={n}><b>{i.name}</b> · {i.symbol}<br/><small>Horário do registro: {i.timestamp} · Variação: {i.variation}</small></p>):<p>Nenhum registro retornado nesta consulta.</p>}</section>)}
  {r.findings?.map((f,i)=><section className={s.section} key={i}><b>{f.title}</b><p>{f.explanation}</p></section>)}
  {r.notices?.map((n,i)=><p className={s.small} key={i}>{n}</p>)}
  {r.notice&&<p className={s.small}>{r.notice}</p>}
  <div className={s.actions}>{(r.links||r.articles||[]).map((l,i)=><a className={s.link} key={i} href={l.href}>{l.label||l.title}</a>)}</div>
 </article>;
}
export default function AssistantRoom(){
 const [account,setAccount]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[refresh,setRefresh]=useState(0);
 const [message,setMessage]=useState(''),[chat,setChat]=useState([]),[tab,setTab]=useState('help');
 const [bank,setBank]=useState({codigo:'',periodo:''}),[bankName,setBankName]=useState(''),[query,setQuery]=useState('');
 const [cryptoTarget,setCryptoTarget]=useState({network:'ethereum',type:'token',identifier:''});
 const epoch=useRef(0),owner=useRef(null),inflight=useRef(false),controller=useRef(null),accountRef=useRef(null);
 function acceptAccount(a){accountRef.current=a;setAccount(a);}
 useEffect(()=>{
  let live=true;const ticket=++epoch.current;controller.current?.abort();controller.current=new AbortController();
  acceptAccount(null);setError('');setBusy(true);setChat([]);setMessage('');owner.current=null;inflight.current=false;
  async function load(){try{
   const res=await supabase?.auth.getSession(),session=res?.data?.session;
   if(res?.error||!session?.access_token||session.user.is_anonymous)throw Error('Entre na sua conta para conversar com o Gênio ou a Gênia.');
   if(!live||ticket!==epoch.current)return;owner.current=session.user.id;
   const response=await fetch('/api/platform/assistant',{cache:'no-store',signal:controller.current.signal,headers:{authorization:'Bearer '+session.access_token}}),body=await response.json();
   if(!response.ok)throw Error(body.error||'Não foi possível iniciar o atendimento.');
   if(live&&ticket===epoch.current)acceptAccount(body.assistant);
  }catch(e){if(live&&ticket===epoch.current&&e.name!=='AbortError')setError(e.message);}finally{if(live&&ticket===epoch.current)setBusy(false);}}
  void load();
  const sub=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||session?.user?.id===owner.current&&['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
   epoch.current++;controller.current?.abort();acceptAccount(null);setChat([]);setMessage('');setBank({codigo:'',periodo:''});setBankName('');setQuery('');setCryptoTarget({network:'ethereum',type:'token',identifier:''});owner.current=null;
   setTimeout(()=>{if(live)setRefresh(x=>x+1);},0);
  });
  return()=>{live=false;epoch.current++;controller.current?.abort();sub?.data?.subscription?.unsubscribe();};
 },[refresh]);
 async function send(input){
  if(inflight.current||!accountRef.current)return;inflight.current=true;setBusy(true);setError('');const ticket=epoch.current,expectedOwner=owner.current;
  try{
   const sessionResult=await supabase.auth.getSession(),session=sessionResult.data?.session;
   if(ticket!==epoch.current||!accountRef.current)return;
   if(sessionResult.error||!session?.access_token||session.user.id!==expectedOwner)throw Error('Sua sessão mudou. Atualize o atendimento.');
   const response=await fetch('/api/platform/assistant',{method:'POST',cache:'no-store',signal:controller.current?.signal,headers:{authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({...input,revision:accountRef.current.revision})});
   if(ticket!==epoch.current)return;
   if(response.ok&&(response.headers.get('content-type')||'').includes('application/pdf')){
    const blob=await response.blob();if(ticket!==epoch.current)return;
    const rawRevision=response.headers.get('x-jenios-revision'),revision=Number(rawRevision);if(rawRevision!==null&&Number.isSafeInteger(revision)&&revision>accountRef.current.revision)acceptAccount({...accountRef.current,revision});
    const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=input.tool==='bankscore_full'?'jenios-bankscore-completo.pdf':'jenios-cripto-completo.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);
    setChat(old=>[...old.slice(-19),{id:crypto.randomUUID(),result:{mode:'tool',title:'PDF emitido',explanation:'O relatório foi gerado pelo serviço original. Um novo download pode refletir uma nova leitura da fonte.'}}]);return;
   }
   const body=await response.json();if(ticket!==epoch.current)return;
   if(Number.isSafeInteger(body.revision))acceptAccount({...accountRef.current,revision:body.revision});
   if(!response.ok){if(response.status===409){acceptAccount(null);}throw Error(body.error||'Consulta indisponível.');}
   acceptAccount(body.assistant);
   if(input.action==='ask'){setMessage('');setChat(old=>[...old.slice(-18),{id:crypto.randomUUID(),question:input.message},{id:crypto.randomUUID(),result:body.result}]);}
   else if(body.result)setChat(old=>[...old.slice(-19),{id:crypto.randomUUID(),result:body.result}]);
  }catch(e){if(ticket===epoch.current&&e.name!=='AbortError')setError(e.message);}
  finally{if(ticket===epoch.current){inflight.current=false;setBusy(false);}}
 }
 const persona=PERSONAS.find(x=>x.id===account?.persona)||PERSONAS[0];
 const run=(tool,input={},format='json')=>send({action:'tool',tool,input,format,confirmed:true});
 return <main className={s.shell}><div className={s.wrap}>
  <header className={s.header}><div><div className={s.brand}>JENIOS · ATENDIMENTO INTELIGENTE</div><h1>Clareza para o seu próximo passo.</h1><p>Tire dúvidas, consulte as informações disponíveis e entenda os recursos da Platform.</p></div><a className={s.back} href="/dashboard-logado">← Voltar à gestão</a></header>
  {!account?<section className={s.card}><h2>Gênio e Gênia</h2><p role="status">{busy?'Verificando sua conta…':error||'Atualize para continuar.'}</p><div className={s.actions}><a href="/login" className={s.primary}>Entrar</a><button className={s.secondary} disabled={busy} onClick={()=>setRefresh(x=>x+1)}>Tentar novamente</button></div></section>:<>
   <div className={s.banner}>Atendimento informativo · Execução real e alertas WhatsApp não estão ativos neste módulo.</div>
   <div className={s.layout}>
    <aside className={s.sidebar}><h2>Quem vai te atender?</h2><div className={s.personas}>{PERSONAS.map(p=><button disabled={busy} type="button" key={p.id} className={s.persona} aria-pressed={account.persona===p.id} onClick={()=>send({action:'preferences',persona:p.id,aiConsent:account.aiConsent})}><img src={p.image} alt={p.name} width="76" height="76"/><span>{p.name}</span></button>)}</div><p className={s.small}>Mesmas informações e critérios. A escolha muda o personagem, não a qualidade do atendimento.</p>
     <label className={s.consent}><input type="checkbox" disabled={busy} checked={account.aiConsent} onChange={e=>send({action:'preferences',persona:account.persona,aiConsent:e.target.checked})}/>Autorizar envio das minhas perguntas de suporte à OpenAI, quando configurada.</label><p className={s.small}>{account.aiConfigured?'Provedor configurado; disponível somente com consentimento.':'IA externa ainda não configurada. O modo guiado permanece disponível.'} Os formulários de consulta não enviam seus resultados ao modelo. Não escreva dados sensíveis nas perguntas.</p>
     <nav aria-label="Consultas do atendimento">{[['help','Dúvidas da plataforma'],['trends','Hub de Tendências'],['bankscore','BankScore'],['crypto','Validador Cripto']].map(([id,label])=><button disabled={busy} type="button" className={s.nav} aria-current={tab===id?'page':undefined} key={id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
     <a className={s.school} href="/platform/alertas">Solicitações de alertas · em preparação →</a><a className={s.school} href="/platform/aprender">Universidade JENIOS · Estudo diário →</a><a className={s.school} href="/dashboard">Laboratório de leitura · beta →</a>
    </aside>
    <section className={s.column}>
     <div className={s.card}>
      <div className={s.heading}><img src={persona.image} alt="" width="54" height="54"/><div><div className={s.tag}>SEU ATENDENTE</div><h2>{persona.name}</h2></div></div>
      {tab==='help'&&<><p>Como posso ajudar você a usar a JENIOS?</p><div className={s.quick}>{quick.map(q=><button disabled={busy} type="button" key={q} onClick={()=>send({action:'ask',message:q})}>{q}</button>)}</div><form onSubmit={e=>{e.preventDefault();send({action:'ask',message});}}><label htmlFor="assistant-question">Sua dúvida<textarea id="assistant-question" rows={3} maxLength={1800} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)} placeholder="Ex.: como funciona o diagnóstico?"/></label><button disabled={busy||!message.trim()} className={s.primary}>{busy?'Consultando…':'Enviar pergunta'}</button></form><p className={s.small}>Não informe senhas, tokens de acesso ou frase-semente. Esta conversa fica apenas nesta aba e é apagada ao recarregar ou sair.</p></>}
      {tab==='trends'&&<><h3>Uma consulta, a mesma base do Hub.</h3><p>Veja o que o serviço de tendências retorna agora, distinguindo a data da consulta do horário de cada registro.</p><button className={s.primary} disabled={busy} onClick={()=>run('trends')}>Consultar Hub</button><p className={s.small}>Este botão consulta uma vez. Não inicia monitoramento contínuo nem envia WhatsApp.</p></>}
      {tab==='bankscore'&&<><h3>Indicadores e laudos de instituições</h3><form onSubmit={e=>{e.preventDefault();run('bankscore_search',{query});}}><label htmlFor="bank-query">Buscar instituição<input id="bank-query" value={query} maxLength={80} disabled={busy} onChange={e=>setQuery(e.target.value)} placeholder="Digite parte do nome"/></label><button disabled={busy||query.trim().length<2} className={s.secondary}>Buscar no cadastro</button></form><p className={s.small}>Selecione um resultado abaixo ou informe o código da instituição.</p><div className={s.fields}><label>Código<input value={bank.codigo} disabled={busy} onChange={e=>{setBank({...bank,codigo:e.target.value});setBankName('');}} maxLength={13}/></label><label>Referência AAAAMM<input value={bank.periodo} disabled={busy} onChange={e=>setBank({...bank,periodo:e.target.value})} maxLength={6}/></label></div>{bankName&&<p>{bankName}</p>}<div className={s.actions}><button disabled={busy||!bank.codigo} className={s.secondary} onClick={()=>run('bankscore_basic',bank)}>Consulta básica</button><button disabled={busy||!bank.codigo} className={s.primary} onClick={()=>run('bankscore_full',bank)}>Laudo completo</button><button disabled={busy||!bank.codigo} className={s.secondary} onClick={()=>run('bankscore_full',bank,'pdf')}>Baixar PDF completo</button></div><p className={s.small}>A consulta usa a mesma autorização do BankScore. O atendimento não concede acesso adicional nem cria cobrança.</p></>}
      {tab==='crypto'&&<><h3>Consultar rede, carteira ou token</h3><div className={s.fields}><label>Rede<select value={cryptoTarget.network} disabled={busy} onChange={e=>setCryptoTarget({...cryptoTarget,network:e.target.value})}>{networks.map(n=><option key={n}>{n}</option>)}</select></label><label>Tipo<select value={cryptoTarget.type} disabled={busy} onChange={e=>setCryptoTarget({...cryptoTarget,type:e.target.value})}><option value="token">Token / contrato</option><option value="wallet">Carteira</option><option value="transaction">Transação / hash</option></select></label></div><label>Identificador público<textarea rows={3} value={cryptoTarget.identifier} maxLength={180} spellCheck={false} disabled={busy} onChange={e=>setCryptoTarget({...cryptoTarget,identifier:e.target.value})}/></label><div className={s.actions}><button disabled={busy||!cryptoTarget.identifier} className={s.secondary} onClick={()=>run('crypto_basic',cryptoTarget)}>Verificação básica</button><button disabled={busy||!cryptoTarget.identifier} className={s.primary} onClick={()=>run('crypto_full',cryptoTarget)}>Consulta completa</button><button disabled={busy||!cryptoTarget.identifier} className={s.secondary} onClick={()=>run('crypto_full',cryptoTarget,'pdf')}>Baixar PDF</button></div><p className={s.small}>Use somente dados públicos. O identificador consultado não é enviado à IA generativa.</p></>}
     </div>
     {error&&<div className={s.error} role="alert">{error} <button disabled={busy} onClick={()=>setRefresh(x=>x+1)}>Atualizar atendimento</button></div>}
     {busy&&<p className={s.status} role="status">Aguarde a confirmação do serviço…</p>}
     <div aria-live="polite" className={s.chat}>{chat.map(item=>item.question?<p className={s.question} key={item.id}>{item.question}</p>:<ResultCard key={item.id} r={item.result} onChooseBank={(i,periodo)=>{setBank({codigo:i.codigo,periodo:String(periodo||'')});setBankName(i.nome);setTab('bankscore');}}/>)}</div>
     {chat.length>0&&<button className={s.clear} disabled={busy} onClick={()=>setChat([])}>Limpar conversa desta aba</button>}
    </section>
   </div>
  </>}
 </div></main>;
}