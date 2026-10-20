'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
import SocialChargeButton from '../components/SocialChargeButton';
import {moneyToCents} from '../../lib/pay/catalog.mjs';
import {boostDestination} from '../../lib/social/boost.mjs';
import {boostDemographicTarget} from '../../lib/social/boost-audience.mjs';
import {WHATSAPP_COUNTRIES,whatsappDestination} from '../../lib/social/boost-whatsapp.mjs';
import {POST_FIELDS,publicPost} from '../../lib/social/schema.mjs';
import s from './boost.module.css';
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const objectiveLabels={profile:'Visitas ao perfil',website:'Redirecionar para site',whatsapp:'Conversas no WhatsApp',copy:'Conhecer proposta / copy'};
export default function ImpulsionarPostPage(){
 const [posts,setPosts]=useState([]),[message,setMessage]=useState(''),[postId,setPostId]=useState(''),[loading,setLoading]=useState(true),[owner,setOwner]=useState(null);
 const [dailyBudget,setDailyBudget]=useState('25.00'),[days,setDays]=useState(7),[objective,setObjective]=useState('profile');
 const [country,setCountry]=useState('Brasil'),[region,setRegion]=useState(''),[city,setCity]=useState(''),[destination,setDestination]=useState('');
 const [phoneCountry,setPhoneCountry]=useState('BR'),[phone,setPhone]=useState(''),[customDdi,setCustomDdi]=useState('');
 const [ageMode,setAgeMode]=useState('all'),[ageMin,setAgeMin]=useState(18),[ageMax,setAgeMax]=useState(65),[sex,setSex]=useState('all');
 const [readiness,setReadiness]=useState(null),[readinessError,setReadinessError]=useState(''),[refresh,setRefresh]=useState(0),[reviewed,setReviewed]=useState(false);
 const epoch=useRef(0);
 useEffect(()=>{
  let active=true;
  async function load(){
   const version=++epoch.current;setPosts([]);setPostId('');setMessage('');setOwner(null);setLoading(true);setReviewed(false);
   try{
    if(!supabase)throw Error('O acesso está temporariamente indisponível.');
    const result=await supabase.auth.getUser(),user=result.data?.user;
    if(result.error||!user||user.is_anonymous)throw Error('Entre na sua conta para escolher uma publicação.');
    const {data,error}=await supabase.from('posts').select(POST_FIELDS).eq('author_id',user.id).is('archived_at',null).order('created_at',{ascending:false}).limit(100);
    if(error)throw Error('Não foi possível carregar suas publicações.');
    if(active&&version===epoch.current){const own=(data||[]).filter(p=>p.author_id===user.id&&!p.archived_at).map(publicPost);const query=new URLSearchParams(window.location.search).get('post');setPosts(own);setPostId(own.some(p=>p.id===query)?query:own[0]?.id||'');setOwner(user.id);}
   }catch(error){if(active&&version===epoch.current)setMessage(error.message);}finally{if(active&&version===epoch.current)setLoading(false);}
  }
  void load();const listener=supabase?.auth.onAuthStateChange((event)=>{if(['INITIAL_SESSION','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;epoch.current++;setPosts([]);setPostId('');setOwner(null);setDestination('');setPhone('');setReviewed(false);setTimeout(()=>{if(active)void load();},0);});
  return()=>{active=false;epoch.current++;listener?.data?.subscription?.unsubscribe();};
 },[]);
 useEffect(()=>{let live=true;const controller=new AbortController();setReadiness(null);setReadinessError('');fetch('/api/social/promotions/readiness',{cache:'no-store',signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok||typeof body.ready!=='boolean')throw Error();if(live)setReadiness(body);}).catch(error=>{if(live&&error.name!=='AbortError')setReadinessError('Não foi possível conferir a disponibilidade do pagamento.');});return()=>{live=false;controller.abort();};},[refresh]);
 let dailyCents=0,finalDestination='',problem='';const selected=posts.find(p=>p.id===postId);
 try{
  if(!selected)throw Error('Selecione uma publicação própria para continuar.');
  dailyCents=moneyToCents(dailyBudget);
  if(dailyCents<1000||dailyCents>1000000)throw Error('O orçamento diário deve ficar entre R$ 10 e R$ 10.000.');
  if(!Number.isInteger(days)||days<1||days>365)throw Error('A duração deve ser de 1 a 365 dias.');
  if(dailyCents*days>100000000)throw Error('O total da campanha excede o limite de contratação.');
  if(!country.trim())throw Error('Informe o país do público.');
  boostDemographicTarget({ageMin:ageMode==='all'?null:ageMin,ageMax:ageMode==='all'?null:ageMax,sex});
  if(objective==='whatsapp')finalDestination=whatsappDestination(phoneCountry,phone,customDdi);
  else if(objective!=='profile'){finalDestination=boostDestination(destination,objective);if(!finalDestination)throw Error('Informe o endereço HTTPS de destino.');}
 }catch(error){problem=error.message;}
 const target={postId,dailyBudget,days,objective,country,region,city,ageMin:ageMode==='all'?null:ageMin,ageMax:ageMode==='all'?null:ageMax,sex,...(finalDestination?{destination:finalDestination}:{})};
 const selectedDdi=WHATSAPP_COUNTRIES.find(c=>c.code===phoneCountry)?.ddi||customDdi;
 const signature=JSON.stringify(target);
 useEffect(()=>setReviewed(false),[signature]);
 return <main className={s.page}><div className={s.wrap}>
  <nav className={s.nav}><Link href="/social">← Voltar à Social</Link><Link href="/impulsionar/campanhas">Minhas campanhas</Link></nav>
  <p className={s.eyebrow}>JENIOS ADS</p><h1>Impulsionar publicação</h1><p className={s.intro}>Escolha a publicação, o destino e o público. Confira a prévia e o investimento antes de iniciar o pagamento.</p>
  {message&&<p className={s.error} role="alert">{message} {!owner&&<Link href="/login">Entrar na JENIOS</Link>}</p>}
  <div className={s.grid}><div>
   <section className={s.card}><h2>1. Publicação e objetivo</h2><label className={s.field}>Publicação<select value={postId} disabled={loading} onChange={e=>setPostId(e.target.value)}><option value="">{loading?'Carregando publicações…':'Selecione sua publicação'}</option>{posts.map(p=><option key={p.id} value={p.id}>{p.body?.slice(0,90)||'Publicação com mídia'} · {new Date(p.created_at).toLocaleDateString('pt-BR')}</option>)}</select></label>
    {!loading&&!posts.length&&<p className={s.empty}>Nenhuma publicação própria não arquivada disponível.</p>}
    <label className={s.field}>Objetivo<select value={objective} onChange={e=>{setObjective(e.target.value);setDestination('');}}>{Object.entries(objectiveLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    {objective==='whatsapp'?<><div className={s.fields}><label className={s.field}>País do WhatsApp<select value={phoneCountry} onChange={e=>setPhoneCountry(e.target.value)}>{WHATSAPP_COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}{c.ddi?' (+'+c.ddi+')':''}</option>)}</select></label>{phoneCountry==='OTHER'&&<label className={s.field}>DDI<input inputMode="numeric" maxLength={4} value={customDdi} onChange={e=>setCustomDdi(e.target.value.replace(/\D/g,''))}/></label>}<label className={s.field}>DDD e número do WhatsApp<input type="tel" inputMode="tel" autoComplete="off" maxLength={24} placeholder={phoneCountry==='BR'?'11 99999-9999':'Código de área + telefone'} value={phone} onChange={e=>setPhone(e.target.value)}/></label></div><div className={s.destination}>Link da campanha: <code>{finalDestination||'https://wa.me/'+selectedDdi+'…'}</code></div><p className={s.small}>O https://wa.me/ e o DDI já estão preenchidos. Digite apenas o restante do número. O botão do anúncio abrirá uma conversa; a JENIOS não enviará mensagens automaticamente.</p></>:objective!=='profile'&&<label className={s.field}>Endereço de destino<input type="url" placeholder="https://seusite.com.br" value={destination} maxLength={1500} onChange={e=>setDestination(e.target.value)}/></label>}
   </section>
   <section className={s.card}><h2>2. Público da campanha</h2><div className={s.fields}>{[['País',country,setCountry],['Estado / região',region,setRegion],['Cidade',city,setCity]].map(([label,value,set])=><label className={s.field} key={label}>{label}<input value={value} maxLength={80} onChange={e=>set(e.target.value)}/></label>)}</div>
    <div className={s.fields}><label className={s.field}>Faixa de idade<select value={ageMode} onChange={e=>setAgeMode(e.target.value)}><option value="all">Sem filtro de idade</option><option value="range">Escolher faixa etária (18+)</option></select></label><label className={s.field}>Sexo<select value={sex} onChange={e=>setSex(e.target.value)}><option value="all">Todos / sem filtro</option><option value="female">Feminino</option><option value="male">Masculino</option><option value="other">Outra opção autodeclarada</option></select></label></div>
    {ageMode==='range'&&<div className={s.fields}><label className={s.field}>Idade mínima<input type="number" min="18" max="120" value={ageMin} onChange={e=>setAgeMin(e.target.value===''?'':Number(e.target.value))}/></label><label className={s.field}>Idade máxima<input type="number" min="18" max="120" value={ageMax} onChange={e=>setAgeMax(e.target.value===''?'':Number(e.target.value))}/></label></div>}
    <p className={s.small}>Região, idade e sexo são autodeclarados pelos visitantes. Com filtros, somente quem informou dados compatíveis será elegível. Não inferimos esses dados por fotos ou nomes. A distribuição é interna na JENIOS, sem alcance garantido.</p>
   </section>
   <section className={s.card}><h2>3. Orçamento e duração</h2><div className={s.fields}><label className={s.field}>Orçamento diário (R$)<input type="number" min="10" max="10000" step="0.01" value={dailyBudget} onChange={e=>setDailyBudget(e.target.value)}/></label><label className={s.field}>Duração em dias<input type="number" min="1" max="365" value={days} onChange={e=>setDays(e.target.value===''?'':Number(e.target.value))}/></label></div><p className={s.small}>O prazo começa na ativação e continua correndo durante pausas. Exibições e cliques não geram débitos adicionais.</p></section>
  </div><aside className={s.aside}>
   <section className={s.card}><h2>Prévia da publicação</h2>{selected?<article className={s.preview} data-boost-preview={selected.id}><div className={s.postBody}><strong>Sua publicação</strong><small style={{display:'block',color:'#64748b'}}>{new Date(selected.created_at).toLocaleDateString('pt-BR')}</small>{selected.body&&<p>{selected.body}</p>}</div>{selected.media.length>0&&<div className={s.media}>{selected.media.map((item,index)=><figure key={item.url+index}>{item.type==='video'?<video controls playsInline preload="metadata" src={item.url}/>:<img src={item.url} alt={'Imagem '+(index+1)+' da publicação selecionada'} loading="lazy"/>}<figcaption>{index+1} de {selected.media.length}{item.type==='video'?' · Vídeo':''}</figcaption></figure>)}</div>}<div className={s.postBody}><strong>{objectiveLabels[objective]}</strong>{finalDestination&&<p className={s.small} style={{overflowWrap:'anywhere'}}>{finalDestination}</p>}</div></article>:<p className={s.empty}>A prévia aparece assim que você seleciona uma publicação. Fotos e vídeos não são substituídos por exemplos.</p>}
    <div className={s.summary}><span>Investimento total</span><strong>{dailyCents&&Number.isInteger(days)&&days>0?money(dailyCents*days):'Confira os valores'}</strong><span className={s.small}>{days} dias × {money(dailyCents)} por dia</span></div>
    {problem&&<p className={s.notice} role="status">{problem}</p>}
    {!readiness&&!readinessError&&<p className={s.small} role="status">Verificando a disponibilidade do pagamento…</p>}
    {(readiness?.ready===false||readinessError)&&<div className={s.notice} role="status"><p>{readinessError||readiness.message}</p><button type="button" className={s.button} onClick={()=>setRefresh(n=>n+1)}>Verificar pagamento novamente</button><p className={s.small}>A seleção do objetivo não gera cobrança. Nenhum pedido será criado enquanto o pagamento estiver indisponível.</p></div>}
    {!problem&&readiness?.ready&&<><label className={s.radio} style={{margin:'18px 0'}}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>Conferi a publicação, o público, o destino e o total de {money(dailyCents*days)}.</span></label>{reviewed?<SocialChargeButton key={owner} productCode="social-boost" label={readiness.method==='pix'?'Gerar pagamento Pix':'Continuar para pagamento'} target={target}/>:<button disabled className={s.button+' '+s.cta}>Confirme os dados acima para continuar</button>}</>}
    <p className={s.small}>O total é conferido no servidor. Pagamento e ativação da campanha dependem de confirmação. {readiness?.method==='pix'?'O meio configurado é Pix, não boleto bancário.':''}</p>
   </section>
  </aside></div>
 </div></main>;
}
