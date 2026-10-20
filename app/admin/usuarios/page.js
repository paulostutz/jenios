'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import AdminAccess,{adminFetch} from '../../components/AdminAccess';
const card={background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:20,margin:'15px 0'};
const field={display:'grid',gap:7,fontSize:13,color:'#334155'};
function Users(){
 const [users,setUsers]=useState([]),[page,setPage]=useState(1),[next,setNext]=useState(false);
 const [email,setEmail]=useState(''),[role,setRole]=useState('user');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(p=1){setBusy(true);setError('');try{
  const r=await adminFetch('/api/admin/users?page='+p),d=await r.json();
  setUsers(d.users||[]);setPage(d.page);setNext(d.hasNext);
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 async function invite(e){e.preventDefault();if(busy)return;const current=email.trim().toLowerCase();
  if(!window.confirm('Enviar convite '+(role==='master'?'MASTER com acesso administrativo completo':'de usuário comum')+' para '+current+'?'))return;
  setBusy(true);setError('');setMessage('');
  try{const r=await adminFetch('/api/admin/users',{method:'POST',body:JSON.stringify({email:current,role})});const d=await r.json();
   if(!d.inviteSent)throw Error('O convite não foi confirmado.');
   setMessage('Convite enviado para '+current+'. A conta ainda precisa confirmar o e-mail.');setEmail('');await load(1);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function toggle(user){if(busy)return;const enabled=!user.isMaster;
  const confirmation=enabled?'Conceder Master com acesso administrativo completo para '+user.email+'?':'Revogar acesso Master de '+user.email+'?';
  if(!window.confirm(confirmation))return;setBusy(true);setError('');setMessage('');
  try{const r=await adminFetch('/api/admin/users',{method:'PATCH',body:JSON.stringify({userId:user.id,enabled})});const d=await r.json();
   if(!d.ok)throw Error('Não foi possível confirmar a alteração.');setMessage('Alteração confirmada pelo servidor e registrada na auditoria.');await load(page);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <main style={{minHeight:'100vh',background:'#f3f5fa',color:'#13233f',padding:'clamp(15px,3vw,32px)',fontFamily:'system-ui'}}>
  <div style={{maxWidth:980,margin:'auto',display:'grid',gap:13}}>
   <Link href="/admin?area=acessos">← Central Master</Link>
   <header><small>JENIOS · ESCRITÓRIO MASTER</small><h1>Usuários e Masters</h1>
    <p>Convide pessoas sem criar ou conhecer senhas. Somente Masters podem cadastrar, promover ou revogar Masters.</p></header>
   <form style={card} onSubmit={invite}>
    <h2 style={{fontSize:17}}>Convidar novo usuário</h2>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
     <label style={field}>E-mail<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="pessoa@empresa.com" autoComplete="off" style={{padding:12,border:'1px solid #cbd5e1',borderRadius:9}}/></label>
     <label style={field}>Tipo de conta<select value={role} onChange={e=>setRole(e.target.value)} style={{padding:12,border:'1px solid #cbd5e1',borderRadius:9}}>
      <option value="user">Usuário comum</option><option value="master">Master · administração completa</option></select></label>
    </div>
    <button disabled={busy||!email.trim()} style={{marginTop:14,padding:12,background:'#075985',color:'white',border:0,borderRadius:9,fontWeight:800}}>{busy?'Aguarde…':'Enviar convite por e-mail'}</button>
   </form>
   {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
   {message&&<p role="status" style={{color:'#047857'}}>{message}</p>}
   <section style={card}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}>
    <h2 style={{fontSize:17}}>Contas cadastradas</h2><button disabled={busy} onClick={()=>load(page)}>Atualizar lista</button></div>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
     <thead><tr><th align="left">Conta</th><th align="left">Tipo</th><th align="left">E-mail</th><th align="left">Ação</th></tr></thead>
     <tbody>{users.map(u=><tr key={u.id} style={{borderTop:'1px solid #e2e8f0'}}>
      <td style={{padding:'12px 8px',overflowWrap:'anywhere'}}>{u.email}</td>
      <td>{u.isMaster?'Master':'Usuário'}</td><td>{u.confirmed?'Confirmado':'Pendente'}</td>
      <td><button type="button" disabled={busy} onClick={()=>toggle(u)}>{u.isMaster?'Revogar Master':'Tornar Master'}</button></td>
     </tr>)}</tbody></table></div>
    {!users.length&&!busy&&<p>Nenhum registro disponível.</p>}
    <div style={{display:'flex',gap:12,marginTop:16}}>
     <button disabled={busy||page<=1} onClick={()=>load(page-1)}>Anterior</button><span>Página {page}</span><button disabled={busy||!next} onClick={()=>load(page+1)}>Próxima</button>
    </div>
   </section>
   <p style={{fontSize:12,color:'#64748b'}}>O Master administra a Social e a JENIOS PAY e pode consultar a Platform por um canal dedicado e protegido. Este acesso não libera operações reais nem cria assinaturas.</p>
  </div>
 </main>;
}
export default function MasterUsersPage(){return <AdminAccess permission="permissions.manage" loginRedirect="/admin/login"><Users/></AdminAccess>;}
