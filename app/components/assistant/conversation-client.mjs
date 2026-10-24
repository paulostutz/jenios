const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validConversationId=value=>typeof value==='string'&&UUID.test(value);
export function conversationKey(channel,owner){return 'jenios:conversation:v1:'+channel+':'+owner;}
export function storedConversation(storage,channel,owner){try{const id=storage.getItem(conversationKey(channel,owner));return validConversationId(id)?id:null;}catch{return null;}}
export function rememberConversationId(storage,channel,owner,id){
 try{const key=conversationKey(channel,owner);if(validConversationId(id))storage.setItem(key,id);else storage.removeItem(key);return true;}catch{return false;}
}
export function conversationSnapshot(value,channel){
 if(!value||!validConversationId(value.id)||value.channel!==channel||!['genio','genia'].includes(value.persona)||
  !Number.isSafeInteger(value.revision)||value.revision<0||typeof value.remember!=='boolean'||!Array.isArray(value.turns))return null;
 const turns=value.turns.filter(t=>t&&validConversationId(t.turnId)&&typeof t.question==='string').map(t=>({
  ...t,question:t.question.slice(0,5000),answer:typeof t.answer==='string'?t.answer.slice(0,20000):'',
  articles:safeAssistantLinks(t.articles),status:typeof t.status==='string'?t.status:'pending'
 }));
 return {...value,turns};
}
export function safeAssistantLinks(links){
 if(!Array.isArray(links))return [];
 return links.filter(x=>x&&typeof x.href==='string'&&(/^\/(?!\/)/.test(x.href)||/^https:\/\//i.test(x.href))&&
  typeof (x.title||x.label)==='string').map(x=>({href:x.href,title:x.title||x.label,id:x.id||x.href})).slice(0,12);
}
export function settledTurn(turn){return Boolean(turn&&typeof turn.answer==='string'&&turn.answer.trim());}
export function mergeConversationTurns(snapshot,local=[]){
 const rows=new Map((snapshot?.turns||[]).map(t=>[t.turnId,{...t,source:'server'}]));
 for(const turn of local){
  const previous=rows.get(turn.turnId);
  if(!previous||!settledTurn(previous))rows.set(turn.turnId,{...previous,...turn});
 }
 return [...rows.values()].slice(-40);
}
/** Preserve tool cards in this tab while reconciling interrupted calls from server history. */
export function mergeConsultationRows(snapshot,local=[]){
 const existing=new Map(local.map(row=>[row.id,row])),rows=[];
 for(const turn of snapshot?.turns||[]){
  const questionId=turn.turnId+':question',previous=existing.get(turn.turnId);
  rows.push({id:questionId,question:turn.question});existing.delete(questionId);
  if(previous?.result&&previous.result.mode!=='pending')rows.push(previous);
  else rows.push({id:turn.turnId,result:{mode:settledTurn(turn)?'guided':'pending',
   title:settledTurn(turn)?'Resposta recuperada':'Resposta em conferência',
   explanation:turn.answer||'Confira o estado desta solicitação antes de repetir.',articles:turn.articles||[]}});
  existing.delete(turn.turnId);
 }
 return [...rows,...existing.values()].slice(-80);
}
export function lessonFromSearch(search){
 try{const values=new URLSearchParams(search||'').getAll('lessonId');return values.length===1&&/^[a-z0-9-]{1,100}$/.test(values[0])?values[0]:null;}catch{return null;}
}


export function conversationScreen(path){return typeof path==='string'&&/^\/(?:lp|social|platform|genios-pro|universidade|tendencias|bankscore)(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(path)?path:null;}
