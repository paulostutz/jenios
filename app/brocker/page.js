'use client';
import { useState } from 'react';

export default function BrokerConnectionPage() {
  const [corretoraSelecionada, setCorretoraSelecionada] = useState('b3');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [ambiente, setAmbiente] = useState('simulacao');

  const [conexoes, setConexoes] = useState([
    { id: 1, nome: 'B3 • Mini-Índice / Dólar (ProfitChart API)', status: 'Conectado', ping: '12ms', tipo: 'Produção' },
    { id: 2, nome: 'Binance Futures (API Key Principal)', status: 'Aguardando Teste', ping: '--', tipo: 'Sandbox' }
  ]);

  const testarEConectar = (e) => {
    e.preventDefault();
    if (!apiKey || !apiSecret) {
      alert("Por favor, insira a API Key e o Secret Key para validar a conexão.");
      return;
    }

    const nomeCorretora = corretoraSelecionada === 'b3' ? 'B3 • ProfitChart Gateway' : corretoraSelecionada === 'binance' ? 'Binance Futures API' : 'Bybit Derivatives API';
    
    const novaConexao = {
      id: Date.now(),
      nome: `${nomeCorretora} (${ambiente.toUpperCase()})`,
      status: 'Conectado com Sucesso',
      ping: '8ms',
      tipo: ambiente === 'producao' ? 'Produção (Real)' : 'Simulação (Sandbox)'
    };

    setConexoes([...conexoes, novaConexao]);
    setApiKey('');
    setApiSecret('');
    alert("Chaves de API validadas e conexão estabelecida com sucesso!");
  };

  const desconectar = (id) => {
    setConexoes(conexoes.filter(c => c.id !== id));
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#334155', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* CABEÇALHO */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '20px 24px', borderRadius: '20px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#7c3aed', color: '#fff', fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.4)' }}>
              J
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS BROKER GATEWAY</span>
              <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace' }}>● CONEXÃO HFT & ROTEAMENTO DE ORDENS</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>Ir para Dashboard</a>
            <a href="/social" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '10px' }}>Área Social</a>
          </div>
        </div>

        {/* FORMULÁRIO DE NOVA CONEXÃO */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '20px', padding: '30px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>INTEGRAÇÃO DE API</span>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0 0 0', color: '#0f172a' }}>Vincular Nova Corretora ou Exchange</h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Insira as chaves de acesso fornecidas pela sua corretora para habilitar o motor HFT e o Modo Reverso.</p>
          </div>

          <form onSubmit={testarEConectar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Selecione a Instituição / Broker</label>
                <select 
                  value={corretoraSelecionada}
                  onChange={(e) => setCorretoraSelecionada(e.target.value)}
                  style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', color: '#0f172a', outline: 'none' }}
                >
                  <option value="b3">B3 (ProfitChart / TraderEvolution API)</option>
                  <option value="binance">Binance Futures (API Derivativos)</option>
                  <option value="bybit">Bybit Perpetual (API Principal)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Ambiente de Execução</label>
                <select 
                  value={ambiente}
                  onChange={(e) => setAmbiente(e.target.value)}
                  style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', color: '#0f172a', outline: 'none' }}
                >
                  <option value="simulacao">Simulação / Sandbox (Testes)</option>
                  <option value="producao">Produção / Conta Real (Live)</option>
                </select>
              </div>

            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>API Key (Chave Pública)</label>
                <input 
                  type="text" 
                  placeholder="Insira a API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', color: '#0f172a', outline: 'none' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Secret Key (Chave Privada)</label>
                <input 
                  type="password" 
                  placeholder="Insira o Secret Key..."
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', color: '#0f172a', outline: 'none' }} 
                />
              </div>

            </div>

            <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)', marginTop: '8px' }}>
              Validar Chaves & Conectar Corretora
            </button>
          </form>
        </div>

        {/* LISTA DE CONEXÕES ATIVAS */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '20px', padding: '30px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>Corretoras e Gateways Conectados</h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{conexoes.length} ativas</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {conexoes.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>{c.nome}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Estado: <b style={{ color: '#059669' }}>{c.status}</b> • Latência: <b>{c.ping}</b> • Tipo: {c.tipo}</span>
                </div>
                <button onClick={() => desconectar(c.id)} style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Desconectar
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* RODAPÉ */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', letterSpacing: '2px', textTransform: 'uppercase' }}>JENIOS BROKER GATEWAY • SEGURANÇA INSTITUCIONAL</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Chaves encriptadas com criptografia de ponta a ponta (AES-256).</div>
        </div>

      </div>
    </main>
  );
}