'use client';
/** B169: API-key onboarding exclusively in protected Platform homologation. */
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import s from './demo-broker-connector.module.css';
const environments={binance:'testnet',alpaca:'paper'};
const errorLabels={PLATFORM_AUTH_REQUIRED:'Entre novamente na JENIOS Platform.',ORIGIN_DENIED:'Origem da solicitação não autorizada.',
 DEMO_CONNECTORS_DISABLED:'Integração demonstrativa desativada neste ambiente.',INVALID_CREDENTIAL_FORMAT:'Verifique o formato das credenciais.',
 EXISTING_DEMO_CONNECTION:'Esta corretora já possui um vínculo demonstrativo. Desconecte antes de substituir a chave.',
 CONNECT_COOLDOWN_60_SECONDS:'Aguarde ao menos um minuto antes de tentar cadastrar a chave novamente.',SYNC_INTERVAL_120_SECONDS:'Aguarde pelo menos dois minutos entre as consultas.',SYNC_IN_PROGRESS:'Consulta anterior em andamento.',
 PROVIDER_401:'A corretora recusou a autenticação. Confira a chave de teste.',PROVIDER_403:'A corretora recusou as permissões da chave.',
 PROVIDER_429:'Limite temporário de consultas da corretora. Aguarde.',PROVIDER_451:'Consulta recusada pelo fornecedor na região da conta.',
 PAGINATION_REQUIRED:'Lista longa demais para uma reconciliação completa. Conexão não foi certificada.',
 EXTERNAL_ACCOUNT_CHANGED:'A chave passou a apontar para outra conta. Desconecte e refaça a autorização.',
 CONNECTION_NOT_FOUND:'Vínculo indisponível. Atualize a lista.',DEMO_UNAVAILABLE:'Integração indisponível. Nenhuma operação foi executada.',
 DEMO_READ_FAILED:'Leitura demonstrativa não confirmada. Nenhuma ordem foi enviada.'};
