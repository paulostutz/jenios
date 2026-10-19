'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';

/** Mobile-only launcher. Pointer hover previews labels; touch opens a menu.
 * Navigation is never hidden behind mouse hover on phones or keyboard.
 */
export default function SocialMobileRail({active,authenticated,onTab,onMessages,onEdit,onAuth,onExit}){
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{
  if(!expanded)return;
  const onKey=e=>{if(e.key==='Escape')setExpanded(false);};
  document.addEventListener('keydown',onKey);
  return()=>document.removeEventListener('keydown',onKey);
 },[expanded]);
 const button=(key,label,glyph,run,extraClass='')=>(
  <button key={key} type="button" className={'jenios-mobile-rail-item '+extraClass}
   title={label} aria-label={label} aria-current={active===key?'page':undefined}
   onClick={()=>{setExpanded(false);run();}}>
   <span className="jenios-mobile-rail-icon" aria-hidden="true">{glyph}</span>
   <span className="jenios-mobile-rail-label">{label}</span>
  </button>
 );
 const link=(label,glyph,href,key=href)=>(
  <Link key={key} href={href} className="jenios-mobile-rail-item"
   aria-label={label} title={label} onClick={()=>setExpanded(false)}>
   <span className="jenios-mobile-rail-icon" aria-hidden="true">{glyph}</span>
   <span className="jenios-mobile-rail-label">{label}</span>
  </Link>
 );
 const signed=act=>authenticated?act():onAuth();
 return <>
  {expanded&&<button type="button" className="jenios-mobile-rail-backdrop" aria-label="Fechar menu da Social" onClick={()=>setExpanded(false)}/>}
  <aside className={'jenios-mobile-rail'+(expanded?' jenios-mobile-rail-open':'')}
    aria-label="Menu lateral da JENIOS Social">
   <div className="jenios-mobile-rail-top">
    {button('feed','Feed','⌂',()=>onTab('feed'))}
    {button('perfil','Meu perfil','◉',()=>signed(()=>onTab('perfil')))}
    {button('mensagens','Mensagens','✉',()=>signed(onMessages))}
    {link('Hub de Tendências','↗','/tendencias')}
    {link('Sala de Controle','▣','/dashboard-logado')}
    <button type="button" className="jenios-mobile-rail-item jenios-mobile-rail-toggle"
     aria-label={expanded?'Fechar menu':'Abrir todos os módulos'} aria-expanded={expanded}
     aria-controls="jenios-mobile-rail-extra" onClick={()=>setExpanded(v=>!v)}>
     <span className="jenios-mobile-rail-icon" aria-hidden="true">{expanded?'×':'☰'}</span>
     <span className="jenios-mobile-rail-label">{expanded?'Fechar':'Mais módulos'}</span>
    </button>
   </div>
   {expanded&&<div id="jenios-mobile-rail-extra" className="jenios-mobile-rail-extra">
    {button('ranking','Ranking','🏆',()=>onTab('ranking'))}
    {button('lives','Lives','●',()=>onTab('lives'))}
    {link('Reels','▶','/social/reels')}
    {link('Destaques','✦','/social/destaques')}
    {button('arquivados','Arquivados','▤',()=>signed(()=>onTab('arquivados')))}
    {button('bloqueados','Usuários bloqueados','⊘',()=>signed(()=>onTab('bloqueados')))}
    {link('Simulador','◈','/social/simulador')}
    {link('BankScore','▥','/bankscore')}
    {link('Especialistas','♧','/especialistas')}
    {link('Insights','◷','/insights')}
    {link('Impulsionar','↑','/impulsionar')}
    {link('Validador de Tokens','◇','/social#jenios-cripto-mobile')}
    {link('Notícias','☷','/social#jenios-noticias')}
    {link('Notificações','♧','/notifications')}
    {button('editar','Editar perfil','⚙',()=>signed(onEdit))}
    {authenticated?button('sair','Sair','⇥',onExit):button('entrar','Entrar','⇥',onAuth)}
   </div>}
  </aside>
 </>;
}
