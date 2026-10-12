"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
const purple="#6d28d9";
const field={width:"100%",boxSizing:"border-box",border:"1px solid #d8d1e8",borderRadius:10,padding:"12px 14px",background:"#fff",color:"#241c39",fontSize:14};
const blank={nome:"",cargo:"",especialidades:"",experiencia:"",certificacoes:"",youtube:"",sobre:""};
export default function EspecialistasPage(){
 const [profile,setProfile]=useState(blank),[saved,setSaved]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{try{const d=JSON.parse(localStorage.getItem("jenios_especialista_rascunho")||"null");if(d&&typeof d==="object")setProfile({...blank,...d})}catch{}setReady(true)},[]);
 function change(k,v){setProfile(p=>({...p,[k]:v}));setSaved(false)}
 function save(e){e.preventDefault();try{localStorage.setItem("jenios_especialista_rascunho",JSON.stringify(profile));setSaved(true)}catch{setSaved(false)}}
 const youtubeValid=!profile.youtube||/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(profile.youtube);
 return <main style={{minHeight:"100vh",background:"#f6f5fb",color:"#241c39",padding:"30px 16px",fontFamily:"Inter,Arial,sans-serif"}}><div style={{maxWidth:1080,margin:"auto"}}>
 <Link href="/social" style={{color:purple,fontWeight:800,textDecoration:"none"}}>← Voltar à JENIOS Social</Link>
 <p style={{color:purple,fontWeight:800,fontSize:12,letterSpacing:2,marginTop:28}}>JENIOS SOCIAL · PERFIL PROFISSIONAL</p>
 <h1 style={{fontSize:"clamp(28px,4vw,40px)",margin:"8px 0"}}>Área do Especialista</h1>
 <p style={{color:"#64748b",maxWidth:750,lineHeight:1.7}}>Apresente sua experiência, especialidades e conteúdo profissional. Este formulário salva um rascunho somente neste navegador; ainda não publica um perfil para outros usuários.</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,330px),1fr))",gap:20}}>
 <form onSubmit={save} style={{background:"#fff",border:"1px solid #e6e0f0",padding:24,borderRadius:18,display:"grid",gap:14}}>
 <h2 style={{fontSize:20,margin:0}}>Seu currículo financeiro</h2>
 {[["nome","Nome profissional"],["cargo","Cargo / atuação"],["especialidades","Especialidades"],["experiencia","Experiência no mercado"],["certificacoes","Certificações e registros (não verificados)"],["youtube","Link do canal ou live no YouTube"],["sobre","Apresentação profissional"]].map(([key,label])=><label key={key} style={{display:"grid",gap:6,fontWeight:700,fontSize:13}}>{label}{["sobre","experiencia"].includes(key)?<textarea rows={3} value={profile[key]} onChange={e=>change(key,e.target.value)} maxLength={1200} style={{...field,resize:"vertical"}}/>:<input value={profile[key]} onChange={e=>change(key,e.target.value)} maxLength={300} style={field}/>}</label>)}
 {!youtubeValid&&<p role="alert" style={{color:"#b91c1c",fontSize:13}}>Utilize um link HTTPS do YouTube.</p>}
 <button disabled={!ready||!youtubeValid} style={{padding:14,border:0,borderRadius:10,background:purple,color:"#fff",fontWeight:800,cursor:"pointer"}}>Salvar rascunho neste dispositivo</button>
 {saved&&<p role="status" style={{color:"#166534",fontSize:13}}>Rascunho salvo neste navegador.</p>}
 </form>
 <aside style={{background:"#fff",border:"1px solid #e6e0f0",padding:24,borderRadius:18,alignSelf:"start"}}>
 <h2 style={{marginTop:0,fontSize:20}}>Prévia do perfil</h2>
 <h3 style={{color:purple,marginBottom:4}}>{profile.nome||"Seu nome profissional"}</h3>
 <p style={{color:"#64748b"}}>{profile.cargo||"Sua atuação no mercado"}</p>
 <p><strong>Especialidades:</strong> {profile.especialidades||"Não informadas"}</p>
 <p style={{whiteSpace:"pre-wrap"}}>{profile.sobre||"Sua apresentação aparecerá aqui."}</p>
 <p style={{fontSize:13,color:"#64748b"}}>Certificações declaradas pelo usuário, sem validação documental. Resultados de trading e credenciais verificadas dependerão de integração segura com a JENIOS Platform.</p>
 {youtubeValid&&profile.youtube&&<a href={profile.youtube} target="_blank" rel="noopener noreferrer" style={{color:purple}}>Abrir canal / live ↗</a>}
 </aside></div></div></main>
}
