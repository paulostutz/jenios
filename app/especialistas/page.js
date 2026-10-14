"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../lib/supabase";
import SocialChargeButton from "../components/SocialChargeButton";
const purple="#6d28d9";
const field={width:"100%",boxSizing:"border-box",border:"1px solid #d8d1e8",borderRadius:10,padding:"12px 14px",background:"#fff",color:"#241c39",fontSize:14};
const blank={nome:"",cargo:"",especialidades:"",experiencia:"",certificacoes:"",youtube:"",sobre:""};
export default function EspecialistasPage(){
 const [profile,setProfile]=useState(blank),[saved,setSaved]=useState(false),[ready,setReady]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{let active=true;async function load(){try{if(!supabase){setMessage("Supabase não configurado.");return}const {data:{user}}=await supabase.auth.getUser();if(!active)return;if(!user){setMessage("Entre na sua conta para editar o currículo.");return}const {data,error}=await supabase.from("jenios_specialist_profiles").select("nome,cargo,especialidades,experiencia,certificacoes,youtube,sobre").eq("user_id",user.id).maybeSingle();if(error)throw error;if(data)setProfile({...blank,...data});}catch{if(active)setMessage("Não foi possível carregar o perfil. Verifique a migração SQL.")}finally{if(active)setReady(true)}}load();return()=>{active=false}},[]);
 function change(k,v){setProfile(p=>({...p,[k]:v}));setSaved(false)}
 async function save(e){e.preventDefault();setSaved(false);setMessage("");try{if(!supabase)throw new Error("Supabase não configurado");const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user){setMessage("Faça login para salvar seu perfil.");return}const payload=Object.fromEntries(Object.entries(profile).map(([k,v])=>[k,String(v||"").trim()]));const {error}=await supabase.from("jenios_specialist_profiles").upsert({user_id:user.id,...payload,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error;setSaved(true)}catch{setMessage("Não foi possível salvar. Confira se a migração SQL foi aplicada no Supabase.")}}
 const youtubeValid=!profile.youtube||/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(profile.youtube);
 return <main style={{minHeight:"100vh",background:"#f6f5fb",color:"#241c39",padding:"30px 16px",fontFamily:"Inter,Arial,sans-serif"}}><div style={{maxWidth:1080,margin:"auto"}}>
 <Link href="/social" style={{color:purple,fontWeight:800,textDecoration:"none"}}>← Voltar à JENIOS Social</Link>
 <p style={{color:purple,fontWeight:800,fontSize:12,letterSpacing:2,marginTop:28}}>JENIOS SOCIAL · PERFIL PROFISSIONAL</p>
 <h1 style={{fontSize:"clamp(28px,4vw,40px)",margin:"8px 0"}}>Área do Especialista</h1>
 <p style={{color:"#64748b",maxWidth:750,lineHeight:1.7}}>Apresente sua experiência, especialidades e conteúdo profissional. Seu currículo é salvo na sua conta Supabase. A publicação pública do perfil e a verificação de credenciais exigem uma etapa posterior.</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,330px),1fr))",gap:20}}>
 <form onSubmit={save} style={{background:"#fff",border:"1px solid #e6e0f0",padding:24,borderRadius:18,display:"grid",gap:14}}>
 <h2 style={{fontSize:20,margin:0}}>Seu currículo financeiro</h2>
 {[["nome","Nome profissional"],["cargo","Cargo / atuação"],["especialidades","Especialidades"],["experiencia","Experiência no mercado"],["certificacoes","Certificações e registros (não verificados)"],["youtube","Link do canal ou live no YouTube"],["sobre","Apresentação profissional"]].map(([key,label])=><label key={key} style={{display:"grid",gap:6,fontWeight:700,fontSize:13}}>{label}{["sobre","experiencia"].includes(key)?<textarea rows={3} value={profile[key]} onChange={e=>change(key,e.target.value)} maxLength={1200} style={{...field,resize:"vertical"}}/>:<input value={profile[key]} onChange={e=>change(key,e.target.value)} maxLength={300} style={field}/>}</label>)}
 {!youtubeValid&&<p role="alert" style={{color:"#b91c1c",fontSize:13}}>Utilize um link HTTPS do YouTube.</p>}
 <button disabled={!ready||!youtubeValid} style={{padding:14,border:0,borderRadius:10,background:purple,color:"#fff",fontWeight:800,cursor:"pointer"}}>Salvar currículo na minha conta</button>
 {message&&<p role="alert" style={{color:"#b45309",fontSize:13}}>{message}</p>}
 {saved&&<p role="status" style={{color:"#166534",fontSize:13}}>Currículo salvo na sua conta.</p>}
 </form>
 <aside style={{background:"#fff",border:"1px solid #e6e0f0",padding:24,borderRadius:18,alignSelf:"start"}}>
 <h2 style={{marginTop:0,fontSize:20}}>Prévia do perfil</h2>
 <h3 style={{color:purple,marginBottom:4}}>{profile.nome||"Seu nome profissional"}</h3>
 <p style={{color:"#64748b"}}>{profile.cargo||"Sua atuação no mercado"}</p>
 <p><strong>Especialidades:</strong> {profile.especialidades||"Não informadas"}</p>
 <p style={{whiteSpace:"pre-wrap"}}>{profile.sobre||"Sua apresentação aparecerá aqui."}</p>
 <p style={{fontSize:13,color:"#64748b"}}>Certificações declaradas pelo usuário, sem validação documental. Resultados de trading e credenciais verificadas dependerão de integração segura com a JENIOS Platform.</p>
 {youtubeValid&&profile.youtube&&<a href={profile.youtube} target="_blank" rel="noopener noreferrer" style={{color:purple}}>Abrir canal / live ↗</a>}
 <div style={{marginTop:18}}><SocialChargeButton productCode="social-specialist" label="Ativar serviços profissionais" /></div>
 </aside></div></div></main>
}
