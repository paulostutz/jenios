'use client';
import {useEffect,useRef,useState} from 'react';
import {createCommandController} from '../../../lib/platform/ultra/web/command-controller.mjs';
export default function UltraCommands({platform,subject,send}){
 const [policy,setPolicy]=useState(null),[ack,setAck]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('Consultando disponibilidade…');
 const controller=useRef(null),epoch=useRef(0);
 useEffect(()=>{
  let active=true,c;
  const refresh=async()=>{
   const ticket=++epoch.current;c?.invalidate();setPolicy(null);setAck(false);setBusy(false);
   if(!subject){setMessage('Entre na sua conta para consultar os comandos.');return;}
   try{
    c=createCommandController({platform,subject,storage:window.sessionStorage,send});controller.current=c;
    const p=await c.policy();if(active&&ticket===epoch.current){setPolicy(p);setMessage(p?.reason??'Fonte autorizada indisponível.');}
   }catch{if(active&&ticket===epoch.current)setMessage('Fonte autorizada indisponível. Nenhuma operação ou cobrança foi liberada.');}
  };
  const restore=()=>{void refresh()};void refresh();
  const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('flow-free-invalidate'):null;if(channel)channel.onmessage=restore;
  window.addEventListener('focus',restore);window.addEventListener('pageshow',restore);
  return()=>{active=false;epoch.current++;c?.invalidate();controller.current=null;channel?.close();window.removeEventListener('focus',restore);window.removeEventListener('pageshow',restore)};
 },[platform,subject,send]);
 async function run(action){
  const ticket=epoch.current;if(busy||!controller.current)return;setBusy(true);setMessage('Enviando solicitação…');
  try{const result=await controller.current.run(action,policy,ack);if(ticket!==epoch.current)return;
   const messages={accepted:'Solicitação recebida. Aguarde a confirmação na fonte autorizada.',pending:'Solicitação pendente. Consulte o andamento sem reenviar.',unknown:'Resultado incerto. Consulte o andamento sem reenviar a ação.',blocked:'Solicitação bloqueada pela fonte autorizada.'};
   setMessage(messages[result.status]+' Nenhuma ordem real ou débito real foi autorizado por esta interface.');setAck(false);const refreshed=await controller.current.policy();if(ticket===epoch.current)setPolicy(refreshed);
  }catch{if(ticket===epoch.current)setMessage('Não foi possível confirmar o resultado. O identificador foi preservado; uma nova consulta não repete a ação.');}
  finally{if(ticket===epoch.current)setBusy(false);}
 }
 const pending=action=>controller.current?.hasPending(policy,action);
 const ready=subject&&policy?.scopes&&policy?.consentVersion;
 return <section aria-labelledby="ultra-commands-title"><h3 id="ultra-commands-title">Start, pausa e apuração</h3>
  <p>Conecte somente suas próprias contas. Start solicita a preparação do ciclo de R$ 5, que vai até a pausa confirmada. Reconectar ou clicar novamente não cria outro ciclo.</p>
  <p>A performance mensal é de 20% na contratação individual ou 10% quando aplicável, sobre o líquido geral conforme o plano confirmado. Custos incompletos mantêm a apuração pendente. Isenções dependem exclusivamente da política autorizada.</p>
  <p>Negociação envolve risco de perda. Nenhuma ordem ou débito real é autorizado nesta entrega. A apuração consulta o fluxo Letter existente e não confirma pagamento.</p>
  <label><input type="checkbox" checked={ack} disabled={!ready||busy} onChange={e=>setAck(e.target.checked)}/> Li os riscos e as condições do ciclo e da apuração para esta solicitação.</label>
  <div><button disabled={!ready||(!pending('start')&&(!policy.canStart||!ack))||busy} onClick={()=>run('start')}>Solicitar Start / consultar</button> <button disabled={!ready||(!pending('pause')&&!policy.canPause)||busy} onClick={()=>run('pause')}>Solicitar pausa / consultar</button> <button disabled={!ready||(!pending('billing')&&(!policy.canBill||!ack))||busy} onClick={()=>run('billing')}>Apurar cobranças / consultar</button></div>
  <p role="status">{message}</p><p>Atualize os dados para conferir ciclo, pausa e obrigações confirmados. Interrupções e respostas incertas exigem conciliação, nunca confirmação manual de pagamento.</p>
 </section>;
}
