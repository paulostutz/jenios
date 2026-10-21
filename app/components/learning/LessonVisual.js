/** B276-R2: ilustrações originais e acessíveis, sem dados externos nem rede. */
import {visualForLesson,visualForWorkshop} from '../../../lib/learning/lesson-visual-scenes-b276.mjs';
import styles from './LearningRoom.module.css';
const PURPLE='#7c3aed',PINK='#e11d48',TEAL='#0f766e',INK='#334155';
function Flow({scene}){
 const n=scene.labels.length,w=n===3?145:125,space=n===3?190:139,start=n===3?39:25;
 return <g>{scene.labels.map((label,i)=>{
  const x=start+i*space;
  return <g key={label}>
   {i>0&&<g><line x1={x-30} y1="105" x2={x-9} y2="105" stroke={TEAL} strokeWidth="3" strokeLinecap="round"/><path d={'M'+(x-16)+' 99 L'+(x-9)+' 105 L'+(x-16)+' 111'} stroke={TEAL} strokeWidth="2.5" fill="none"/></g>}
   <rect x={x} y="70" width={w} height="70" rx="14" fill={i===0?'#ede9fe':i===n-1?'#ccfbf1':'#f1f5f9'} stroke={i===0?PURPLE:i===n-1?TEAL:'#cbd5e1'} strokeWidth="1.5"/>
   <text x={x+w/2} y="109" fill={INK} fontSize={label.length>10?12:14} fontWeight="650" textAnchor="middle">{label}</text>
  </g>;
 })}<text x="300" y="185" fill={INK} fontSize="14" textAnchor="middle">Cada etapa precisa de confirmação</text></g>;
}
function Timeline({scene}){
 const n=scene.labels.length,gap=8,start=24,total=552,block=(total-gap*(n-1))/n;
 return <g>
  <line x1="29" y1="149" x2="573" y2="149" stroke="#cbd5e1" strokeWidth="3"/>
  {scene.labels.map((name,i)=>{
   const x=start+i*(block+gap),fill=i===0?'#ede9fe':i===1?'#fef3c7':i===2?'#ccfbf1':'#e0e7ff';
   return <g key={i}><rect x={x} y="89" width={block} height="65" rx="9" fill={fill} stroke="#cbd5e1"/>
    <text x={x+block/2} y="116" textAnchor="middle" fill={INK} fontSize={name.length>12?11:13} fontWeight="650">{name}</text>
    <text x={x+block/2} y="136" textAnchor="middle" fill="#64748b" fontSize="11">{i+1}ª etapa</text>
   </g>;
  })}
  <text x="300" y="190" textAnchor="middle" fontSize="13" fill={INK}>Cronologia didática, sem escala temporal exata</text>
 </g>;
}
function Risk({scene}){
 const ys=[57,119,190],colors=[PURPLE,'#b45309',PINK];
 return <g>{scene.levels.map((level,i)=><g key={level.label}>
   <line x1="80" y1={ys[i]} x2="510" y2={ys[i]} stroke={colors[i]} strokeWidth={i===0?3:2.4} strokeDasharray={i===0?'0':'9 7'}/>
   <circle cx="111" cy={ys[i]} r="6" fill={colors[i]}/>
   <text x="310" y={ys[i]-9} textAnchor="middle" fill={INK} fontSize="14" fontWeight="600">{level.label}</text>
  </g>)}
  <path d="M535 61 V184 l-7 -12 m7 12 l7 -12" fill="none" stroke={PINK} strokeWidth="2.5" strokeLinecap="round"/>
  <text x="80" y="225" fontSize="12" fill={INK}>Stop planejado ≠ perda máxima garantida</text>
 </g>;
}
function Candles({scene}){
 const ymin=20,ymax=90,toY=v=>202-(v-ymin)/(ymax-ymin)*149;
 return <g>{scene.values.map(([open,high,low,close],i)=>{
  const x=115+i*119,up=close>=open,color=up?TEAL:PINK;
  return <g key={i}>
   <line x1={x} y1={toY(high)} x2={x} y2={toY(low)} stroke={color} strokeWidth="3"/>
   <rect x={x-18} y={Math.min(toY(open),toY(close))} width="36"
    height={Math.max(3,Math.abs(toY(close)-toY(open)))} rx="2" stroke={color} strokeWidth="2" fill={up?'#ccfbf1':'#ffe4e6'}/>
   <text x={x} y="219" fontSize="12" textAnchor="middle" fill={INK}>{'Candle '+(i+1)}</text>
  </g>;
 })}
 <line x1="64" y1="53" x2="64" y2="202" stroke="#94a3b8"/>
 <text x="20" y="48" fill={INK} fontSize="12">Máx.</text>
 <text x="20" y="203" fill={INK} fontSize="12">Mín.</text>
 </g>;
}
function Trend({scene}){
 const variant=scene.variant,points=scene.points||[];
 const path=points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ');
 const lineY=variant==='breakout'?119:variant==='range'?118:null;
 return <g>
  {lineY!==null&&<><line x1="34" y1={lineY} x2="567" y2={lineY} stroke="#94a3b8" strokeWidth="2" strokeDasharray="7 6"/><text x="40" y={lineY-10} fontSize="12" fill="#64748b">Referência ilustrativa</text></>}
  {variant==='range'&&<line x1="34" y1="169" x2="567" y2="169" stroke={TEAL} strokeWidth="2" strokeDasharray="7 6"/>}
  <path d={path} fill="none" stroke={PURPLE} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  {points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i===points.length-1?6:3.5} fill={i===points.length-1?PINK:'#a78bfa'}/>)}
  <text x="40" y="222" fill={INK} fontSize="12">Sequência fictícia; não é previsão</text>
 </g>;
}
function Costs({scene}){
 const labels=scene.labels,values=scene.values,colors=[PURPLE,PINK,'#b45309',TEAL];
 return <g>{values.map((v,i)=>{
  const x=55+i*139,height=v/1.6*113,top=192-height;
  return <g key={i}><rect x={x} y={top} width="90" height={height} rx="8" fill={colors[i]}/>
   <text x={x+45} y={top-10} textAnchor="middle" fill={INK} fontSize="14" fontWeight="700">{v.toFixed(2)}</text>
   <text x={x+45} y="216" textAnchor="middle" fill={INK} fontSize="12">{labels[i]}</text>
  </g>;
 })}
 <line x1="35" y1="193" x2="580" y2="193" stroke="#cbd5e1" strokeWidth="1"/>
 </g>;
}
function Indicators(){
 const baseX=180;
 return <g>{['Direção (médias)','Impulso (RSI)','Amplitude (ATR)'].map((label,i)=>{
  const cy=54+i*66,vals=Array.from({length:13},(_,k)=>i===0?cy+9-Math.sin(k*.34)*11-k*.7:i===1?cy+12-Math.sin(k*.9)*15:cy+8-Math.abs(Math.sin(k*.73))*23);
  return <g key={label}>
   <text x="19" y={cy+5} fontSize="13" fill={INK}>{label}</text>
   <line x1={baseX} y1={cy+23} x2="570" y2={cy+23} stroke="#e2e8f0"/>
   <polyline points={vals.map((v,k)=>(baseX+k*31)+','+v).join(' ')} fill="none" stroke={[PURPLE,TEAL,PINK][i]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </g>;
 })}</g>;
}
function Expectancy({scene}){
 const positions=[178,421],mid=125;
 return <g>
  <line x1="70" y1={mid} x2="537" y2={mid} stroke="#64748b" strokeWidth="2"/>
  {scene.values.map((v,i)=>{
   const y=v>0?mid-v*15:mid,height=Math.abs(v)*15;
   return <g key={i}>
    <rect x={positions[i]-40} y={y} width="80" height={height} rx="6" fill={v>0?TEAL:PINK}/>
    <text x={positions[i]} y={v>0?y-9:mid+height+19} textAnchor="middle" fill={INK} fontWeight="700" fontSize="16">{v>0?'+':''}{v}R</text>
    <text x={positions[i]} y="226" textAnchor="middle" fill={INK} fontSize="13">{scene.labels[i]}</text>
   </g>;
  })}
  <text x="300" y="101" fontSize="12" fill={INK} textAnchor="middle">Linha de resultado zero</text>
 </g>;
}
const kinds={flow:Flow,timeline:Timeline,risk:Risk,candles:Candles,trend:Trend,costs:Costs,indicators:Indicators,expectancy:Expectancy};
export default function LessonVisual({lessonId=null,workshopId=null}){
 const scene=lessonId?visualForLesson(lessonId):workshopId?visualForWorkshop(workshopId):null;
 if(!scene)return null;
 const Component=kinds[scene.kind];
 if(!Component)return null;
 return <figure className={styles.studyIllustration} data-study-illustration={lessonId||workshopId}
  aria-label="Ilustração educativa original JENIOS">
  <figcaption className={styles.studyIllustrationTitle}>{scene.title}</figcaption>
  <svg className={styles.studyIllustrationSvg} viewBox="0 0 600 250" xmlns="http://www.w3.org/2000/svg"
   role="img" aria-label={scene.alt} preserveAspectRatio="xMidYMid meet">
   <title>{scene.title}</title><desc>{scene.alt}</desc>
   <rect x="2" y="2" width="596" height="246" rx="17" fill="#f8fafc" stroke="#e2e8f0"/>
   <Component scene={scene}/>
  </svg>
  <p className={styles.studyIllustrationCaption}>{scene.caption}</p>
  <p className={styles.studyIllustrationNotice}>Imagem didática original, com números inventados. Não representa cotação, resultado auditado ou recomendação de negociação.</p>
 </figure>;
}
