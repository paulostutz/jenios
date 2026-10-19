'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';

/** Mobile only: single collapsed three-dot button.
 * Touch and keyboard use the same explicit expanded menu.
 */
export default function SocialMobileRail({active,authenticated,onTab,onAuth}){
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{
  if(!expanded)return;
  const onKey=e=>{if(e.key==='Escape')setExpanded(false);};
  document.addEventListener('keydown',onKey);
  return()=>document.removeEventListener('keydown',onKey);
 },[expanded]);
 const close=()=>setExpanded(false);
 const button=(key,label,glyph,run)=>(
  <button key={key} type="button" className="jenios-mobile-rail-item"
   aria-current={active===key?'page':undefined} aria-label={label}
   onClick={()=>{close();run();}}>
   <span className="jenios-mobile-rail-icon" aria-hidden="true">{glyph}</span>
   <span className="jenios-mobile-rail-label">{label}</span>
  </button>
 );
 const link=(label,glyph,href)=>(
  <Link key={href} href={href} onClick={close} aria-label={label}
   className="jenios-mobile-rail-item">
   <span className="jenios-mobile-rail-icon" aria-hidden="true">{glyph}</span>
   <span className="jenios-mobile-rail-label">{label}</span>
  </Link>
 );
 return <>
  {expanded&&<button type="button" className="jenios-mobile-rail-backdrop"
    aria-label="Fechar menu da Social" onClick={close}/>}
  <aside className={'jenios-mobile-rail'+(expanded?' jenios-mobile-rail-open':'')}
    aria-label="Menu da JENIOS Social">
   <button type="button" className="jenios-mobile-rail-item jenios-mobile-rail-toggle"
    aria-label={expanded?'Fechar menu':'Abrir menu de três pontos'} aria-expanded={expanded}
    aria-controls="jenios-mobile-rail-extra" onClick={()=>setExpanded(v=>!v)}>
    <span className="jenios-mobile-rail-icon" aria-hidden="true">{expanded?'×':'⋯'}</span>
    <span className="jenios-mobile-rail-label">{expanded?'Fechar':'Menu'}</span>
   </button>
   {expanded&&<nav id="jenios-mobile-rail-extra" className="jenios-mobile-rail-extra" aria-label="Módulos da JENIOS">
    {button('feed','Acesso Público','⌂',()=>onTab('feed'))}
    {authenticated&&button('perfil','Meu Perfil','◉',()=>onTab('perfil'))}
    {button('ranking','Ranking','🏆',()=>onTab('ranking'))}
    {link('Hub de Tendências','↗','/tendencias')}
    {link('Simulador','◈','/social/simulador')}
    {link('BankScore','▥','/bankscore')}
    {link('Validador de Tokens','◇','/social#jenios-cripto-mobile')}
    {link('Especialistas','♧','/especialistas')}
    {link('Sala de Controle','▣','/dashboard-logado')}
    {link('Conhecer a Platform','✦','/lp')}
    {!authenticated&&button('entrar','Entrar','⇥',onAuth)}
   </nav>}
  </aside>
 </>;
}