export default function DemoBrokerConnector({provider}){
 const supported=Object.hasOwn(environments,provider);
 const [connections,setConnections]=useState([]),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(''),[logged,setLogged]=useState(false);
 const [apiKey,setApiKey]=useState(''),[secret,setSecret]=useState(''),[consent,setConsent]=useState(false);
 const auth=useCallback(async()=>{
  if(!platformSupabase)throw Error('A conta da Platform não está configurada.');
  const {data,error}=await platformSupabase.auth.getSession();
  if(error||!data?.session?.access_token)throw Error('Entre na JENIOS Platform antes de cadastrar a API da corretora.');
  return data.session.access_token;
 },[]);
 const call=useCallback(async(method,path,body)=>{
  const token=await auth();
  const response=await fetch('/api/platform/broker-connections'+path,{
   method,cache:'no-store',credentials:'omit',redirect:'error',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({ok:false,code:'DEMO_UNAVAILABLE'}));
  if(!response.ok||!data.ok)throw Error(errorLabels[data.code]||'Não foi possível confirmar a solicitação. Nenhuma ordem foi enviada.');
  return data;
 },[auth]);
 const refresh=useCallback(async()=>{
  try{const {connections:items}=await call('GET','');setConnections(items||[]);setLogged(true);}catch{setLogged(false);setConnections([]);}
 },[call]);
 useEffect(()=>{void refresh();},[refresh]);
 async function connect(event){
  event.preventDefault();if(!supported||busy||!consent)return;
  setError('');setNotice('');setBusy('connect');
  // This state contains ephemeral secret values only during form entry. Nothing is logged or stored locally.
  try{
   const data=await call('POST','',{provider,environment:environments[provider],apiKey,secret,confirmation:'READ_ONLY_DEMO_NO_ORDERS'});
   setConnections(items=>[...(items||[]).filter(x=>x.id!==data.connection.id&&x.provider!==provider),data.connection]);
   setNotice('Leitura demonstrativa autenticada. Somente consultas; nenhuma ordem foi enviada.');
  }catch(e){setError(e.message||'Falha ao validar as credenciais de teste.');}
  finally{setApiKey('');setSecret('');setConsent(false);setBusy('');}
 }
 async function act(entry,kind){
  if(busy)return;setError('');setNotice('');setBusy(kind+entry.id);
  try{
   if(kind==='revoke'&&!window.confirm('Desconectar esta API de teste? Isso NÃO cancela ordens nem revoga a chave na corretora.'))return;
   const data=await call(kind==='revoke'?'DELETE':'POST','/'+encodeURIComponent(entry.id)+(kind==='sync'?'/sync':''));
   if(kind==='revoke'){setConnections(rows=>rows.map(x=>x.id===entry.id?{...x,status:'revoked',connectedForReadOnlyDemo:false,positionCount:0,openOrderCount:0}:x));
    setNotice('Vínculo JENIOS removido. Revogue a chave também no site da corretora.');}
   else{setConnections(rows=>rows.map(x=>x.id===entry.id?data.connection:x));
    setNotice(data.reconciliation?.reviewRequired?'Há dados que deixaram de aparecer. Não é possível presumir encerramento, cancelamento ou execução.':'Sincronização concluída em ambiente demonstrativo.');}
  }catch(e){setError(e.message||'Não foi possível confirmar a solicitação.');}
  finally{setBusy('');}
 }
 const current=connections.find(c=>c.provider===provider&&c.environment===environments[provider]&&c.status==='active');
 return <section className={s.panel} aria-labelledby="demo-broker-heading" data-demo-broker="private-preview-only">
  <div className={s.intro}><span className={s.tag}>PILOTO PRIVADO • TESTNET / PAPER</span><h2 id="demo-broker-heading">Conectar sua própria conta de teste</h2>
   <p>A chave fica cifrada no servidor e é usada apenas para consultar saldos, posições e ordens abertas da conta demonstrativa. Você mantém os recursos na corretora. Não há operações, saques, custódia ou execução real.</p></div>
  {!logged&&<p className={s.note}>Para usar a conexão individual, <Link href="/platform/entrar">entre na JENIOS Platform</Link>. A sessão da Social não concede acesso a credenciais da corretora.</p>}
  {!supported&&<p className={s.note}>O guia de {provider} está disponível, mas o conector autenticado ainda precisa de homologação. Nesta fase, as APIs de teste são Binance Spot Testnet e Alpaca Paper.</p>}
  {supported&&logged&&<>
   {current?<div className={s.current}><strong>{provider==='binance'?'Binance Spot Testnet':'Alpaca Paper'} • leitura demonstrativa autenticada</strong>
     <dl><div><dt>Última leitura</dt><dd>{current.lastSyncedAt?new Date(current.lastSyncedAt).toLocaleString('pt-BR'):'Não confirmada'}</dd></div>
      <div><dt>{provider==='binance'?'Saldos Spot':'Posições'}</dt><dd>{current.positionCount}</dd></div><div><dt>Ordens abertas</dt><dd>{current.openOrderCount}</dd></div>
      <div><dt>Permissões de negociação</dt><dd>Não verificadas / não habilitadas na JENIOS</dd></div></dl>
     <p className={s.notice}>A API da JENIOS neste piloto faz apenas consultas GET. Mesmo que a chave no fornecedor tenha outras permissões, a JENIOS não enviará ordens.</p>
     <div className={s.actions}><button type="button" disabled={!!busy} onClick={()=>act(current,'sync')}>{busy?'Processando…':'Atualizar leitura'}</button>
      <button type="button" className={s.secondary} disabled={!!busy} onClick={()=>act(current,'revoke')}>Desconectar API de teste</button></div>
    </div>:<form onSubmit={connect} autoComplete="off" className={s.form}>
    <p><strong>{provider==='binance'?'Binance Spot Testnet':'Alpaca Paper'}</strong> — apenas credenciais do ambiente demonstrativo. Nunca informe credenciais de conta real aqui.</p>
    <label>API Key de teste<input type="password" autoComplete="off" spellCheck={false} autoCapitalize="off" maxLength={256} value={apiKey} onChange={e=>setApiKey(e.target.value)} required disabled={!!busy}/></label>
    <label>Secret de teste<input type="password" autoComplete="off" spellCheck={false} autoCapitalize="off" maxLength={256} value={secret} onChange={e=>setSecret(e.target.value)} required disabled={!!busy}/></label>
    <label className={s.consent}><input type="checkbox" checked={consent} disabled={!!busy} onChange={e=>setConsent(e.target.checked)}/>
      Confirmo que essas chaves são de TESTNET/PAPER, autorizo consultas de leitura e entendo que a JENIOS não enviará ordens nem solicitará saques.</label>
    <button type="submit" disabled={!!busy||!consent||!apiKey||!secret}>{busy?'Validando…':'Validar e vincular minha conta de teste'}</button>
   </form>}
   {!current&&connections.filter(c=>c.provider===provider&&c.status==='revoked').length>0&&<p className={s.note}>Conexão anterior revogada. Para voltar, cadastre uma nova chave demonstrativa e autorize novamente.</p>}
  </>}
  {notice&&<p className={s.notice} role="status">{notice}</p>}
  {error&&<p className={s.error} role="alert">{error}</p>}
  <p className={s.disclaimer}>Conectar aqui não autoriza operar no mercado real. Para cancelar ordens, encerrar posições ou revogar sua API no fornecedor, use a própria corretora. Nunca envie chaves ao Gênio, à Gênia ou pelo chat.</p>
 </section>;
}
