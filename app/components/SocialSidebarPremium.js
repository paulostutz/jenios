"use client";
import useTrendsData from './useTrendsData';
import NewTokenRadar from './NewTokenRadar';
import {TREND_MODULES,trendDetail,visibleTrendRows} from '../../lib/trends-ui.mjs';
import TrendHelp from './TrendHelp';
import {useEffect,useState} from "react";
import Link from "next/link";

const panel={background:"#fff",border:"1px solid #dce5ef",borderRadius:16,padding:16,color:"#24354e",boxShadow:"0 5px 20px #142d4610"};
const muted="#63758e",blue="#7c3aed";
const fmt=v=>v==null?"N/D":Number(v).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%";
export default function SocialSidebarPremium({operadores = [], onOpenRanking}){
 const {data:trends,error:trendsError,clock}=useTrendsData();
 const [ranking,setRanking]=useState(null),[news,setNews]=useState(null),[newsChecked,setNewsChecked]=useState(null),[newsError,setNewsError]=useState(false);

 useEffect(()=>{let active=true;fetch("/api/bankscore/ranking",{cache:"no-store"}).then(async r=>{const d=await r.json();return r.ok?d:{...d,erro:d.erro||"Falha ao consultar BankScore"}}).then(d=>{if(active)setRanking(d)}).catch(()=>{if(active)setRanking({ranking:[],erro:"Falha de conexão com o BankScore"})});return()=>{active=false}},[]);
 useEffect(()=>{let active=true;async function update(){try{const r=await fetch("/api/social/noticias",{cache:"no-store"});const d=await r.json();if(active){setNews(d);setNewsChecked(new Date());setNewsError(!d.disponivel)}}catch{if(active){setNewsError(true);setNewsChecked(new Date())}}}update();const id=setInterval(update,30000);const onFocus=()=>update();window.addEventListener("focus",onFocus);return()=>{active=false;clearInterval(id);window.removeEventListener("focus",onFocus)}},[]);
 return <div style={{display:"grid",gap:14}}>
 <section style={panel} aria-label="Ranking semanal"><h3 style={{margin:'0 0 8px',fontSize:16,color:blue}}>🏆 Ranking Semanal · Top 5</h3><p style={{fontSize:12,color:muted}}>Ranking em preparação. Os resultados serão publicados após conferência.</p>{[].map((op,i)=><div key={op.handle} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'8px 0',fontSize:12,borderBottom:'1px solid #eef2f6'}}><span>{i+1}º {op.nome}</span><strong style={{color:blue}}>{op.rentabilidade}</strong></div>)}<button onClick={onOpenRanking} style={{border:0,background:'none',padding:'12px 0 0',fontSize:12,color:blue,textDecoration:'underline',cursor:'pointer'}}>Ver ranking completo ↗</button></section>
 <section id="jenios-megapulse" style={panel}><h3 style={{margin:'0 0 10px',fontSize:16,color:blue}}>Hub de Tendências</h3>
 {trendsError&&<p role="status">Não foi possível atualizar agora.</p>}
 {TREND_MODULES.map(({id,label})=><div key={id} style={{fontSize:12,padding:'10px 0',borderBottom:'1px solid #eef2f6'}}><strong>{label}</strong><TrendHelp kind={id}/>
 {!trends?<p>Carregando…</p>:!(trends.modulos?.[id]?.disponivel||trends.modulos?.[id]?.stale)?<p role="status">{trends.modulos?.[id]?.mensagem||'Atualização indisponível.'}</p>:<>
 {trends.modulos?.[id]?.stale&&<p>Dados da última leitura.</p>}
 {id==='baleias'&&trends.modulos?.[id]?.historico&&<p>Últimos três movimentos registrados · histórico</p>}
 {visibleTrendRows(id,trends,clock).slice(0,id==='baleias'?3:2).map((x,i)=><p key={x.id||i}>{x.nome} · {x.simbolo}<small style={{display:'block'}}>{trendDetail(id,x)}</small></p>)}
 {!visibleTrendRows(id,trends,clock).length&&<p>{id==='megapulse'?'Sem movimentos recentes confirmados agora.':'Nenhum registro nesta atualização.'}</p>}
 </>}</div>)}
 <NewTokenRadar compact/>
 <Link href="/tendencias" style={{display:'block',marginTop:12,color:blue}}>Abrir Hub de Tendências ↗</Link></section>
 <section id="jenios-bankscore" style={panel}><h3 style={{margin:"0 0 8px",fontSize:16,color:blue}}>BankScore · Top 5</h3><p style={{fontSize:11,color:muted}}>Maiores índices provisórios disponíveis, não ranking de segurança.</p>{ranking===null?<p>Carregando...</p>:ranking.ranking?.length?ranking.ranking.slice(0,5).map((x,i)=><Link key={x.codigo} href={"/bankscore/instituicao/"+encodeURIComponent(x.codigo)} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"9px 0",color:"#23354e",textDecoration:"none",borderBottom:"1px solid #dce5ef",fontSize:12}}><span style={{flex:1,overflowWrap:"anywhere"}}>{i+1}. {x.nome}</span><strong style={{color:blue,whiteSpace:"nowrap"}}>{fmt(x.percentual)}</strong></Link>):<p style={{fontSize:12}} role="status">{ranking.erro||"Não há instituições elegíveis na base consultada."}</p>}<Link href="/bankscore" style={{display:"inline-block",color:blue,marginTop:12,fontSize:12}}>Consultar BankScore ↗</Link></section>
 <section id="jenios-simulador" style={panel}><h3 style={{margin:"0 0 8px",fontSize:16,color:blue}}>Simulador JENIOS</h3><p style={{fontSize:12,color:muted}}>Diagnóstico e simulação educativa de decisões. Comece abaixo.</p><iframe title="Simulador comportamental JENIOS" src="/social/simulador?embed=1" loading="lazy" style={{width:"100%",height:420,border:"1px solid #dce5ef",borderRadius:12,background:"#f8fafc"}}/><Link href="/social/simulador" style={{display:"block",color:blue,marginTop:9,fontSize:12}}>Abrir em tela cheia ↗</Link></section>
 <section id="jenios-noticias" style={panel}><h3 style={{margin:"0 0 8px",fontSize:16,color:blue}}>Notícias do mercado</h3><p style={{fontSize:11,color:muted}}>Fonte externa · Consulta automática a cada 30 segundos (RSS, não streaming)</p>{newsChecked&&<p style={{fontSize:11,color:muted}}>Última consulta: {newsChecked.toLocaleTimeString("pt-BR")}{newsError?" · Fonte indisponível":""}</p>}{news?.noticias?.length?news.noticias.slice(0,5).map((n,i)=><a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{display:"block",padding:"9px 0",borderBottom:"1px solid #dce5ef",color:"#23354e",fontSize:12,textDecoration:"none"}}>{n.titulo}{n.categorias?.length>0&&<small style={{display:"block",color:blue,marginTop:4}}>{n.categorias.join(" · ")} · Impacto potencial, sem direção prevista</small>}<small style={{display:"block",color:muted,marginTop:4}}>{n.fonte ? n.fonte+" · " : ""}{n.publicadoEm?new Date(n.publicadoEm).toLocaleString("pt-BR"):"Data não informada"} ↗</small></a>):<p style={{color:muted,fontSize:12}}>Fonte indisponível no momento.</p>}</section>
 </div>
}
