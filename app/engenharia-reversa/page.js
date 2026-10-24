'use client';
import { useState } from 'react';

export default function EngenhariaReversaPage() {
  const [logs, setLogs] = useState([]);

  const adicionarExemplo = () => {
    const hora = new Date().toLocaleTimeString('pt-BR');
    setLogs((atuais) => [{
      id: (atuais[0]?.id ?? 0) + 1,
      hora,
      evento: 'Exemplo ilustrativo: revisão de uma intenção após perdas',
      acao: 'Revisar o cenário e decidir manualmente; nenhuma análise de mercado foi realizada.',
      status: 'Exemplo local · nenhuma ordem'
    }, ...atuais].slice(0, 20));
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px 25px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS PLATFORM • DEMONSTRAÇÃO LOCAL
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              Engenharia Reversa Comportamental
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', border: '1px solid #cbd5e1' }}>
              ← Voltar à Mesa de Operações
            </a>
          </div>
        </div>

        {/* Caixa Explicativa */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', marginBottom: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>
            Revisão de decisões: exemplo ilustrativo
          </h2>
          <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', marginBottom: '20px' }}>
            Esta demonstração cria exemplos locais para explicar a revisão de uma intenção. Ela não analisa o mercado, não troca seu modo de operação e não envia ordens. Os exemplos não representam lucro, perdas evitadas ou resultados de corretora.
          </p>
          <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', marginBottom: '20px' }}>
            Sem conexão com corretora. Os exemplos existem apenas nesta tela e desaparecem ao recarregar. A validação de pesquisa dos robôs não comprova rentabilidade real.
          </p>
          
          <button
            onClick={adicionarExemplo}
            style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
          >
            Adicionar exemplo ilustrativo
          </button>
        </div>

        {/* Exemplos locais sem execução */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
            EXEMPLOS LOCAIS • SEM EXECUÇÃO
          </span>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>
            Exemplos criados nesta tela
          </h2>

          {logs.length === 0 && (
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
              Nenhum exemplo criado. Use o botão acima para visualizar uma situação ilustrativa, sem sinais ou operações reais.
            </p>
          )}
          <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.map((log) => (
              <div key={log.id} style={{ padding: '15px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', display: 'block', marginBottom: '2px' }}>{log.hora}</span>
                  <b style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '2px' }}>{log.evento}</b>
                  <span style={{ fontSize: '12px', color: '#7c3aed' }}>{log.acao}</span>
                </div>
                <div style={{ backgroundColor: '#ede9fe', color: '#5b21b6', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                  {log.status}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
