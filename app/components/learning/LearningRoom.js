'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../../lib/supabase';
import {STUDY_GUIDES} from '../../../lib/learning/trade-study-guides.mjs';
import {PRACTICAL_STUDY_WORKSHOPS} from '../../../lib/learning/trade-study-workshops-b271.mjs';
import {USER_VIDEO_RESOURCES} from '../../../lib/learning/trade-video-resources.mjs';
import ChartLab from './ChartLab';
import styles from './LearningRoom.module.css';

const NAMES={fundamentos:'Primeiros passos',graficos:'Leitura de gráficos',execucao:'Execução e risco',estrategias:'Estratégias',laboratorio:'Laboratório de robôs'};
const SHORT={fundamentos:'Entenda o mercado e proteja seu capital.',graficos:'Leia candles, tendências e indicadores.',execucao:'Ordens, stops, custos e disciplina.',estrategias:'Estude sinais e padrões sem promessas.',laboratorio:'Teste hipóteses e entenda os resultados.'};

export default function LearningRoom(){
 const [data,setData]=useState(null),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[errorCode,setErrorCode]=useState('');
 const [activeTrack,setActiveTrack]=useState('fundamentos'),[selected,setSelected]=useState(''),[lesson,setLesson]=useState(null);
 const [question,setQuestion]=useState(''),[style,setStyle]=useState('explain'),[reply,setReply]=useState(null);
 const owner=useRef(null),epoch=useRef(0),alive=useRef(false),lock=useRef(false),lessonEpoch=useRef(0),activeAbort=useRef(null);
 const learning=data?.learning,tracks=learning?.route||[],currentTrack=tracks.find(t=>t.id===activeTrack)||tracks[0];
 const guide=STUDY_GUIDES.find(x=>x.trackId===currentTrack?.id);
 const workshops=PRACTICAL_STUDY_WORKSHOPS.filter(x=>x.trackId===currentTrack?.id);
 const references=USER_VIDEO_RESOURCES.filter(x=>x.trackId===currentTrack?.id);
 const allResources=USER_VIDEO_RESOURCES;
 function clear(){setData(null);setLesson(null);setReply(null);setQuestion('');setSelected('');setActiveTrack('fundamentos');}
 async function api(payload,query=''){
  const version=epoch.current,currentOwner=owner.current;
  const auth=await supabase?.auth.getSession(),session=auth?.data?.session;
  if(auth?.error||!session?.access_token||session.user?.is_anonymous||session.user?.id!==currentOwner)
   throw Object.assign(Error('Entre na sua conta para estudar.'),{code:'AUTH_REQUIRED'});
  const response=await fetch('/api/platform/learning'+query,{method:payload?'POST':'GET',cache:'no-store',
   headers:{authorization:'Bearer '+session.access_token,...(payload?{'content-type':'application/json'}:{})},
   ...(payload?{body:JSON.stringify(payload)}:{}),signal:activeAbort.current?.signal});
  const body=await response.json();
  if(!alive.current||version!==epoch.current||currentOwner!==owner.current)
   throw Object.assign(Error('A sessão mudou.'),{code:'STALE_SESSION'});
  if(!response.ok){
   if(Number.isSafeInteger(body.revision))setData(d=>d?{...d,learning:{...d.learning,revision:body.revision}}:d);
   if(response.status===401||response.status===402)clear();
   throw Object.assign(Error(body.error||'Não foi possível concluir.'),{code:body.code||'SERVER_ERROR',status:response.status});
  }
  return body;
 }
 function showError(e){if(e.code==='STALE_SESSION'||e.name==='AbortError')return;setError(e.message);setErrorCode(e.code||'ERROR');}
 async function load(){setBusy(true);setError('');setErrorCode('');try{const body=await api();setData(body);return body;}
  catch(e){showError(e);return null;}finally{if(alive.current)setBusy(false);}}
 useEffect(()=>{
  alive.current=true;
  async function sync(){const v=++epoch.current;activeAbort.current?.abort();activeAbort.current=new AbortController();owner.current=null;lock.current=false;
   clear();setSaving(false);setBusy(true);setError('');setErrorCode('');
   try{const r=await supabase?.auth.getUser();if(!alive.current||v!==epoch.current)return;
    const user=r?.data?.user;if(r?.error||!user?.id||user.is_anonymous)throw Object.assign(Error('Entre na sua conta para estudar.'),{code:'AUTH_REQUIRED'});
    owner.current=user.id;await load();}
   catch(e){if(alive.current&&v===epoch.current){showError(e);setBusy(false);}}
  }
  void sync();
  const sub=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION')return;
   if(session?.user?.id===owner.current&&['TOKEN_REFRESHED','SIGNED_IN','USER_UPDATED'].includes(event))return;
   epoch.current++;activeAbort.current?.abort();owner.current=null;clear();setTimeout(()=>{if(alive.current)void sync();},0);
  });
  return()=>{alive.current=false;epoch.current++;activeAbort.current?.abort();sub?.data?.subscription?.unsubscribe();};
 },[]);
 async function action(input){if(lock.current||!learning)return;lock.current=true;setSaving(true);setError('');setErrorCode('');const v=epoch.current;
  try{const body=await api({...input,revision:learning.revision});setData(body);if(input.action==='tutor')setReply(body.result);return body;}
  catch(e){if(e.code==='REVISION_CONFLICT'){const refreshed=await load();if(refreshed&&alive.current&&v===epoch.current){setError('Seu progresso foi atualizado. Confira a aula e tente novamente.');setErrorCode('REVISION_CONFLICT');}}else showError(e);}
  finally{if(alive.current&&v===epoch.current){setSaving(false);lock.current=false;}}
 }
 function chooseTrack(id){setActiveTrack(id);setSelected('');setLesson(null);setReply(null);setError('');}
 async function openLesson(id){const v=++lessonEpoch.current;setSelected(id);setLesson(null);setReply(null);setQuestion('');setError('');
  try{const body=await api(null,'?lesson='+encodeURIComponent(id));if(v===lessonEpoch.current)setLesson(body.lesson);}catch(e){showError(e);}}
 const studied=tracks.reduce((n,t)=>n+t.lessons.filter(l=>l.completed).length,0);
 const completed=Boolean(currentTrack?.lessons?.find(x=>x.id===lesson?.id)?.completed);
 const completedToday=Boolean(learning?.dailyStudy?.reviewedToday?.includes(lesson?.id));
 const continuing=tracks.flatMap(t=>t.lessons.map(l=>({...l,trackId:t.id}))).find(x=>!x.completed);
 return <main className={styles.shell}><div className={styles.wrap}>
  <header className={styles.header}><div><span className={styles.brand}>UNIVERSIDADE JENIOS</span><h1 aria-label="Universidade JENIOS — aprenda no seu ritmo">Aprenda no seu ritmo</h1><p>Escolha qualquer trilha e comece pela aula que quiser. Sem testes de nivelamento, sem provas obrigatórias e sem bloqueios entre assuntos.</p></div><Link className={styles.link} href="/dashboard-logado">← Gestão da Platform</Link></header>
  {error&&<div role="alert" className={styles.error}>{error} {owner.current&&!saving&&<button className={styles.secondary} onClick={load}>Atualizar</button>}</div>}
  {busy?<div className={styles.banner} role="status">Carregando seus estudos…</div>:!learning?
   <section className={styles.card}><h2>Seu próximo passo começa aqui</h2><p>Seu aprendizado está incluído nos planos de R$ 149,90 e R$ 199,90. Com o plano de R$ 99,90 ou sem assinatura da Platform, você pode contratar somente a Universidade por R$ 49,90 mensais. Após o acesso, escolha livremente qualquer aula, sem provas.</p><div className={styles.actions}><Link className={styles.primary} href="/universidade/entrar">Entrar na minha conta</Link><Link className={styles.secondary} href="/universidade">Universidade · R$ 49,90 por mês</Link><Link className={styles.secondary} href="/social">Conversar com Gênio e Gênia gratuitos</Link></div><p className={styles.small}>{errorCode==='SUBSCRIPTION_REQUIRED'?'Seu acesso atual ainda não inclui a Universidade. Confira as opções de contratação.':'Aulas particulares e progresso exigem autenticação.'}</p></section>
  :<>
   {data?.access?.kind==='admin-preview'&&<p className={styles.banner}>Acesso de revisão administrativa à Universidade.</p>}
   <section className={styles.card} aria-labelledby="choose-track-title">
    <div className={styles.tag}>ESCOLHA O QUE ESTUDAR</div><h2 id="choose-track-title">Por onde você quer começar?</h2>
    <p>Você pode mudar de trilha a qualquer momento. A ordem é uma sugestão, não um requisito.</p>
    <div className={styles.routeGrid} role="group" aria-label="Escolher trilha de estudos">
     {tracks.map((t,i)=><button type="button" key={t.id} className={styles.routeButton} aria-pressed={currentTrack?.id===t.id} onClick={()=>chooseTrack(t.id)}>
      <span className={styles.routeNumber}>{String(i+1).padStart(2,'0')}</span><strong>{NAMES[t.id]||t.title}</strong><span>{SHORT[t.id]||t.description}</span>
      <small>{t.lessons.length} aulas · {t.lessons.filter(x=>x.completed).length} lidas</small>
     </button>)}
    </div>
    <div className={styles.actions}>
     {continuing&&<button className={styles.secondary} type="button" onClick={()=>{chooseTrack(continuing.trackId);void openLesson(continuing.id);}}>Começar próxima aula sugerida →</button>}
     <span className={styles.small}>Seu histórico de leitura está salvo ({studied} de 15 aulas).</span>
    </div>
   </section>
   <div className={styles.layout}>
    <aside className={styles.sidebar} aria-labelledby="lessons-title">
     <div className={styles.tag}>TRILHA ESCOLHIDA</div><h2 id="lessons-title">{NAMES[currentTrack?.id]||currentTrack?.title}</h2>
     <p className={styles.sidebarDescription}>{SHORT[currentTrack?.id]||currentTrack?.description}</p>
     <nav aria-label="Aulas disponíveis">
      {currentTrack?.lessons.map((l,i)=><button type="button" className={styles.lessonButton} aria-current={selected===l.id?'page':undefined} key={l.id} disabled={saving} onClick={()=>openLesson(l.id)}>
       {l.completed?'✓':i+1}. {l.title}
      </button>)}
     </nav>
     <p className={styles.sidebarFoot}>Aulas sempre abertas. Você não precisa fazer testes para continuar.</p>
    </aside>
    <div className={styles.column}>
     {!lesson?<section className={styles.card}><div className={styles.tag}>APRENDA LIVREMENTE</div><h2>{selected?'Carregando a aula…':'Escolha uma aula ao lado'}</h2><p>Comece por qualquer tema. Os exercícios são para sua prática e não exigem nota ou aprovação.</p></section>:<>
      <article className={styles.card}><div className={styles.tag}>AULA · {lesson.minutes} MINUTOS</div><h2>{lesson.title}</h2><p><strong>O que você vai aprender:</strong> {lesson.objective}</p>{lesson.paragraphs.map((p,i)=><p key={i}>{p}</p>)}
       <div className={styles.example}>{lesson.example}</div>{lesson.chart&&<ChartLab/>}
       <div className={styles.practice}><h3>Pratique, se quiser</h3><p>{lesson.exercise}</p></div>
       {completed?<button className={styles.secondary} disabled={saving||completedToday} onClick={()=>action({action:'review_lesson',lessonId:lesson.id})}>{completedToday?'Revisão de hoje registrada ✓':'Marcar revisão opcional'}</button>:
        <button className={styles.primary} disabled={saving} onClick={()=>action({action:'complete_lesson',lessonId:lesson.id})}>{saving?'Salvando…':'Marcar aula como lida'}</button>}
       <div className={styles.sources}><p className={styles.small}>Referências externas complementares (não representam endosso à JENIOS):</p>{lesson.sources.map(x=><a href={x.url} key={x.id} target="_blank" rel="noopener noreferrer">{x.title} ↗</a>)}</div>
      </article>
      <section className={styles.card}><div className={styles.tag}>AJUDA GRATUITA</div><h2>Pergunte ao T.Jenio</h2><p>Explicações, exemplos e dúvidas da aula. Não é necessário responder nenhuma avaliação. O tutor não acessa cotações ou contas de corretoras.</p>
       <p className={styles.small}>{learning.tutorBudget.used}/{learning.tutorBudget.limit} interações utilizadas hoje. Para perguntas avançadas com IA, <Link href="/genios-pro?task=university_tutor">conheça Gênio/Gênia Pro</Link>.</p>
       <form onSubmit={e=>{e.preventDefault();void action({action:'tutor',lessonId:lesson.id,message:question,style});}}>
        <label>Como prefere a explicação?<select value={style} onChange={e=>setStyle(e.target.value)}><option value="explain">Explicar</option><option value="simple">Mais simples</option><option value="example">Dar um exemplo fictício</option><option value="practice">Sugerir uma prática</option><option value="teachback">Comentar minha explicação</option></select></label>
        <label htmlFor="learning-question">Sua dúvida<textarea id="learning-question" maxLength={1800} value={question} onChange={e=>setQuestion(e.target.value)} required placeholder="Ex.: como interpretar uma falsa reversão?"/></label>
        <button className={styles.primary} disabled={saving||!question.trim()}>{saving?'Preparando resposta…':'Enviar pergunta'}</button>
       </form>
       {reply&&<div className={styles.reply} aria-live="polite"><div className={styles.tag}>{reply.mode==='ai'?'Resposta gerada por IA':'Explicação guiada pela aula'}</div>{reply.explanation}<p><strong>Para praticar:</strong> {reply.exercise}</p><p className={styles.small}>{reply.notice}</p></div>}
      </section>
     </>}
     {guide&&<section className={styles.card} aria-label="Aprofundamento original JENIOS"><div className={styles.tag}>ESTUDO COMPLEMENTAR</div><h2>{guide.title}</h2><p>{guide.concept}</p><div className={styles.example}><strong>Prática sugerida:</strong> {guide.activity}</div><details><summary className={styles.moreSummary}>Explorar os conceitos desta trilha</summary>{guide.topics?.map(topic=><div key={topic.title}><h3>{topic.title}</h3><p>{topic.explanation}</p></div>)}</details><p className={styles.small}>Síntese educativa original da JENIOS; não é transcrição de vídeo nem sinal de operação.</p></section>}
     {workshops.length>0&&<section className={styles.card} aria-label="Oficinas de estudo"><div className={styles.tag}>APROFUNDAMENTO LIVRE</div><h2>Oficinas práticas opcionais</h2><p>Dez atividades originais para ampliar as cinco trilhas. Não vale nota e não desbloqueia operações.</p>{workshops.map(w=><details key={w.id}><summary className={styles.moreSummary}>{w.title}</summary><p>{w.explanation}</p><ol>{w.steps.map((step,i)=><li key={i}>{step}</li>)}</ol><div className={styles.example}><strong>Exemplo didático:</strong> {w.example}</div><p><strong>Experimente:</strong> {w.practice}</p><p><strong>Como conferir:</strong> {w.selfCheck}</p><p className={styles.small}>{w.caution} Material educativo original, sem sinal nem transcrição copiada.</p></details>)}</section>}
     {references.length>0&&<section className={styles.card}><h2>Vídeos relacionados para conferir</h2><p className={styles.small}>Títulos confirmados na fonte; quando existem legendas, os conceitos foram estudados. Não foram auditadas taxas de acerto nem todas as imagens.</p>{references.map(x=><p key={x.id}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.title} ↗</a><span className={styles.small}> — {x.note}</span></p>)}</section>}
     <section className={styles.card}><details><summary className={styles.moreSummary}>Biblioteca de vídeos e playlists enviados ({allResources.length} links)</summary><p className={styles.small}>Explore os links enviados, sem testes obrigatórios. Materiais novos ficam marcados como pendentes de revisão até conferirmos título e conteúdo. Isso não representa sinal de operação.</p><ul className={styles.resourceList}>{allResources.map(x=><li key={x.id}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.title} ↗</a><span>{x.verification==='transcript_reviewed'?'Legenda analisada':x.verification==='needs_video_review'?'Novo material — conteúdo a conferir':x.verification.startsWith('metadata_verified')?'Título confirmado; sem regras completas':'Playlist a conferir'}</span></li>)}</ul></details></section>
     <p className={styles.small}>{learning.notice}</p>
    </div>
   </div>
  </>}
 </div></main>;
}
