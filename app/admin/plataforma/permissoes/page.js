'use client';
import {useState} from 'react';
import Link from 'next/link';
import AdminAccess,{adminFetch} from '../../../components/AdminAccess';

function PermissionManager(){
  const [handle,setHandle]=useState('');
  const [permission,setPermission]=useState('reports.run');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const valid=/^@?[a-zA-Z0-9_.]{3,40}$/.test(handle.trim());
  async function save(enabled){
    if(!valid || busy)return;
    setBusy(true);setMessage('');
    try{
      const response=await adminFetch('/api/admin/access',{
        method:'POST',
        body:JSON.stringify({handle:handle.trim(),permission,enabled})
      });
      const outcome=await response.json();
      setMessage((enabled?'Permissão concedida':'Permissão revogada')+
        ' para @'+outcome.handle+'. Alteração auditada no servidor.');
    }catch(error){
      setMessage(error.message||'Não foi possível confirmar a alteração. Nenhuma mudança foi declarada.');
    }finally{setBusy(false);}
  }
  return (
    <main style={{minHeight:'100vh',background:'#f1f5f9',fontFamily:'system-ui,sans-serif',padding:'32px 16px',color:'#0f172a'}}>
      <div style={{maxWidth:760,margin:'0 auto'}}>
        <Link href="/admin" style={{fontSize:13,color:'#6d28d9',textDecoration:'none'}}>← Voltar à administração</Link>
        <header style={{margin:'25px 0 18px'}}>
          <span style={{fontSize:11,color:'#7c3aed',fontWeight:800,letterSpacing:'.1em'}}>JENIOS · GESTÃO AUTORIZADA</span>
          <h1 style={{fontSize:'clamp(24px,4vw,34px)',margin:'7px 0 6px'}}>Permissões administrativas</h1>
          <p style={{color:'#64748b',lineHeight:1.6,fontSize:13}}>Autorize somente funções administrativas permitidas pela política do servidor. Nenhuma senha ou credencial é solicitada aqui.</p>
        </header>
        <section style={{borderRadius:17,background:'#fff',border:'1px solid #e2e8f0',padding:'clamp(18px,4vw,30px)',boxShadow:'0 6px 24px #0f172a10',display:'grid',gap:18}}>
          <label style={{fontSize:13,fontWeight:800,display:'grid',gap:8}}>Perfil cadastrado (@)
            <input value={handle} autoComplete="off" maxLength={41}
              onChange={e=>setHandle(e.target.value)}
              placeholder="@usuario"
              style={{width:'100%',boxSizing:'border-box',padding:13,borderRadius:10,border:'1px solid #cbd5e1',fontSize:14}}/>
          </label>
          <label style={{fontSize:13,fontWeight:800,display:'grid',gap:8}}>Permissão
            <select value={permission} onChange={e=>setPermission(e.target.value)}
              style={{padding:13,borderRadius:10,border:'1px solid #cbd5e1',fontSize:13}}>
              <option value="reports.run">Executar consultas e relatórios</option>
              <option value="finance.manage">Gestão financeira autorizada</option>
            </select>
          </label>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button disabled={busy||!valid} onClick={()=>save(true)} style={{padding:'11px 16px',border:0,borderRadius:9,background:'#6d28d9',color:'#fff',fontWeight:800,opacity:busy||!valid?.5:1,cursor:'pointer'}}>Conceder permissão</button>
            <button disabled={busy||!valid} onClick={()=>save(false)} style={{padding:'11px 16px',border:'1px solid #fecaca',borderRadius:9,background:'#fff7ed',color:'#991b1b',fontWeight:800,opacity:busy||!valid?.5:1,cursor:'pointer'}}>Revogar permissão</button>
          </div>
          <p role="status" aria-live="polite" style={{fontSize:12,color:'#475569',margin:0}}>{busy?'Aguardando confirmação do servidor…':message||'Toda alteração exige autenticação, permissão de gestão e auditoria no backend.'}</p>
        </section>
        <p style={{fontSize:12,color:'#64748b',lineHeight:1.6}}>A função Master não pode ser concedida por este formulário. Em caso de indisponibilidade, nenhuma permissão será presumida.</p>
      </div>
    </main>
  );
}
export default function PlatformAdminPermissions(){
  return <AdminAccess permission="permissions.manage" loginRedirect="/admin/login"><PermissionManager/></AdminAccess>;
}
