"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
const c={gold:"#d8bb7d",muted:"#a7b7cc",card:"#12243a",border:"#324862"};
const panel={background:c.card,border:"1px solid "+c.border,borderRadius:17,padding:18,minWidth:0,boxShadow:"0 14px 34px #0002"};
const nav=[["Feed","#jenios-feed"],["Ranking","#jenios-ranking"],["Simulador","#jenios-simulador"],["MegaPulse","#jenios-megapulse"],["BankScore","#jenios-bankscore"],["Validador","#jenios-validador"],["Notícias","#jenios-noticias"],["Especialistas","#jenios-especialistas"]];
function percent(v){return v==null?"N/D":Number(v).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%";}
export default function SocialIntelligence(){
 const [top,setTop]=useState(null),[noticias,setNoticias]=useState(null),[updated,setUpdated]=useState("");
 useEffect(()=>{
  let live=true;
  async function refresh(){
   try{const r=await fetch("/api/social/noticias",{cache:"no-store"});const j=await r.json();if(live){setNoticias(j);setUpdated(new Date().toLocaleTimeString("pt-BR"))}}catch{if(live)setNoticias({noticias:[],disponivel:false})}
  }
  refresh();const t=setInterval(refresh,300000);return()=>{live=false;clearInterval(t)}
 },[]);
 useEffect(()=>{fetch("/api/bankscore/ranking",{cache:"no-store"}).then(r=>r.json()).then(setTop).catch(()=>setTop({ranking:[]}))},[]);
 return <section id="jenios-inteligencia" style={{fontFamily:"Inter,-apple-system,Segoe UI,sans-serif",background:"linear-gradient(145deg,#071321,#142a45)",color:"#f4f7fb",padding:"24px clamp(12px,3vw,30px)",borderBottom:"1px solid #344862"}}>
 <div style={{maxWidth:1440,margin:"auto"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:18}}>
 <div><div style={{fontSize:11,color:c.gold,letterSpacing:2.5,fontWeight:800}}>JENIOS · INTELLIGENCE</div><h2 style={{fontSize:"clamp(22px,3vw,32px)",margin:"5px 0"}}>O mercado em uma única visão.</h2><p style={{color:c.muted,margin:0,fontSize:13}}>Comunidade, pesquisa e inteligência financeira em tempo real quando houver fonte disponível.</p></div>
 <Link href="/bankscore" style={{background:c.gold,color:"#0b1524",padding:"11px 17px",borderRadius:10,textDecoration:"none",fontWeight:800}}>Abrir BankScore ↗</Link>
 </div>
 <nav aria-label="Navegação do ecossistema" style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:12,marginBottom:12}}>
 {nav.map(([name,href])=><a key={name} href={href} style={{color:"#e9f1fa",border:"1px solid "+c.border,background:"#182c46",borderRadius:9,padding:"9px 12px",whiteSpace:"nowrap",fontSize:12,textDecoration:"none",fontWeight:700}}>{name}</a>)}
 </nav>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,310px),1fr))",gap:14}}>
 <div id="jenios-simulador" style={{...panel,gridColumn:"1/-1"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h3 style={{margin:"0 0 10px",fontSize:18}}>Simulador JENIOS · 15 operações</h3><Link href="/social/simulador" style={{color:c.gold,fontSize:12}}>Abrir em tela cheia ↗</Link></div>
 <p style={{color:c.muted,fontSize:12,margin:"0 0 12px"}}>O simulador permanece aberto na página para iniciar a experiência sem navegação adicional.</p>
 <iframe title="Simulador JENIOS" loading="lazy" src="/social/simulador" style={{width:"100%",height:440,border:"1px solid "+c.border,borderRadius:12,background:"#f5f7fa"}}/>
 </div>
 <div id="jenios-megapulse" style={panel}><h3 style={{marginTop:0}}>◉ MegaPulse</h3><p style={{color:c.muted,fontSize:13}}>Megatendências · Baleias · Tokens emergentes</p><div style={{border:"1px dashed "+c.border,padding:13,borderRadius:10,color:c.gold,fontSize:13}}>Aguardando integração com provedores on-chain verificáveis.</div><p style={{fontSize:12,color:c.muted}}>Nenhum token será classificado como “explosivo” sem dados verificáveis de liquidez, concentração e riscos contratuais.</p><Link href="/tendencias" style={{color:c.gold,fontSize:12}}>Explorar tendências ↗</Link></div>
 <div id="jenios-bankscore" style={panel}><h3 style={{marginTop:0}}>▥ BankScore · Top 5</h3><p style={{fontSize:12,color:c.muted}}>Maiores índices provisórios da base de homologação. Não é ranking de segurança.</p>{!top?<p>Carregando...</p>:top.ranking?.length?top.ranking.slice(0,5).map((x,i)=><Link href={"/bankscore/instituicao/"+encodeURIComponent(x.codigo)} key={x.codigo} style={{display:"flex",justifyContent:"space-between",gap:10,color:"#eaf0f7",padding:"9px 0",borderBottom:"1px solid "+c.border,textDecoration:"none",fontSize:12}}><span style={{flex:1}}><b style={{color:c.gold,marginRight:8}}>{i+1}.</b>{x.nome}</span><b style={{color:c.gold,whiteSpace:"nowrap"}}>{percent(x.percentual)}</b></Link>):<p style={{fontSize:12}}>Dados indisponíveis.</p>}<Link href="/bankscore" style={{display:"inline-block",marginTop:12,color:c.gold,fontSize:12}}>Ver todas as instituições ↗</Link></div>
 <div id="jenios-noticias" style={panel}><h3 style={{marginTop:0}}>◷ Notícias do mercado</h3><p style={{color:c.muted,fontSize:12}}>Atualização automática a cada 5 minutos · {updated||"Consultando..."}</p>{noticias?.noticias?.length?noticias.noticias.slice(0,5).map((x,i)=><a key={i} href={x.url} target="_blank" rel="noopener noreferrer" style={{display:"block",padding:"10px 0",borderBottom:"1px solid "+c.border,color:"#edf2fa",textDecoration:"none",fontSize:12}}>{x.titulo}<small style={{display:"block",color:c.muted,marginTop:3}}>{x.publicadoEm?new Date(x.publicadoEm).toLocaleString("pt-BR"):"Data não informada"} · Fonte externa ↗</small></a>):<p style={{color:c.gold,fontSize:13}}>Fonte de notícias indisponível no momento. Nenhuma manchete fictícia será exibida.</p>}</div>
 <div id="jenios-validador" style={panel}><h3 style={{marginTop:0}}>◇ Validador de ativos digitais</h3><p style={{fontSize:13,color:c.muted}}>Verificação de contratos, carteiras e transações. Autenticidade e liquidez são análises distintas.</p><a href="#jenios-validador-existente" style={{color:c.gold,fontSize:12}}>Ir ao validador completo ↓</a></div>
 <div id="jenios-especialistas" style={panel}><h3 style={{marginTop:0}}>♜ Área do Especialista</h3><p style={{fontSize:13,color:c.muted}}>Credenciais, experiência, lives e resultados verificáveis. Estrutura de dados profissionais em preparação.</p><span style={{color:c.gold,fontSize:12}}>Integração com JENIOS Platform: pendente</span></div>
 </div>
 <p style={{color:c.muted,fontSize:11,margin:"16px 0 0"}}>Informações de terceiros podem ter atraso. Indicadores financeiros em homologação; não constituem recomendação de investimento.</p>
 </div></section>
}
