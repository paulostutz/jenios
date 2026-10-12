"use client";
import {useState} from "react";
import Link from "next/link";
const purple="#6d28d9";
const card={background:"#fff",border:"1px solid #e7e4f0",borderRadius:16,padding:20,boxShadow:"0 8px 25px #23133c09"};
export default function Insights(){
 const [periodo,setPeriodo]=useState(30),[aba,setAba]=useState("Visão geral");
 const labels=["Visualizações","Contas alcançadas","Interações","Seguidores líquidos"];
 return <main style={{minHeight:"100vh",background:"#f6f5fb",padding:"30px 16px",fontFamily:"Inter,Arial,sans-serif",color:"#251c39"}}><div style={{maxWidth:1000,margin:"auto"}}>
 <Link href="/social" style={{color:purple,fontWeight:700}}>← Voltar à Social</Link>
 <p style={{color:purple,fontSize:12,fontWeight:800,letterSpacing:2,marginTop:26}}>JENIOS SOCIAL ANALYTICS</p>
 <h1 style={{fontSize:"clamp(28px,4vw,38px)",margin:"6px 0"}}>Insights do perfil</h1>
 <p style={{color:"#64748b"}}>Evolução de audiência e desempenho do conteúdo.</p>
 <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"16px 0 20px"}}>{[7,30,90].map(n=><button key={n} onClick={()=>setPeriodo(n)} style={{background:n===periodo?purple:"#fff",color:n===periodo?"#fff":purple,border:"1px solid #ddd6fe",borderRadius:9,padding:"10px 15px",fontWeight:800,cursor:"pointer"}}>{n} dias</button>)}</div>
 <nav style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>{["Visão geral","Conteúdo","Público"].map(n=><button key={n} onClick={()=>setAba(n)} style={{padding:"10px 15px",borderRadius:9,border:"1px solid #e7e4f0",background:aba===n?"#ede9fe":"#fff",color:purple,fontWeight:700,cursor:"pointer"}}>{n}</button>)}</nav>
 {aba==="Visão geral"?<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>{labels.map(l=><section key={l} style={card}><small style={{color:"#64748b"}}>{l} · {periodo} dias</small><h2 style={{color:purple,fontSize:29,margin:"10px 0"}}>—</h2><small style={{color:"#64748b"}}>Aguardando eventos reais</small></section>)}</div>
 <section style={{...card,marginTop:18}}><h2>Evolução diária</h2><div style={{height:170,display:"grid",placeItems:"center",border:"1px dashed #d7cdeb",borderRadius:12,color:"#64748b",textAlign:"center",padding:12}}>Gráfico disponível após registro de visualizações por data.</div></section></>:<section style={card}><h2>{aba}</h2><p style={{color:"#64748b",lineHeight:1.7}}>Este painel exibirá {aba==="Conteúdo"?"métricas individuais de posts, stories, vídeos e lives":"seguidores e não seguidores, crescimento e distribuição de audiência"} quando houver eventos reais persistidos.</p></section>}
 <p style={{fontSize:13,color:"#64748b",lineHeight:1.7,marginTop:20}}>O sistema não inventa métricas. Para exibir números confiáveis, é necessário registrar visualizações, visitantes únicos, interações e seguidores no backend, com proteção contra contagens artificiais e regras de privacidade.</p>
 </div></main>
}
