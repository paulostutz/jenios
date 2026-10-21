'use client';
import {useEffect,useState,useRef} from 'react';
import Link from 'next/link';
import {adminFetch} from './AdminAccess';
import InterSetupForm from './InterSetupForm';
export default function InterAdminPanel(){
 const [data,setData]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),live=useRef(true);
 async function check(test=false){setBusy(true);setMessage('');try{const result=await(await adminFetch('/api/admin/inter',{method:test?'POST':'GET'})).json();if(live.current)setData(result);}catch(e){if(live.current)setMessage(e.message);}finally{if(live.current)setBusy(false);}}
 useEffect(()=>{live.current=true;check();return()=>{live.current=false;};},[]);
 return <section style={{background:'white',padding:22,borderRadius:16,margin:'20px 0'}}><h2>Conexão Pix · Inter</h2><p>Confira a conexão e depois use uma compra real para validar a cobrança.</p>{data&&<><p>Branch: <strong>{data.branch||'ambiente local'}</strong></p><ul>{data.variables.map(v=><li key={v.key}>{v.key}: {v.present?'Presente':'Ausente neste ambiente'}</li>)}<li>Provedor Inter Pix: {data.providerEnabled?'Selecionado':'Ainda não selecionado'}</li><li>Certificado: {{valid:'Válido e corresponde à chave',missing:'Não informado',expired:'Expirado',mismatch:'Não corresponde à chave',invalid:'Formato inválido',not_yet_valid:'Validade ainda não iniciou'}[data.certificate]}</li></ul>{data.message&&<p role="status">{data.message}</p>}</>}<button disabled={busy} onClick={()=>check(true)}>{busy?'Verificando…':'Testar conexão com o Inter'}</button><p>Este teste consulta o banco sem emitir cobrança.</p><Link href="/bankscore">Abrir BankScore para testar uma compra →</Link>{message&&<p role="alert">{message}</p>}<InterSetupForm/></section>;
}
