'use client';
import {useMemo,useState} from 'react';
import styles from './LearningRoom.module.css';
const sample=Array.from({length:30},(_,i)=>{const o=100+Math.sin(i*.43)*3+i*.13,c=o+Math.sin(i+1)*1.4;return {open:o,close:c,high:Math.max(o,c)+1,low:Math.min(o,c)-.8};});
export default function ChartLab(){
 const [kind,setKind]=useState('candles'),[minutes,setMinutes]=useState(1);
 const bars=useMemo(()=>{const a=[];for(let i=0;i<sample.length;i+=minutes){const g=sample.slice(i,i+minutes);a.push({open:g[0].open,close:g[g.length-1].close,high:Math.max(...g.map(x=>x.high)),low:Math.min(...g.map(x=>x.low))});}return a;},[minutes]);
 const min=Math.min(...bars.map(x=>x.low))-1,max=Math.max(...bars.map(x=>x.high))+1,y=p=>160-(p-min)/(max-min)*135,x=i=>22+i*420/bars.length;
 return <section className={styles.lab} aria-label="Laboratório de gráficos fictícios"><h3>Veja os mesmos dados de três jeitos</h3><p>Dados inteiramente fictícios, sem recomendação. Cada ponto original representa um minuto.</p><div className={styles.actions}>
 <label>Representação<select value={kind} onChange={e=>setKind(e.target.value)}><option value="candles">Candles</option><option value="bars">Barras OHLC</option><option value="line">Linha de fechamento</option></select></label>
 <label>Período<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}><option value={1}>1 minuto</option><option value={5}>5 minutos</option></select></label></div>
 <svg viewBox="0 0 470 185" role="img" aria-label={`Série fictícia em ${kind}, período de ${minutes} minuto(s)`} className={styles.chart}><title>Série didática fictícia, não é cotação de mercado</title>
 {[40,80,120,160].map(v=><line key={v} x1="10" y1={v} x2="455" y2={v} stroke="#334155" strokeWidth=".5"/>)}
 {kind==='line'?<polyline points={bars.map((b,i)=>`${x(i)},${y(b.close)}`).join(' ')} fill="none" stroke="#c4b5fd" strokeWidth="2.5"/>:bars.map((b,i)=>{const px=x(i),up=b.close>=b.open,stroke=up?'#a78bfa':'#fda4af',half=Math.min(9,140/bars.length);return <g key={i}><title>{`Abertura ${b.open.toFixed(2)}; máxima ${b.high.toFixed(2)}; mínima ${b.low.toFixed(2)}; fechamento ${b.close.toFixed(2)}`}</title><line x1={px} y1={y(b.high)} x2={px} y2={y(b.low)} stroke={stroke}/>{kind==='candles'?<rect x={px-half} y={Math.min(y(b.open),y(b.close))} width={half*2} height={Math.max(1,Math.abs(y(b.open)-y(b.close)))} fill={up?'none':stroke} stroke={stroke}/>:<><line x1={px-half} y1={y(b.open)} x2={px} y2={y(b.open)} stroke={stroke}/><line x1={px} y1={y(b.close)} x2={px+half} y2={y(b.close)} stroke={stroke}/></>}</g>;})}</svg>
 <p className={styles.small}>Pense: o agrupamento de cinco minutos esconde alguma informação que era visível no de um minuto?</p></section>;
}