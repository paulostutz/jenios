'use client';
import {useEffect,useState} from 'react';
import {PlatformEducationalQuiz} from '../../components/PlatformPresentation';

export default function SimuladorSocialPage(){
 const [embed,setEmbed]=useState(false);
 useEffect(()=>{setEmbed(new URLSearchParams(window.location.search).get('embed')==='1');},[]);
 return <main style={{background:'#0f172a',minHeight:'100vh',padding:embed?8:'32px 16px',fontFamily:'Arial,sans-serif'}}>
  <div style={{maxWidth:900,margin:'0 auto'}}>
   {!embed&&<><a href="/social" style={{color:'#c4b5fd'}}>← Voltar à JENIOS Social</a>
    <h1 style={{color:'#fff',fontSize:26}}>Simulador educativo de decisões</h1>
    <p style={{color:'#cbd5e1',fontSize:13,lineHeight:1.6}}>Reflita sobre planejamento, risco e pausas. Depois, pratique com saldo fictício na Platform.</p></>}
   <PlatformEducationalQuiz compact={embed}/>
  </div>
 </main>;
}
