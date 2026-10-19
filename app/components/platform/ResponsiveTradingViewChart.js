'use client';
import {useEffect,useId,useRef,useState} from 'react';
import styles from './ResponsiveTradingViewChart.module.css';

const SCRIPT_URL='https://s3.tradingview.com/tv.js';
let loadingPromise=null;
export function tradingViewSafeSymbol(value){
 return typeof value==='string'&&/^[A-Z0-9_.!:\/-]{1,48}$/i.test(value)
  ?value:'BMFBOVESPA:WIN1!';
}
export function tradingViewWidgetOptions(symbol,containerId){
 return {
  autosize:true,symbol:tradingViewSafeSymbol(symbol),interval:'5',
  timezone:'America/Sao_Paulo',theme:'dark',style:'1',locale:'br',
  toolbar_bg:'#1e293b',enable_publishing:false,hide_top_toolbar:false,
  save_image:false,container_id:containerId
 };
}
function loadTradingView(){
 if(typeof window==='undefined')return Promise.reject(Error('BROWSER_ONLY'));
 if(typeof window.TradingView?.widget==='function')return Promise.resolve(window.TradingView);
 if(loadingPromise)return loadingPromise;
 loadingPromise=new Promise((resolve,reject)=>{
  let settled=false;
  const script=document.querySelector('script[data-jenios-tradingview],script#tradingview-widget-script');
  const node=script||document.createElement('script');
  const timeout=setTimeout(()=>settle(false,Error('WIDGET_TIMEOUT')),15000);
  function settle(ok,value){
   if(settled)return;settled=true;clearTimeout(timeout);
   node.removeEventListener('load',onLoad);node.removeEventListener('error',onError);
   if(ok)resolve(value);else{loadingPromise=null;reject(value);}
  }
  const onLoad=()=>{
   if(typeof window.TradingView?.widget==='function')settle(true,window.TradingView);
   else settle(false,Error('WIDGET_UNAVAILABLE'));
  };
  const onError=()=>settle(false,Error('WIDGET_NETWORK'));
  node.addEventListener('load',onLoad,{once:true});
  node.addEventListener('error',onError,{once:true});
  if(!script){
   node.dataset.jeniosTradingview='true';
   node.src=SCRIPT_URL;node.async=true;document.head.appendChild(node);
  }
 });
 return loadingPromise;
}
/** Client-only chart. Horizontal on a portrait phone rotates the chart surface,
 * without attempting browser-forbidden Screen Orientation locks.
 */
export default function ResponsiveTradingViewChart({symbol,label}){
 const reactId=useId();
 const targetId='jenios-tv-'+reactId.replace(/[^a-zA-Z0-9_-]/g,'');
 const container=useRef(null);
 const [mode,setMode]=useState('vertical');
 const [status,setStatus]=useState('loading');
 const safeSymbol=tradingViewSafeSymbol(symbol);
 useEffect(()=>{
  let active=true;
  const target=container.current;
  if(!target)return;
  target.replaceChildren();
  setStatus('loading');
  loadTradingView().then(tv=>{
   if(!active||container.current!==target)return;
   try{new tv.widget(tradingViewWidgetOptions(safeSymbol,targetId));setStatus('embedded');}
   catch{setStatus('unavailable');}
  }).catch(()=>{if(active)setStatus('unavailable');});
  return()=>{active=false;target.replaceChildren();};
 },[targetId,safeSymbol]);
 useEffect(()=>{
  if(mode!=='horizontal')return;
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const escape=e=>{if(e.key==='Escape')setMode('vertical');};
  document.addEventListener('keydown',escape);
  return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',escape);};
 },[mode]);
 useEffect(()=>{
  const trigger=()=>window.requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  const timeout=setTimeout(trigger,180);
  window.addEventListener('orientationchange',trigger);
  window.visualViewport?.addEventListener('resize',trigger);
  return()=>{
   clearTimeout(timeout);
   window.removeEventListener('orientationchange',trigger);
   window.visualViewport?.removeEventListener('resize',trigger);
  };
 },[mode]);
 return <section data-jenios-tv-chart data-mode={mode} data-tv-symbol={safeSymbol}
   className={styles.shell} aria-label="Gráfico TradingView responsivo">
  <div className={styles.rotatable}>
   <header className={styles.header}>
    <div className={styles.heading}>
     <strong>📈 TradingView · Gráfico para estudo</strong>
     <small>{label||safeSymbol} · Widget externo · confira a cotação na fonte</small>
    </div>
    <div role="group" aria-label="Orientação do gráfico" className={styles.actions}>
     <button type="button" data-tv-vertical aria-pressed={mode==='vertical'}
      onClick={()=>setMode('vertical')}>Vertical</button>
     <button type="button" data-tv-horizontal aria-pressed={mode==='horizontal'}
      onClick={()=>setMode('horizontal')}>Horizontal</button>
    </div>
   </header>
   <div className={styles.viewport}>
    <div id={targetId} ref={container} className={styles.widget}/>
    {status==='unavailable'&&<p role="status" className={styles.fallback}>
     O TradingView não respondeu. Confirme sua conexão, desative o bloqueio desse widget ou abra o gráfico no site do provedor.
     <a href="https://www.tradingview.com/chart/" target="_blank" rel="noopener noreferrer">Abrir TradingView ↗</a>
    </p>}
   </div>
  </div>
  {mode==='horizontal'&&<button type="button" className={styles.exit}
   aria-label="Retornar ao gráfico vertical" onClick={()=>setMode('vertical')}>×</button>}
 </section>;
}
