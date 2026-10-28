'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import s from './demo-broker-connector.module.css';
const ORIGIN='https://connect.jenios.com.br';
/** No broker secret input; OAuth consent occurs only on Alpaca's official site. */
export default function AlpacaConnectR107(){
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[rows,setRows]=useState([]),[notice,setNotice]=useState(''),[nextPage,setNextPage]=useState(null);
 const token=useCallback(async()=>{if(!platformSupabase)throw Error('Entre na JENIOS Platform para continuar.');
  const {data,error}=await platformSupabase.auth.getSession();if(error||!data?.session?.access_token)throw Error('Entre na JENIOS Platform para continuar.');return data.session.access_token;},[]);
 const request=useCallback(async(path,body)=>{
  const response=await fetch(ORIGIN+path,{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+await token()},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok||data.ok!==true)throw Error('Não foi possível confirmar o vínculo. Nenhuma ordem foi enviada.');return data;
 },[token]);
 const refresh=useCallback(async()=>{try{const data=await request('/connections',{});setRows(data.connections);setNextPage(data.nextPage);}
  catch{setRows([]);setNextPage(null);setNotice('Entre na Platform e consulte novamente. A autorização só é confirmada pelo serviço.');}},[request]);
 async function more(){if(busy||nextPage===null)return;setBusy(true);try{const data=await request('/connections',{page:nextPage});
  setRows(previous=>[...new Map([...previous,...data.connections].map(row=>[row.id,row])).values()]);setNextPage(data.nextPage);
 }catch{setNotice('Não foi possível consultar os próximos vínculos. Tente novamente.');}finally{setBusy(false);}}
 useEffect(()=>{void refresh();},[refresh]);
 async function begin(event){event.preventDefault();if(!consent||busy)return;setBusy(true);setNotice('');
  try{
   const accessToken=await token();
   // Top-level POST works without third-party cookies and never puts a bearer
   // token in an URL, query string, storage key or external analytics event.
   const form=document.createElement('form');form.method='POST';form.action=ORIGIN+'/connect/alpaca/start';
   for(const [name,value] of Object.entries({accessToken,consent:'CONNECT_MY_ALPACA_LIVE_ACCOUNT_WITHOUT_CUSTODY'})){
    const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input);
   }
   document.body.appendChild(form);form.submit();form.remove();
  }catch{setNotice('Entre na JENIOS Platform antes de autorizar a corretora.');setBusy(false);}
 }
 async function disconnect(id){if(busy||!window.confirm('Remover o acesso local da JENIOS? Isso não cancela ordens, não encerra posições e não revoga o aplicativo na Alpaca.'))return;
  setBusy(true);try{await request('/disconnect',{connectionId:id,confirmation:'REVOKE_LOCAL_ALPACA_CONNECTION'});setNotice('Acesso local removido. Revogue também o aplicativo no painel oficial da Alpaca.');await refresh();}
  catch{setNotice('Desconexão não confirmada. Confira o acesso no painel oficial da Alpaca.');}finally{setBusy(false);}
 }
 return <section className={s.panel} aria-labelledby="alpaca-connect-heading">
  <h2 id="alpaca-connect-heading">Autorizar sua conta Alpaca</h2><p>O dinheiro fica na sua conta na corretora. Você autoriza a JENIOS no site oficial da Alpaca, sem informar senha ou chaves aos gênios.</p>
  <p>O escopo <strong>trading</strong> permite criar, alterar e cancelar ordens na corretora. Esta etapa conecta e verifica a conta; a ativação do robô e os limites de risco são separados. Não solicitamos saques.</p>
  <form onSubmit={begin}><label className={s.consent}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/>Sou titular da conta e autorizo iniciar a conexão OAuth Live da Alpaca, com o escopo de negociação explicado acima. Entendo que isso não ativa o robô.</label>
   <button type="submit" disabled={!consent||busy}>{busy?'Processando…':'Continuar na Alpaca'}</button></form>
  <p><Link href="/platform/entrar">Entrar na JENIOS Platform</Link></p>
  <button type="button" disabled={busy} onClick={refresh}>Consultar meus vínculos</button>
  {rows.map(row=><div key={row.id} className={s.current}><strong>Alpaca • {row.status==='READ_VERIFIED'?'conta verificada para consulta':row.status==='REVOKED'?'acesso local removido':'verificação pendente'}</strong>
   <p>Última consulta: {row.lastReadAt?new Date(row.lastReadAt).toLocaleString('pt-BR'):'não confirmada'}. Negociação JENIOS desativada.</p>
   {row.status!=='REVOKED'&&<button type="button" disabled={busy} onClick={()=>disconnect(row.id)}>Remover acesso local</button>}</div>)}
  {nextPage!==null&&<button type="button" disabled={busy} onClick={more}>Mostrar mais vínculos</button>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
