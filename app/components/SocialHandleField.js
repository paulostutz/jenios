'use client';
import {useEffect,useRef,useState} from 'react';
import {validateHandle,normalizeHandle,createLatestHandleLookup} from '../../lib/social/handle-policy.mjs';
export default function SocialHandleField({value,onChange,disabled=false}){
 const [state,setState]=useState({status:'idle'});
 const lookup=useRef(null);if(!lookup.current)lookup.current=createLatestHandleLookup();
 useEffect(()=>{
  lookup.current.cancel();
  const checked=validateHandle(value);
  if(!value){setState({status:'idle'});return;}
  if(!checked.ok){setState({status:'invalid',error:checked.error});return;}
  setState({status:'checking'});
  const timer=setTimeout(()=>lookup.current.check(value,setState),300);
  return ()=>{clearTimeout(timer);lookup.current.cancel();};
 },[value]);
 const unavailable=state.status==='ready'&&!state.available;
 return <div className="social-handle-field">
  <label htmlFor="social-handle">Escolha seu @</label>
  <div className="social-handle-input"><span aria-hidden="true">@</span><input id="social-handle" name="handle" value={value} onChange={e=>onChange(normalizeHandle(e.target.value))} disabled={disabled} required minLength={3} maxLength={30} pattern="[a-z0-9_]{3,30}" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" aria-describedby="social-handle-help social-handle-status" aria-invalid={unavailable||state.status==='invalid'} placeholder="seunome"/></div>
  <small id="social-handle-help">De 3 a 30 letras, números ou _. Este será seu identificador público.</small>
  <p id="social-handle-status" role="status" aria-live="polite">
   {state.status==='checking'?'Verificando disponibilidade…':state.status==='ready'?(state.available?'@'+state.handle+' parece disponível agora. A confirmação ocorre ao concluir o cadastro.':(state.suggestions.length?'Este @ não está disponível. Escolha uma sugestão abaixo ou tente outro.':'Este @ não está disponível. Tente outro identificador.')):state.error||''}
  </p>
  {unavailable&&state.suggestions.length>0&&<div className="social-handle-suggestions" aria-label="Sugestões de identificadores disponíveis">
   {state.suggestions.map(handle=><button key={handle} type="button" disabled={disabled} onClick={()=>onChange(handle)}>@{handle}</button>)}
  </div>}
 </div>;
}
