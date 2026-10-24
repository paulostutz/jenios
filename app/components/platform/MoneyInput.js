'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {parseBRLInput,formatBRLInput,formatBRLEdit} from '../../../lib/platform/brl-input.mjs';

export default function MoneyInput({value,onValueChange,style={},...props}){
 const [text,setText]=useState(()=>formatBRLInput(value));
 const input=useRef(null),focused=useRef(false),caret=useRef(null);
 useEffect(()=>{if(!focused.current)setText(formatBRLInput(value));},[value]);
 useLayoutEffect(()=>{if(caret.current!==null&&input.current){input.current.setSelectionRange(caret.current,caret.current);caret.current=null;}},[text]);
 function change(event){
  const raw=event.target.value;
  const before=raw.slice(0,event.target.selectionStart??raw.length).replace(/[^\d,]/g,'').length;
  const inputType=event.nativeEvent.inputType||'';
  const automaticGroups=parseBRLInput(text)!==null&&/^(insertText|deleteContentBackward|deleteContentForward)$/.test(inputType)
   &&(raw.match(/\./g)||[]).length<=(text.match(/\./g)||[]).length;
  const formatted=formatBRLEdit(automaticGroups?raw.replace(/\./g,''):raw);
  let seen=0,pos=0;
  for(;pos<formatted.length&&seen<before;pos++)if(/[\d,]/.test(formatted[pos]))seen++;
  caret.current=pos;setText(formatted);
  const number=parseBRLInput(formatted);
  if(number!==null)onValueChange(number);
 }
 const valid=text===''||parseBRLInput(text)!==null;
 return <span style={{display:'inline-block',position:'relative',width:style.width||'100%',minWidth:135}}>
  <span aria-hidden="true" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'#475569',pointerEvents:'none'}}>R$</span>
  <input {...props} ref={input} type="text" inputMode="decimal" value={text} aria-invalid={!valid}
   onFocus={()=>{focused.current=true;}} onChange={change}
   onBlur={()=>{focused.current=false;setText(formatBRLInput(value));}}
   title="Valor em reais. Use vírgula para centavos, por exemplo 1.000,50."
   style={{...style,width:'100%',boxSizing:'border-box',paddingLeft:32}}/>
 </span>;
}
