'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import SocialFreeLauncher from '../components/assistant/SocialFreeLauncher';
import DemoBrokerConnector from '../components/platform/DemoBrokerConnector';
import {CONNECTION_GUIDES,CONNECTION_SAFETY,connectionGuide,guideHref,guideSources} from '../../lib/platform/connections/catalog.mjs';
import {preparationChecklist} from '../../lib/platform/connections/support.mjs';
import s from './connections.module.css';
const categories={all:'Todas',cripto:'Criptomoedas',b3:'B3 / Profit',global:'Mercados globais'};
export default function IntegracoesPage(){
 const [selected,setSelected]=useState('binance'),[category,setCategory]=useState('all'),[query,setQuery]=useState(''),[answers,setAnswers]=useState({}),[notice,setNotice]=useState('');
 const heading=useRef(null);const guide=connectionGuide(selected)||CONNECTION_GUIDES[0];
 useEffect(()=>{const sync=()=>{const id=new URLSearchParams(window.location.search).get('provider');if(connectionGuide(id)){setSelected(id);setAnswers({});setNotice('');}};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
 function choose(id){if(!connectionGuide(id))return;setSelected(id);setAnswers({});setNotice('');window.history.pushState(null,'',guideHref(id));setTimeout(()=>heading.current?.focus(),0);}
 const normalized=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const guides=CONNECTION_GUIDES.filter(g=>(category==='all'||g.category===category)&&[g.name,...g.aliases].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(normalized));
 return <main className={s.page}>
  <div className={s.shell}>
   <nav className={s.top}><Link href="/dashboard-logado">← Sala de controle</Link><Link href="/mesa-operacoes">Mesa de operações</Link><Link href="/genios-pro">Gênios Pro</Link></nav>
   <header className={s.hero}><p className={s.eyebrow}>JENIOS • CONEXÕES INDIVIDUAIS</p><h1>Sua corretora.<br/>Nossa tecnologia.</h1><p>Entenda como conectar sua conta, quais permissões são necessárias e o que já está preparado. Seus recursos permanecem na instituição escolhida.</p><div className={s.stats}><span><strong>{CONNECTION_GUIDES.length}</strong> guias revisados</span><span><strong>0</strong> conexões certificadas nesta tela</span><span><strong>Sem custódia</strong> e sem saques</span></div></header>
   <div className={s.safety} role="note"><strong>Antes de começar</strong><p>{CONNECTION_SAFETY}</p></div>
   <div className={s.safety} role="status"><strong>Estado das APIs de corretoras</strong><p>Binance Spot Testnet e Alpaca Paper: leitores de consulta demonstrativa implementados, aguardando homologação autenticada de contas externas. Os outros 10 fornecedores possuem guias, mas não conectores instalados. Nenhuma integração desta página autoriza ordens reais, custódia ou saques.</p></div>
   {process.env.NEXT_PUBLIC_JENIOS_DEMO_CONNECTORS_UI==='true'&&<DemoBrokerConnector provider={guide.id}/>}
   <div className={s.workspace}>
    <aside className={s.selector} aria-label="Escolha uma corretora ou plataforma">
     <label className={s.field}>Pesquisar corretora ou plataforma<input type="search" maxLength={80} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Binance, Profit, XP, MT5…"/></label>
     <label className={s.field}>Mercado<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(categories).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
     <nav className={s.providerList} aria-label="Guias disponíveis">{guides.map(g=><button type="button" key={g.id} data-provider={g.id} aria-current={g.id===guide.id?'page':undefined} onClick={()=>choose(g.id)}><strong>{g.name}</strong><small>{g.kind}</small></button>)}</nav>
     {!guides.length&&<p role="status">Fornecedor não encontrado nesta seleção. Isso não confirma nem descarta uma integração futura.</p>}
     <p className={s.small}>Não é uma lista de todas as instituições do mundo. Novos conectores precisam ter documentação e capacidades verificadas.</p>
    </aside>
    <article className={s.guide} data-connection-guide={guide.id}>
     <header><p className={s.eyebrow}>{categories[guide.category]} • {guide.kind}</p><h2 tabIndex={-1} ref={heading}>{guide.name}</h2><p className={s.status}>{guide.status}</p><p>{guide.method}</p></header>
     <section className={s.section}><h3>O que você precisa</h3><ul>{guide.requirements.map(x=><li key={x}>{x}</li>)}</ul>{guide.note&&<p className={s.note}>{guide.note}</p>}</section>
     <section className={s.section} aria-label="Passo a passo"><h3>Passo a passo da integração</h3><p className={s.small}>Marque apenas os passos que leu. O checklist não envia dados, não salva credenciais e não valida sua conta. A seleção é temporária nesta página.</p><ol className={s.steps}>{guide.steps.map((step,i)=><li key={guide.id+step.id}><div className={s.stepHead}><span aria-hidden="true">{i+1}</span><h4>{step.title}</h4></div><p>{step.text}</p><label className={s.check}><input type="checkbox" checked={answers[step.id]===true} onChange={e=>{setAnswers(a=>({...a,[step.id]:e.target.checked}));setNotice('');}}/>Li este passo</label></li>)}</ol><button type="button" className={s.button} onClick={()=>setNotice(preparationChecklist(guide.id,answers).message)}>Conferir meu checklist</button>{notice&&<p role="status" className={s.note}>{notice}</p>}</section>
     <section className={s.section}><h3>Campos e permissões explicados</h3><p className={s.small}>Estas são descrições, não campos para inserir chaves. {process.env.NEXT_PUBLIC_JENIOS_DEMO_CONNECTORS_UI==='true'?'Use somente o painel protegido de testes acima; estes campos do guia não recebem chaves.':'O recebimento seguro de credenciais ainda não está habilitado.'}</p><dl className={s.fields}>{guide.fields.map(f=><div key={f.name}><dt>{f.name}</dt><dd>{f.help}</dd></div>)}</dl><div className={s.blocked}><strong>{process.env.NEXT_PUBLIC_JENIOS_DEMO_CONNECTORS_UI==='true'?'Operações financeiras reais ainda não liberadas':'Conexão de conta e negociação ainda não liberadas'}</strong><p>Os guias e ensaios não substituem autenticação, verificação de titularidade, proteção das ordens e validação do conector. Nenhum botão desta página ativa dinheiro real.</p></div></section>
     <section className={s.section}><h3>Problemas comuns</h3>{guide.troubleshooting.map(item=><details className={s.detail} key={item.problem}><summary>{item.problem}</summary><p>{item.solution}</p></details>)}</section>
     <section className={s.section}><h3>Como revogar ou desconectar</h3><p>{guide.revocation}</p><p className={s.small}>Desconectar não significa cancelar ordens, zerar posições ou retirar dinheiro.</p></section>
     <section className={s.section}><h3>Gênio e Gênia explicam gratuitamente</h3><p>Abra o assistente no canto inferior direito, escolha com quem conversar e use a pergunta <strong>“Como conectar {guide.name} à JENIOS?”</strong>. Os dois usam este mesmo guia e podem orientar sobre erros e revogação, sem pedir seus segredos.</p><p className={s.small}>Esta ajuda usa material revisado, não consome créditos Pro e não acessa sua corretora.</p></section>
     <footer className={s.sources}><h3>Documentação oficial</h3><p>Revisão do guia: {guide.reviewedAt}. Menus, licenças e disponibilidade podem mudar; confirme no fornecedor antes de conceder acesso.</p>{guideSources(guide).map(source=><a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>)}</footer>
    </article>
   </div>
   <footer className={s.bottom}>Integração de negociação não é integração de pagamentos. Assinaturas e cobranças permanecem separadas na JENIOS PAY. <Link href="/dashboard-logado">Voltar à gestão da conta</Link>.</footer>
  </div>
  <SocialFreeLauncher key={guide.id} guideQuestion={'Como conectar '+guide.name+' à JENIOS?'}/>
 </main>;
}
