'use client';
import {useEffect,useRef,useState} from 'react';
import {adminFetch} from './AdminAccess';

const endpoint='/api/admin/inter/setup';
const font={fontSize:13,color:'#334155',lineHeight:1.6};
const inputStyle={display:'block',width:'100%',padding:10,boxSizing:'border-box',marginTop:4};
const buttonStyle={padding:12,borderRadius:9,fontWeight:700,cursor:'pointer'};

function messageFor(error,fallback){
 const message=typeof error?.message==='string'?error.message.trim():'';
 if(!message||['TypeError','SyntaxError'].includes(error?.name)||/^[A-Z][A-Z0-9_]+$/.test(message))return fallback;
 return message;
}

async function configurationRequest(body,signal){
 const response=await adminFetch(endpoint,{
  method:body?'POST':'GET',signal,
  ...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})
 });
 let data;
 try{data=await response.json();}
 catch{throw Error('Não foi possível conferir a resposta da configuração. Tente atualizar o estado.');}
 if(!response.ok||data?.ok!==true)throw Error(data?.error||'Não foi possível confirmar a configuração do Banco Inter.');
 const config=data.configuration;
 if(!config||typeof config.configured!=='boolean'||typeof config.bankAuthenticated!=='boolean')
  throw Error('O estado da configuração não foi confirmado. Tente atualizar novamente.');
 if(body&&(!config.configured||!config.bankAuthenticated))
  throw Error('A conexão e a configuração ainda não foram confirmadas. Atualize o estado antes de tentar novamente.');
 return {
  configured:config.configured,
  bankAuthenticated:config.configured&&config.bankAuthenticated,
  clientIdLast4:typeof config.clientIdLast4==='string'?config.clientIdLast4.slice(-4):'',
  certificateExpiresAt:typeof config.certificateExpiresAt==='string'?config.certificateExpiresAt:null
 };
}

async function encodeZip(selected){
 if(!selected||selected.size<100||selected.size>524288||!(/\.zip$/i.test(selected.name)))
  throw Error('Selecione o ZIP original do Inter de até 512 KB.');
 const buffer=new Uint8Array(await selected.arrayBuffer());
 let out='';
 for(let i=0;i<buffer.length;i+=32768)out+=String.fromCharCode(...buffer.subarray(i,i+32768));
 return btoa(out);
}

