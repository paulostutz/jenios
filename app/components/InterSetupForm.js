'use client';
import {useEffect,useRef,useState} from 'react';
import {adminFetch} from './AdminAccess';
const font={fontSize:13,color:'#334155'};
export default function InterSetupForm(){
 const [clientId,setClientId]=useState(''),[clientSecret,setClientSecret]=useState(''),
 [pixKey,setPixKey]=useState(''),[accountNumber,setAccountNumber]=useState(''),
 [file,setFile]=useState(null),[status,setStatus]=useState(null),
 [busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const live=useRef(true);
 useEffect(()=>{live.current=true;void refresh();return()=>{live.current=false;};},[]);
 async function refresh(){
  try{const result=await adminFetch('/api/admin/inter/setup',{method:'GET'});
   const body=await result.json();if(!result.ok)throw Error(body.error||'A configuração não está disponível neste ambiente.');
   if(live.current)setStatus(body.configuration);
  }catch(e){if(live.current)setNotice('O cofre JENIOS ainda precisa ser habilitado na homologação.');}
 }
 async function post(body){
  const result=await adminFetch('/api/admin/inter/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await result.json();
  if(!result.ok||data.ok!==true)throw Error(data.code||data.error||'Não foi possível confirmar a configuração.');
  return data.configuration;
 }
 async function encodeZip(selected){
  if(!selected||selected.size<100||selected.size>524288||!(/\.zip$/i.test(selected.name)))
   throw Error('Selecione o ZIP original do Inter de até 512 KB.');
  const buffer=new Uint8Array(await selected.arrayBuffer());
  let out='';for(let i=0;i<buffer.length;i+=32768)out+=String.fromCharCode(...buffer.subarray(i,i+32768));
  return btoa(out);
 }
 async function save(event){
  event.preventDefault();if(busy)return;setBusy('save');setError('');setNotice('');
  try{
   const zipBase64=await encodeZip(file);
   const config=await post({action:'save',clientId,clientSecret,zipBase64,pixKey,accountNumber});
   if(!live.current)return;
   setStatus(config);setClientId('');setClientSecret('');setPixKey('');setAccountNumber('');setFile(null);
   const field=document.getElementById('jenios-inter-zip');if(field)field.value='';
   setNotice('Configuração salva no cofre da JENIOS. A emissão de cobranças não foi ativada.');
  }catch(e){if(live.current)setError(e.message);}finally{if(live.current)setBusy('');}
 }
 async function test(){
  if(busy||!window.confirm('Testar apenas autenticação e consulta do Banco Inter, sem emitir cobranças?'))return;
  setBusy('test');setError('');setNotice('');
  try{const config=await post({action:'test',confirmBankConnection:true});
   if(live.current){setStatus(config);setNotice('Conexão de leitura confirmada. A homologação financeira ainda é necessária.');}}
  catch(e){if(live.current)setError(e.message);}finally{if(live.current)setBusy('');}
 }
 return <section style={{background:'#fff',padding:20,border:'1px solid #cbd5e1',borderRadius:16,display:'grid',gap:15,marginTop:18}} aria-label="Configuração protegida Banco Inter JENIOS">
  <div><h3 style={{margin:'0 0 6px'}}>Cadastrar credenciais do Banco Inter</h3><p style={font}>Mesmo fluxo simples do CHEFE, mas com cofre separado. Somente Master autorizado pode salvar ou testar.</p></div>
  {status&&<div style={{background:'#f8fafc',padding:12,borderRadius:10,...font}} role="status">
   <strong>{status.configured?'Credenciais protegidas cadastradas':'Aguardando configuração'}</strong>
   {status.clientIdLast4&&<p>Client ID terminado em ••••{status.clientIdLast4}</p>}
   {status.certificateExpiresAt&&<p>Certificado vence em {new Date(status.certificateExpiresAt).toLocaleDateString('pt-BR')}</p>}
   <p>Autenticação de leitura: {status.bankAuthenticated?'Confirmada no teste':'Pendente'}. Cobranças: não ativadas nesta configuração.</p>
  </div>}
  <form onSubmit={save} style={{display:'grid',gap:11}}>
   <label style={font}>Client ID<input required autoComplete="off" minLength={8} maxLength={200} value={clientId} onChange={e=>setClientId(e.target.value)} style={{display:'block',width:'100%',padding:10,boxSizing:'border-box'}}/></label>
   <label style={font}>Client Secret<input required autoComplete="off" type="password" minLength={16} maxLength={500} value={clientSecret} onChange={e=>setClientSecret(e.target.value)} style={{display:'block',width:'100%',padding:10,boxSizing:'border-box'}}/></label>
   <label style={font}>ZIP de certificado e chave privada fornecido pelo Inter<input id="jenios-inter-zip" required type="file" accept=".zip,application/zip" onChange={e=>setFile(e.target.files?.[0]||null)} style={{display:'block',marginTop:6}}/></label>
   <label style={font}>Chave Pix recebedora<input required autoComplete="off" maxLength={140} value={pixKey} onChange={e=>setPixKey(e.target.value)} style={{display:'block',width:'100%',padding:10,boxSizing:'border-box'}}/></label>
   <label style={font}>Número da conta (opcional)<input maxLength={60} value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} style={{display:'block',width:'100%',padding:10,boxSizing:'border-box'}}/></label>
   <button disabled={Boolean(busy)||!file||!clientId||!clientSecret||!pixKey} type="submit" style={{background:'#075985',color:'#fff',padding:12,border:0,borderRadius:9,fontWeight:800,cursor:'pointer'}}>{busy==='save'?'Salvando no cofre…':'Salvar configuração protegida'}</button>
  </form>
  <button disabled={Boolean(busy)||!status?.configured} type="button" onClick={test} style={{background:'#f0fdfa',padding:12,border:'1px solid #0f766e',borderRadius:9,color:'#115e59',fontWeight:700}}>{busy==='test'?'Conferindo Banco Inter…':'Testar autenticação sem cobrar'}</button>
  <p style={{...font,fontSize:12}}>Client Secret, certificado e chave privada não são retornados ao navegador após o envio. Não anexe este ZIP no chat, GitHub ou Biblioteca.</p>
  {notice&&<p role="status" style={font}>{notice}</p>}{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
 </section>;
}
