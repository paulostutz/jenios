'use client';
import {useState} from 'react';
import styles from './ConversationControls.module.css';
export default function ConversationControls({memory,disabled=false}){
 const [confirmDelete,setConfirmDelete]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const run=async action=>{if(busy)return;setBusy(true);setError('');try{await action();setConfirmDelete(false);}catch(e){if(e.name!=='AbortError')setError(e.message);}finally{setBusy(false);}};
 const locked=disabled||busy||memory.status==='loading';
 return <section className={styles.root} aria-label="Memória da conversa">
  <p role="status">{memory.status==='loading'?'Recuperando sua conversa…':memory.status==='unavailable'?(memory.channel==='pro'?'A memória ainda não está ativada. As consultas permanecem independentes.':'Atendimento guiado nesta visita. A memória ainda não está ativada.'):memory.status==='error'?'A memória não pôde ser confirmada.':memory.conversation?.remember?'Conversa salva na sua conta por até 30 dias.':'Contexto desta conversa disponível por até 24 horas.'}</p>
  {memory.actor.authenticated&&memory.status==='ready'&&<label className={styles.consent}><input type="checkbox" checked={memory.conversation?memory.conversation.remember:memory.remember} disabled={locked||Boolean(memory.conversation)} onChange={e=>memory.setRemember(e.target.checked)}/>Salvar esta conversa na minha conta por até 30 dias</label>}
  {memory.actor.authenticated&&memory.conversation&&<small>Para mudar a duração, inicie uma nova conversa. Você pode excluir a atual quando quiser.</small>}
  {memory.status==='ready'&&<div className={styles.actions}>
   <button type="button" disabled={locked} onClick={()=>{memory.startNew();setConfirmDelete(false);}}>Nova conversa</button>
   {memory.conversation&&<button type="button" disabled={locked} onClick={()=>void run(()=>memory.reload())}>Atualizar conversa</button>}
   {memory.conversation&&<button type="button" disabled={locked} onClick={()=>setConfirmDelete(true)}>Excluir conversa</button>}
   {memory.conversations.length>0&&<label>Retomar<select aria-label="Retomar conversa" disabled={locked} value={memory.conversation?.id||''} onChange={e=>{if(e.target.value)void run(()=>memory.reload({id:e.target.value,restore:false}));}}><option value="">Selecione uma conversa</option>{memory.conversations.map((item,index)=><option key={item.id} value={item.id}>{item.title||item.preview||'Conversa '+(index+1)}</option>)}</select></label>}
  </div>}
  {memory.status==='error'&&<button type="button" disabled={locked} onClick={()=>memory.retry()}>Verificar novamente</button>}
  {confirmDelete&&<div role="alert" className={styles.confirm}><p>Excluir o histórico desta conversa? Essa ação não altera sua conta ou assinatura.</p><button type="button" disabled={locked} onClick={()=>void run(memory.remove)}>Confirmar exclusão</button><button type="button" disabled={locked} onClick={()=>setConfirmDelete(false)}>Manter conversa</button></div>}
  {(error||memory.error)&&<p role="alert" className={styles.error}>{error||memory.error}</p>}
  {memory.notice&&memory.status!=='unavailable'&&<p role="status">{memory.notice}</p>}
 </section>;
}
export function AnswerFeedback({memory,turnId}){
 const [review,setReview]=useState(false),[note,setNote]=useState(''),[allowReview,setAllowReview]=useState(false),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 if(!memory.conversation)return null;
 const send=async rating=>{if(busy)return;setBusy(true);setStatus('');try{await memory.feedback(turnId,rating,note,allowReview);setStatus('Retorno registrado.');setReview(false);}catch(e){if(e.name!=='AbortError')setStatus(e.message);}finally{setBusy(false);}};
 return <div className={styles.feedback} aria-label="Avaliar resposta">
  <button type="button" disabled={busy} onClick={()=>void send('helpful')}>Ajudou</button>
  <button type="button" disabled={busy} onClick={()=>setReview(v=>!v)}>Precisa melhorar</button>
  {review&&<div><label>O que faltou? (opcional)<textarea maxLength={500} value={note} onChange={e=>setNote(e.target.value)} disabled={busy}/></label><label className={styles.consent}><input type="checkbox" checked={allowReview} onChange={e=>setAllowReview(e.target.checked)} disabled={busy}/>Permitir que a equipe revise esta nota de melhoria</label><small>A conversa inteira não é compartilhada por esta opção.</small><button type="button" disabled={busy} onClick={()=>void send('needs_review')}>Enviar avaliação</button></div>}
  {status&&<p role="status">{status}</p>}
 </div>;
}