export default function InterSetupForm(){
 const [clientId,setClientId]=useState(''),[clientSecret,setClientSecret]=useState(''),
 [pixKey,setPixKey]=useState(''),[accountNumber,setAccountNumber]=useState(''),
 [file,setFile]=useState(null),[status,setStatus]=useState(null),
 [busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const live=useRef(false),operation=useRef(null),zipInput=useRef(null);

 function current(controller){return live.current&&operation.current===controller&&!controller.signal.aborted;}
 function begin(kind){
  if(!live.current||operation.current)return null;
  const controller=new AbortController();operation.current=controller;
  setBusy(kind);setError('');setNotice('');return controller;
 }
 function finish(controller){
  if(operation.current!==controller)return;
  operation.current=null;if(live.current)setBusy('');
 }
 function clearFields(){
  setClientId('');setClientSecret('');setPixKey('');setAccountNumber('');setFile(null);
  if(zipInput.current)zipInput.current.value='';
 }

 useEffect(()=>{
  live.current=true;void refresh();
  return()=>{
   live.current=false;operation.current?.abort();operation.current=null;
   if(zipInput.current)zipInput.current.value='';
  };
 },[]);

 async function refresh(){
  const controller=begin('refresh');if(!controller)return;
  setStatus(null);
  try{
   const config=await configurationRequest(null,controller.signal);
   if(current(controller))setStatus(config);
  }catch(e){
   if(current(controller))setError(messageFor(e,'Não foi possível carregar a configuração. Confira sua conexão e tente atualizar novamente.'));
  }finally{finish(controller);}
 }

 async function connect(event){
  event.preventDefault();
  const controller=begin('connect');if(!controller)return;
  let payload;
  try{
   const zipBase64=await encodeZip(file);
   if(!current(controller))return;
   payload={action:'connect',confirmBankConnection:true,clientId:clientId.trim(),clientSecret,zipBase64,pixKey:pixKey.trim(),accountNumber:accountNumber.trim()};
   const config=await configurationRequest(payload,controller.signal);
   if(!current(controller))return;
   setStatus(config);
   setNotice(config.bankAuthenticated?
    'Conexão com o Inter confirmada e configuração salva. A homologação das cobranças permanece pendente.':
    'Configuração cadastrada. A conexão com o Inter ainda precisa ser confirmada.');
  }catch(e){
   if(current(controller)){
    setStatus(null);
    setError(messageFor(e,'Não foi possível confirmar a conexão e o salvamento. Atualize o estado antes de tentar novamente.'));
   }
  }finally{
   if(payload){payload.clientSecret='';payload.zipBase64='';payload=null;}
   if(current(controller))clearFields();
   finish(controller);
  }
 }

 async function test(){
  if(status?.configured!==true)return;
  const controller=begin('test');if(!controller)return;
  try{
   const config=await configurationRequest({action:'test',confirmBankConnection:true},controller.signal);
   if(!current(controller))return;
   setStatus(config);
   setNotice(config.bankAuthenticated?
    'Conexão da configuração salva confirmada. Nenhuma cobrança foi emitida.':
    'A configuração está cadastrada, mas a conexão ainda não foi confirmada.');
  }catch(e){
   if(current(controller)){
    setStatus(null);
    setError(messageFor(e,'Não foi possível testar a configuração salva. Confira sua conexão e tente novamente.'));
   }
  }finally{finish(controller);}
 }

 const expiry=status?.certificateExpiresAt?Date.parse(status.certificateExpiresAt):NaN;
 return <section style={{display:'grid',gap:16,marginTop:18}} aria-label="Configuração protegida Banco Inter JENIOS" aria-busy={Boolean(busy)}>
  <div style={{background:'#f8fafc',padding:16,borderRadius:12,...font}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
    <h3 style={{margin:0,color:'#0f172a'}}>Estado da integração</h3>
    <button type="button" disabled={Boolean(busy)} onClick={refresh} style={{...buttonStyle,padding:'8px 12px',background:'#fff',border:'1px solid #94a3b8',color:'#334155'}}>
     {busy==='refresh'?'Atualizando…':'Atualizar estado'}
    </button>
   </div>
   {status?<div role="status">
    <p><strong>Credenciais:</strong> {status.configured?'Cadastradas com proteção':'Aguardando cadastro'}</p>
    <p><strong>Conexão:</strong> {status.bankAuthenticated?'Confirmada no último teste registrado':'Confirmação pendente'}</p>
    <p><strong>Cobranças:</strong> homologação pendente. Conectar ou testar não emite cobranças.</p>
    {status.clientIdLast4&&<p>Client ID terminado em ••••{status.clientIdLast4}</p>}
    {Number.isFinite(expiry)&&<p>Certificado válido até {new Date(expiry).toLocaleDateString('pt-BR')}.</p>}
   </div>:<p role="status">{busy==='refresh'?'Carregando a configuração salva…':'O estado da configuração ainda não foi confirmado.'}</p>}
  </div>

  <div><h3 style={{margin:'0 0 6px'}}>Conectar Banco Inter</h3>
   <p style={font}>Informe as credenciais e selecione o ZIP original fornecido pelo Inter. A conexão será conferida antes de salvar a configuração protegida da JENIOS.</p>
   {status?.configured&&<p style={font}>Uma configuração já está cadastrada. Use o teste abaixo para conferir a conexão salva. Envie novos dados quando precisar substituir as credenciais.</p>}
  </div>
  <form onSubmit={connect} autoComplete="off">
   <fieldset disabled={Boolean(busy)} style={{display:'grid',gap:12,border:0,margin:0,padding:0,minWidth:0}}>
    <label style={font}>Client ID<input required autoComplete="off" spellCheck={false} minLength={8} maxLength={200} value={clientId} onChange={e=>setClientId(e.target.value)} style={inputStyle}/></label>
    <label style={font}>Client Secret<input required autoComplete="new-password" spellCheck={false} type="password" minLength={16} maxLength={500} value={clientSecret} onChange={e=>setClientSecret(e.target.value)} style={inputStyle}/></label>
    <label style={font}>ZIP original do Inter<input ref={zipInput} id="jenios-inter-zip" required type="file" accept=".zip,application/zip" aria-describedby="jenios-inter-zip-help" onChange={e=>setFile(e.target.files?.[0]||null)} style={{display:'block',marginTop:6,maxWidth:'100%'}}/></label>
    <p id="jenios-inter-zip-help" style={{...font,margin:0}}>Até 512 KB, contendo o certificado e a chave privada correspondentes.</p>
    <label style={font}>Chave Pix recebedora<input required autoComplete="off" spellCheck={false} minLength={4} maxLength={140} value={pixKey} onChange={e=>setPixKey(e.target.value)} style={inputStyle}/></label>
    <p style={{...font,margin:0}}>A chave Pix identifica a conta que receberá os pagamentos da JENIOS.</p>
    <label style={font}>Número da conta (opcional)<input autoComplete="off" maxLength={60} value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} style={inputStyle}/></label>
    <p style={{...font,margin:0}}>Ao conectar, você autoriza uma consulta de autenticação ao Inter e o salvamento da configuração. Nenhuma cobrança será emitida.</p>
    <button disabled={Boolean(busy)||!file||!clientId.trim()||!clientSecret||!pixKey.trim()} type="submit" style={{...buttonStyle,background:'#075985',color:'#fff',border:0}}>
     {busy==='connect'?'Conectando e salvando…':'Conectar Banco Inter'}
    </button>
   </fieldset>
  </form>

  <div style={{display:'grid',gap:8}}>
   <button disabled={Boolean(busy)||status?.configured!==true} type="button" onClick={test} style={{...buttonStyle,background:'#f0fdfa',border:'1px solid #0f766e',color:'#115e59'}}>
    {busy==='test'?'Testando a conexão salva…':'Testar conexão salva sem cobrar'}
   </button>
   <p style={{...font,margin:0}}>O teste usa as credenciais já cadastradas. Não é necessário reenviar o ZIP.</p>
  </div>
  <p style={{...font,fontSize:12,margin:0}}>Os campos são limpos após cada tentativa de conexão. Client Secret, certificado e chave privada não são exibidos depois do envio. Mantenha o ZIP em local privado.</p>
  {notice&&<p role="status" style={{...font,margin:0}}>{notice}</p>}
  {error&&<p role="alert" style={{color:'#b91c1c',fontSize:13,lineHeight:1.6,margin:0}}>{error}</p>}
 </section>;
}
