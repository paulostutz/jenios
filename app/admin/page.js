'use client';
import { useState } from 'react';

export default function AdminPage() {
  const [abaAdmin, setAbaAdmin] = useState('utilizadores');

  const [utilizadores, setUtilizadores] = useState([
    { id: 1, nome: 'Carlos Silva', email: 'carlos@email.com', plano: 'Trader Pro (Cripto)', status: 'Ativo', faturamento: 'R$ 149,90' },
    { id: 2, nome: 'Ana Paula Mendes', email: 'ana@email.com', plano: 'Starter (B3)', status: 'Trial (7 dias)', faturamento: 'Grátis' },
    { id: 3, nome: 'Roberto Santos', email: 'roberto@email.com', plano: 'Institucional (Global)', status: 'Ativo', faturamento: 'R$ 199,90' },
  ]);

  const [postsSociais, setPostsSociais] = useState([
    { id: 1, autor: 'Lucas Trader', conteudo: 'Estratégia de HFT a funcionar perfeitamente no Mini-Índice.', status: 'Publicado' },
    { id: 2, autor: 'Spam Bot 99', conteudo: 'Ganhe dinheiro fácil clicando neste link externo...', status: 'Pendente' }
  ]);

  const [leadsSimulador, setLeadsSimulador] = useState([
    { id: 1, nome: 'Marcos Vinicius', email: 'marcos@email.com', whatsapp: '+55 11 98888-1111', score: '35%', data: 'Hoje, 18:20' },
    { id: 2, nome: 'Juliana Costa', email: 'juliana@email.com', whatsapp: '+55 21 97777-2222', score: '80%', data: 'Hoje, 16:45' },
    { id: 3, nome: 'Fernando Alves', email: 'fernando@email.com', whatsapp: '+55 31 96666-3333', score: '20%', data: 'Ontem, 14:10' }
  ]);

  const [admins, setAdmins] = useState([
    { id: 1, nome: 'Paulo Stutz (Master)', email: 'admin@jenios.com', perm: 'Geral (Master)' },
    { id: 2, nome: 'Gestor Financeiro', email: 'financeiro@jenios.com', perm: 'Relatórios & Financeiro' }
  ]);

  const [novoAdminNome, setNovoAdminNome] = useState('');
  const [novoAdminEmail, setNovoAdminEmail] = useState('');
  const [novoAdminSenha, setNovoAdminSenha] = useState('');
  const [permissoes, setPermissoes] = useState({
    geral: false,
    utilizadores: true,
    moderacao: true,
    financeiro: false,
    cadastroUsuarios: true,
    monitoramentoSocial: true
  });

  const banirUtilizador = (id) => {
    setUtilizadores(utilizadores.map(u => u.id === id ? { ...u, status: 'Banido' } : u));
  };

  const aprovarPost = (id) => {
    setPostsSociais(postsSociais.map(p => p.id === id ? { ...p, status: 'Publicado' } : p));
  };

  const removerPost = (id) => {
    setPostsSociais(postsSociais.filter(p => p.id !== id));
  };

  const exportarRelatorio = (tipo) => {
    alert(`📥 Relatório de [ ${tipo.toUpperCase()} ] exportado com sucesso (.CSV / .XLSX)!`);
  };

  const criarNovoAdmin = (e) => {
    e.preventDefault();
    if (!novoAdminNome || !novoAdminEmail || !novoAdminSenha) {
      alert("Por favor, preencha todos os campos do novo administrador.");
      return;
    }

    let permStr = [];
    if (permissoes.geral) permStr.push("Geral (Master)");
    if (permissoes.utilizadores) permStr.push("Gestão de Utilizadores");
    if (permissoes.moderacao) permStr.push("Moderação Social");
    if (permissoes.financeiro) permStr.push("Relatórios & Financeiro");
    if (permissoes.cadastroUsuarios) permStr.push("Cadastro de Usuários");
    if (permissoes.monitoramentoSocial) permStr.push("Monitoramento Social");

    const novoObj = {
      id: Date.now(),
      nome: novoAdminNome,
      email: novoAdminEmail,
      perm: permStr.join(' • ')
    };

    setAdmins([...admins, novoObj]);
    setNovoAdminNome('');
    setNovoAdminEmail('');
    setNovoAdminSenha('');
    alert("Novo administrador cadastrado com sucesso!");
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* CABEÇALHO DO ADMIN */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', color: '#0f172a', padding: '16px 24px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#dc2626', color: '#fff', fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(220, 38, 38, 0.4)' }}>
              A
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS BACKOFFICE</span>
              <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold', fontFamily: 'monospace' }}>● PAINEL ADMINISTRATIVO RESTRITO</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>Ir para Dashboard</a>
            <a href="/admin/login" style={{ backgroundColor: '#fee2e2', color: '#991b1b', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '10px' }}>Sair</a>
          </div>
        </div>

        {/* MÉTRICAS GLOBAIS DE NEGÓCIO (COM TOTAIS CONSOLIDADOS NO TOPO) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase' }}>Volume Protegido Hoje</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#10b981' }}>R$ 84.500,00</div>
            <span style={{ fontSize: '10px', color: '#cbd5e1' }}>Automutilação evitada</span>
          </div>

          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase' }}>Faturamento Recorrente (MRR)</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#a78bfa' }}>R$ 142.850,00</div>
            <span style={{ fontSize: '10px', color: '#cbd5e1' }}>Renovações ativas</span>
          </div>

          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase' }}>Assinantes Ativos</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff' }}>1,320</div>
            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>+98 esta semana</span>
          </div>

          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase' }}>Utilizadores da Social</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#38bdf8' }}>3,890</div>
            <span style={{ fontSize: '10px', color: '#cbd5e1' }}>Comunidade global</span>
          </div>

          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase' }}>Leads do Simulador</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#f59e0b' }}>1,240</div>
            <span style={{ fontSize: '10px', color: '#cbd5e1' }}>Taxa conversão 34%</span>
          </div>

        </div>

        {/* NAVEGAÇÃO DE ABAS DO ADMIN */}
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#1e293b', padding: '6px', borderRadius: '14px', border: '1px solid #334155', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setAbaAdmin('utilizadores')}
            style={{ flex: 1, minWidth: '130px', backgroundColor: abaAdmin === 'utilizadores' ? '#7c3aed' : 'transparent', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
          >
            👥 Utilizadores
          </button>
          <button 
            onClick={() => setAbaAdmin('leads')}
            style={{ flex: 1, minWidth: '130px', backgroundColor: abaAdmin === 'leads' ? '#7c3aed' : 'transparent', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
          >
            🎯 Leads do Simulador
          </button>
          <button 
            onClick={() => setAbaAdmin('moderacao')}
            style={{ flex: 1, minWidth: '130px', backgroundColor: abaAdmin === 'moderacao' ? '#7c3aed' : 'transparent', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
          >
            🛡️ Moderação Social
          </button>
          <button 
            onClick={() => setAbaAdmin('financeiro')}
            style={{ flex: 1, minWidth: '130px', backgroundColor: abaAdmin === 'financeiro' ? '#7c3aed' : 'transparent', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
          >
            💳 Relatórios & MRR
          </button>
          <button 
            onClick={() => setAbaAdmin('admins')}
            style={{ flex: 1, minWidth: '130px', backgroundColor: abaAdmin === 'admins' ? '#dc2626' : 'transparent', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
          >
            🔑 Gestão de Admins
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        {abaAdmin === 'utilizadores' && (
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>Gestão de Utilizadores (Total: {utilizadores.length})</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => exportarRelatorio('Utilizadores')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>📥 Exportar Relatório</button>
                <button onClick={() => alert("Função de cadastro manual de utilizadores ativada.")} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>+ Novo Utilizador</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {utilizadores.map((u) => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block' }}>{u.nome} ({u.email})</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Plano: {u.plano} • Estado: <b>{u.status}</b> • Valor: {u.faturamento}</span>
                  </div>
                  <button onClick={() => banirUtilizador(u.id)} style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                    {u.status === 'Banido' ? 'Banido' : 'Suspender Conta'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {abaAdmin === 'leads' && (
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>Leads Gerados pelo Simulador de Estresse (Total: {leadsSimulador.length})</h3>
              <button onClick={() => exportarRelatorio('Leads do Simulador')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>📥 Exportar Leads</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {leadsSimulador.map((l) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block' }}>{l.nome} ({l.email}) • {l.whatsapp}</span>
                    <span style={{ fontSize: '11px', color: '#7c3aed' }}>Viés Emocional / Score: <b>{l.score}</b> • Capturado em: {l.data}</span>
                  </div>
                  <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>LEAD ATIVO</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {abaAdmin === 'moderacao' && (
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>Moderação & Monitoramento da Rede Social (Total: 3,890 utilizadores)</h3>
              <button onClick={() => exportarRelatorio('Moderação Social')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>📥 Exportar Relatório Social</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {postsSociais.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block' }}>{p.autor}</span>
                    <p style={{ fontSize: '12px', color: '#334155', margin: '4px 0' }}>{p.conteudo}</p>
                    <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold' }}>Estado: {p.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {p.status === 'Pendente' && (
                      <button onClick={() => aprovarPost(p.id)} style={{ backgroundColor: '#d1fae5', color: '#065f46', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>Aprovar</button>
                    )}
                    <button onClick={() => removerPost(p.id)} style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>Remover</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {abaAdmin === 'financeiro' && (
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>Relatórios Financeiros e Faturamento Recorrente (MRR)</h3>
              <button onClick={() => exportarRelatorio('Financeiro e MRR')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>📥 Exportar Relatório Financeiro</button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', margin: 0 }}>
              Faturamento Recorrente Total Atual (MRR): <b>R$ 142.850,00</b>. Renovações automáticas processadas via API de pagamentos (Planos Starter R$ 99,90, Trader Pro Cripto R$ 149,90 e Institucional Global R$ 199,90).
            </p>
          </div>
        )}

        {abaAdmin === 'admins' && (
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>SEGURANÇA E HIERARQUIA</span>
              <h3 style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0 0 0' }}>Cadastrar Novo Administrador & Atribuir Poderes</h3>
            </div>

            <form onSubmit={criarNovoAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Nome do Administrador" 
                  value={novoAdminNome}
                  onChange={(e) => setNovoAdminNome(e.target.value)}
                  style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#fff', outline: 'none' }} 
                />
                <input 
                  type="email" 
                  placeholder="E-mail de Acesso" 
                  value={novoAdminEmail}
                  onChange={(e) => setNovoAdminEmail(e.target.value)}
                  style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#fff', outline: 'none' }} 
                />
                <input 
                  type="password" 
                  placeholder="Palavra-passe Temporária" 
                  value={novoAdminSenha}
                  onChange={(e) => setNovoAdminSenha(e.target.value)}
                  style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#fff', outline: 'none' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Permissões e Poderes de Acesso:</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={permissoes.geral} onChange={(e) => setPermissoes({...permissoes, geral: e.target.checked})} /> Geral (Master)
                  </label>
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={permissoes.utilizadores} onChange={(e) => setPermissoes({...permissoes, utilizadores: e.target.checked})} /> Gestão de Utilizadores
                  </label>
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={permissoes.moderacao} onChange={(e) => setPermissoes({...permissoes, moderacao: e.target.checked})} /> Moderação Social
                  </label>
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={permissoes.financeiro} onChange={(e) => setPermissoes({...permissoes, financeiro: e.target.checked})} /> Relatórios & Financeiro
                  </label>
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={permissoes.cadastroUsuarios} onChange={(e) => setPermissoes({...permissoes, cadastroUsuarios: e.target.checked})} /> Cadastro de Usuários
                  </label>
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={permissoes.monitoramentoSocial} onChange={(e) => setPermissoes({...permissoes, monitoramentoSocial: e.target.checked})} /> Monitoramento Social
                  </label>
                </div>
              </div>

              <button type="submit" style={{ marginTop: '10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase' }}>
                + Registar Novo Administrador
              </button>
            </form>

            <h4 style={{ fontSize: '15px', fontWeight: '900', margin: '10px 0 0 0' }}>Administradores Ativos no Sistema</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {admins.map((ad) => (
                <div key={ad.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block' }}>{ad.nome} ({ad.email})</span>
                    <span style={{ fontSize: '11px', color: '#7c3aed' }}>Poderes: <b>{ad.perm}</b></span>
                  </div>
                  <span style={{ fontSize: '10px', backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>ATIVO</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RODAPÉ */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '900', color: '#a78bfa', letterSpacing: '2px', textTransform: 'uppercase' }}>JENIOS ADMIN • BACKOFFICE CENTRALIZADO</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Acesso restrito a administradores autorizados.</div>
        </div>

      </div>
    </main>
  );
}