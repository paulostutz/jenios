'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {readSimJournal,clearSimJournal} from '../../../lib/platform/simulation-journal.mjs';
import {
 DEFAULT_SIMULATED_BALANCE,MAX_SIMULATED_BALANCE,readSimulatedBalance,
 writeSimulatedBalance,readSimulationPaused,writeSimulationPaused
} from '../../../lib/platform/simulation-account.mjs';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

/** Uma única fonte de simulação local, por conta autenticada e aba.
 * Nunca transfere ordens, saldo, diagnósticos ou credenciais à JENIOS Social.
 */
export default function PlatformSimulationSummary({userId}){
 const [snapshot,setSnapshot]=useState(null);
 const [balanceInput,setBalanceInput]=useState(String(DEFAULT_SIMULATED_BALANCE));
 const [error,setError]=useState('');
 const refresh=useCallback(()=>{
  if(!userId){setSnapshot(null);return;}
  const storage=window.sessionStorage;
  const balance=readSimulatedBalance(storage,userId);
  setSnapshot({
   balance,paused:readSimulationPaused(storage,userId),
   events:readSimJournal(storage,userId)
  });
  setBalanceInput(String(balance));
 },[userId]);

 useEffect(()=>{
  refresh();
  const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',onVisible);
  return ()=>{
   window.removeEventListener('focus',refresh);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[refresh]);

 function changeBalance(event){
  event.preventDefault();
  if(!userId||!snapshot)return;
  if(!writeSimulatedBalance(window.sessionStorage,userId,balanceInput)){
   setError('Informe um saldo fictício válido, de zero até o limite permitido.');
   return;
  }
  setError('');refresh();
 }
 function togglePause(){
  if(!userId||!snapshot)return;
  if(!writeSimulationPaused(window.sessionStorage,userId,!snapshot.paused)){
   setError('Não foi possível registrar a pausa nesta sessão. Nenhuma ordem foi enviada.');
   return;
  }
  setError('');refresh();
 }
 function clearJournal(){
  if(!userId||!snapshot)return;
  if(!clearSimJournal(window.sessionStorage,userId)){
   setError('Não foi possível limpar o diário local.');
   return;
  }
  setError('');refresh();
 }
 if(!userId||!snapshot)return <p role="status">Carregando simulação privada da sua conta…</p>;
 const actionStyle={padding:'10px 13px',border:0,borderRadius:9,cursor:'pointer',fontWeight:750,fontSize:12};
 return <>
  <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
   <div>
    <h2 style={{margin:'0 0 4px'}}>Simulador da conta</h2>
    <p style={{margin:0,fontSize:12}}>Treinamento local: não existe saldo bancário, corretora conectada ou ordem real.</p>
   </div>
   <strong role="status" style={{fontSize:12,color:snapshot.paused?'#b45309':'#047857'}}>
    {snapshot.paused?'Simulação pausada':'Simulação disponível'}
   </strong>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,margin:'16px 0'}}>
   <div style={{padding:14,background:'#f8fafc',borderRadius:11}}>
    <span style={{fontSize:11,color:'#475569'}}>Saldo virtual da sessão</span>
    <div style={{fontSize:20,fontWeight:850,marginTop:6}}>{money.format(snapshot.balance)}</div>
   </div>
   <div style={{padding:14,background:'#f8fafc',borderRadius:11}}>
    <span style={{fontSize:11,color:'#475569'}}>Diário de decisões fictícias</span>
    <div style={{fontSize:20,fontWeight:850,marginTop:6}}>{snapshot.events.length} intenções</div>
   </div>
  </div>
  <form onSubmit={changeBalance} style={{display:'flex',gap:9,alignItems:'end',flexWrap:'wrap'}}>
   <label style={{display:'grid',gap:5,fontSize:12,fontWeight:700}}>
    Ajustar capital fictício (R$)
    <input type="number" inputMode="decimal" min="0" max={MAX_SIMULATED_BALANCE} step="0.01"
      value={balanceInput} onChange={event=>setBalanceInput(event.target.value)}
      style={{padding:'10px 11px',border:'1px solid #cbd5e1',borderRadius:9,maxWidth:220,width:'100%'}}/>
   </label>
   <button type="submit" style={{...actionStyle,background:'#6d28d9',color:'#fff'}}>
    Atualizar saldo fictício
   </button>
   <button type="button" onClick={togglePause} style={{...actionStyle,background:snapshot.paused?'#047857':'#7c3aed',color:'#fff'}}>
    {snapshot.paused?'Retomar sessão':'Pausar sessão'}
   </button>
  </form>
  {error&&<p role="alert" style={{color:'#991b1b',marginTop:10}}>{error}</p>}
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:18,flexWrap:'wrap'}}>
   <strong style={{fontSize:13}}>Últimas intenções simuladas</strong>
   <div style={{display:'flex',gap:12,alignItems:'center'}}>
    <Link href="/dashboard" style={{fontSize:12,color:'#6d28d9'}}>Dashboard</Link>
    <Link href="/mesa-operacoes" style={{fontSize:12,color:'#6d28d9'}}>Mesa</Link>
    <button type="button" disabled={!snapshot.events.length} onClick={clearJournal}
      style={{...actionStyle,background:'#f1f5f9',color:'#334155'}}>Limpar diário</button>
   </div>
  </div>
  {!snapshot.events.length?
   <p style={{fontSize:12}}>Nenhuma intenção fictícia registrada nesta sessão. Use a Dashboard ou a Mesa para simular.</p>:
   <ol style={{paddingLeft:20,fontSize:12,lineHeight:1.9}}>
    {snapshot.events.slice(0,4).map(item=><li key={item.id}>
     {item.hora} · {item.ativo} · {item.direcao} · {money.format(item.valor)} · {item.modo}
    </li>)}
   </ol>}
  <p style={{fontSize:11,color:'#64748b',marginBottom:0}}>Saldo, diário e pausa são compartilhados somente entre estas telas, nesta conta e aba. Sair da Platform apaga esses registros locais. Nenhum resultado financeiro ou prejuízo evitado é presumido.</p>
 </>;
}
