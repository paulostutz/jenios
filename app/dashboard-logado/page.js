'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardLogado() {
  const [diagnosticoFeito, setDiagnosticoFeito] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('geral');

  // Dados do Plano e Permissões de Mercado
  const [dadosFinanceiros] = useState({
    plano: 'Plano Institucional Global (B3 + Cripto + Forex)',
    tipoPlanoEnum: 'institucional', 
    statusAssinatura: 'Ativa (Renovação em 18/11/2026)',
    valorFatura: 'R$ 199,90',
    ganhosAfiliados: 'R$ 3.450,00',
    indicacoesAtivas: 12,
    ganhosCopyTrading: 'R$ 2.180,00',
    estrategiasCopiadasCount: 3
  });

  // Estados de Conexão de APIs
  const [mercadoSelecionado, setMercadoSelecionado] = useState('B3');
  const [corretoraSelecionada, setCorretoraSelecionada] = useState('Nelogica Profit Pro / Plus');
  const [apiKeyCorretora, setApiKeyCorretora] = useState('');
  const [apiSecretCorretora, setApiSecretCorretora] = useState('');
  
  const [corretorasConectadas, setCorretorasConectadas] = useState([
    { id: 1, mercado: 'B3', nome: 'Nelogica Profit Pro', status: 'Conectado e Sincronizado (Latência: 12ms)', ativo: true }
  ]);

  const [nossaApiKeyBridge] = useState('jn_live_bridge_889347192847192_sec');

  useEffect(() => {
    const status = localStorage.getItem('jenios_diagnostico_realizado');
    if (status === 'true') {
      setDiagnosticoFeito(true);
    }
  }, []);

  // Direcionamento corrigido para a Dashboard oficial após validar o Diagnóstico
  const irParaDashboardOuOperar = () => {
    const jaFez = localStorage.getItem('jenios_diagnostico_realizado') === 'true';
    if (!jaFez && !diagnosticoFeito) {
      alert('⚠️ Protocolo Obrigatório: Você precisa concluir o Diagnóstico Comportamental antes de operar.');
      window.location.href = '/diagnostico';
      return;
    }
    window.location.href = '/dashboard';
  };

  const pagarFaturaAtual = () => {
    alert('💳 Fatura de R$ 199,90 processada com sucesso! Assinatura mantida por mais 30 dias.');
  };

  const conectarCorretora = (e) => {
    e.preventDefault();
    if (!apiKeyCorretora) {
      alert('Por favor, insira a Chave de API / Token.');
      return;
    }
    setCorretorasConectadas(prev => [...prev, { id: Date.now(), mercado: mercadoSelecionado, nome: corretoraSelecionada, status: 'Conectado ao Gateway HFT', ativo: true }]);
    setApiKeyCorretora('');
    setApiSecretCorretora('');
    alert(`🚀 Tecnologia JENIOS HFT plugada com sucesso em ${corretoraSelecionada}! As ordens já consomem o saldo real da sua conta.`);
  };

  const manuaisIntegracao = {
    'Nelogica Profit Pro / Plus': {
      titulo: 'Manual de Integração: Nelogica Profit (B3)',
      passos: [
        '1. Abra o seu Profit Pro ou Plus na B3.',
        '2. Vá no menu superior em Ferramentas > Conexões / API.',
        '3. Solicite a geração do Token de Acesso à API Rest / Webhook.',
        '4. Copie a Chave de API gerada pelo Profit e cole nos campos abaixo para habilitar o roteamento automático do robô.'
      ]
    },
    'XP Investimentos': {
      titulo: 'Manual de Integração: XP Investimentos (B3)',
      passos: [
        '1. Acesse o portal web da XP Investimentos com sua conta logada.',
        '2. Vá em Configurações > Minha Conta > Integração via API / Roteamento de Ordens.',
        '3. Gere suas credenciais de API (Client ID / API Key e Secret).',
        '4. Insira as chaves abaixo para autorizar o consumo de saldo e margem da sua conta XP.'
      ]
    },
    'Banco Inter': {
      titulo: 'Manual de Integração: Banco Inter (B3)',
      passos: [
        '1. Acesse o Internet Banking PJ/PF do Banco Inter.',
        '2. No menu de Investimentos & Home Broker, vá em Configurações de API.',
        '3. Emita o certificado digital ou token de API para aplicações externas.',
        '4. Cole a Chave e o Secret nos campos abaixo para conectar a sua conta.'
      ]
    },
    'Binance Futures API': {
      titulo: 'Manual de Integração: Binance Futures (Cripto)',
      passos: [
        '1. Faça login na sua conta Binance e acesse o Gerenciamento de API (API Management).',
        '2. Crie uma nova chave de API rotulada como "Jenios HFT Futures".',
        '3. Habilite obrigatoriamente a permissão de "Enable Futures" (Contratos Futuros).',
        '4. Copie a API Key e a Secret Key fornecidas pela Binance e cole abaixo.'
      ]
    },
    'MetaTrader 5 (MT5 Bridge)': {
      titulo: 'Manual de Integração: MetaTrader 5 / Forex Global',
      passos: [
        '1. Abra o seu terminal MetaTrader 5 fornecido pela corretora.',
        '2. Vá em Ferramentas > Opções > Expert Advisors e marque a opção "Permitir WebRequest para URL".',
        '3. Adicione o endereço do nosso Gateway HFT na lista de URLs permitidas.',
        '4. Insira a sua senha de acesso à conta MT5 e o número da conta abaixo.'
      ]
    }
  };

  const manualAtual = manuaisIntegracao[corretoraSelecionada] || {
    titulo: `Manual de Integração: ${corretoraSelecionada}`,
    passos: [
      '1. Acesse a plataforma da sua corretora ou banco.',
      '2. Gere as credenciais de API nas configurações de segurança/integração.',
      '3. Insira os dados nos campos abaixo para estabelecer a ponte com o Gateway HFT.'
    ]
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9', color: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Sidebar da Dashboard */}
      <aside style={{ width: '260px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>JENIOS HFT</h2>
          <span style={{ fontSize: '11px', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>SALA DE CONTROLE OFICIAL</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button onClick={() => setAbaAtiva('geral')} style={{ textAlign: 'left', background: abaAtiva === 'geral' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'geral' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            📊 Visão Geral
          </button>
          <button onClick={irParaDashboardOuOperar} style={{ textAlign: 'left', background: 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: '#334155', fontSize: '14px', cursor: 'pointer', fontWeight: '600' }}>
            ⚡ Operar
          </button>
          <Link href="/diagnostico" style={{ padding: '10px 14px', borderRadius: '8px', color: '#0284c7', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>
            🧠 Diagnóstico Comportamental
          </Link>
          <Link href="/tendencias" style={{ padding: '10px 14px', borderRadius: '8px', color: '#059669', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>
            🚀 Hub de Tendências
          </Link>
          <Link href="/social" style={{ padding: '10px 14px', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
            🌐 Jenios Social
          </Link>
          <button onClick={() => setAbaAtiva('financeiro')} style={{ textAlign: 'left', background: abaAtiva === 'financeiro' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'financeiro' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            💳 Assinaturas & Faturas
          </button>
          <button onClick={() => setAbaAtiva('afiliados')} style={{ textAlign: 'left', background: abaAtiva === 'afiliados' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'afiliados' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            🤝 Gestão de Afiliados
          </button>
          <button onClick={() => setAbaAtiva('copytrading')} style={{ textAlign: 'left', background: abaAtiva === 'copytrading' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'copytrading' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            📊 Copy Trading & Ganhos
          </button>
          <button onClick={() => setAbaAtiva('apis')} style={{ textAlign: 'left', background: abaAtiva === 'apis' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'apis' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            🔌 Gateway HFT & Manuais
          </button>
        </nav>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <Link href="/" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center', display: 'block', border: '1px solid #cbd5e1' }}>
            🏠 Voltar ao Início
          </Link>
        </div>
      </aside>

      {/* Conteúdo Principal da Dashboard */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        {/* Topo do Usuário */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: '#fff' }}>
              PS
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS ID • {dadosFinanceiros.plano}</span>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Olá, Paulo Stutz Netto</h2>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link href="/social" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              Feed Social
            </Link>
            <Link href="/tendencias" style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '8px', border: '1px solid #d8b4fe' }}>
              🚀 Hub de Tendências
            </Link>
            <button onClick={irParaDashboardOuOperar} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 'bold', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)' }}>
              ⚡ Operar
            </button>
          </div>
        </div>

        {/* ABA: VISÃO GERAL */}
        {abaAtiva === 'geral' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Capital Protegido</span>
                <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>R$ 45.820,00</h3>
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>● Modo Reverso Adaptativo Ativo</span>
              </div>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Plano Contratado</span>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0284c7', margin: '0 0 4px 0' }}>{dadosFinanceiros.plano}</h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Acesso total liberado</span>
              </div>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Ganhos Totais Afiliados & Copy</span>
                <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669', margin: '0 0 4px 0' }}>R$ 5.630,00</h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Disponível para saque imediato</span>
              </div>
            </div>
          </div>
        )}

        {/* ABA: ASSINATURAS & FATURAS */}
        {abaAtiva === 'financeiro' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Gestão de Assinatura & Faturas</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '25px' }}>Acompanhe o estado da sua assinatura profissional e realize pagamentos de faturas pendentes.</p>
            
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <b style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>{dadosFinanceiros.plano}</b>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 'bold' }}>{dadosFinanceiros.statusAssinatura}</span>
                <p style={{ fontSize: '12px', color: '#475569', marginTop: '6px', margin: 0 }}>Valor da próxima fatura: <b>{dadosFinanceiros.valorFatura}</b></p>
              </div>
              <button onClick={pagarFaturaAtual} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                💳 Pagar Fatura / Renovar
              </button>
            </div>
          </div>
        )}

        {/* ABA: GESTÃO DE AFILIADOS */}
        {abaAtiva === 'afiliados' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Programa de Afiliados & Comissões Automáticas</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '25px' }}>
              <b>Como funciona:</b> Compartilhe o seu link exclusivo. O sistema reconhece automaticamente cadastros e assinaturas, creditando comissões em tempo real.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>COMISSÕES TOTAIS GANHAS</span>
                <h3 style={{ fontSize: '22px', color: '#059669', margin: '6px 0 0 0' }}>{dadosFinanceiros.ganhosAfiliados}</h3>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>INDICAÇÕES ATIVAS</span>
                <h3 style={{ fontSize: '22px', color: '#7c3aed', margin: '6px 0 0 0' }}>{dadosFinanceiros.indicacoesAtivas} operadores</h3>
              </div>
            </div>

            <div style={{ backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '12px', color: '#334155', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>O seu link exclusivo de afiliado:</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" readOnly value="https://jenios.com.br/convite/paulo-stutz-netto" style={{ flex: 1, padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#0f172a' }} />
                <button onClick={() => alert('Link copiado!')} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Copiar Link</button>
              </div>
            </div>
          </div>
        )}

        {/* ABA: COPY TRADING & GANHOS */}
        {abaAtiva === 'copytrading' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Copy Trading & Ganhos de Estratégias</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '25px' }}>Verifique os ganhos gerados pelas estratégias que você disponibilizou para cópia e as assinaturas ativas.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>LUCROS COM CÓPIAS DE ESTRATÉGIAS</span>
                <h3 style={{ fontSize: '22px', color: '#059669', margin: '6px 0 0 0' }}>{dadosFinanceiros.ganhosCopyTrading}</h3>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>ESTRATÉGIAS COPIADAS ATIVAS</span>
                <h3 style={{ fontSize: '22px', color: '#0284c7', margin: '6px 0 0 0' }}>{dadosFinanceiros.estrategiasCopiadasCount} ativas</h3>
              </div>
            </div>
          </div>
        )}

        {/* ABA: GATEWAY HFT & APIS */}
        {abaAtiva === 'apis' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Gateway HFT & Conexões (Filtrado pelo seu Plano)</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '25px' }}>
              O seu plano atual (<b>{dadosFinanceiros.plano}</b>) libera acesso aos mercados de <b>B3, Criptoativos e Forex Global</b>. Siga o manual de cada integração abaixo para conectar a sua conta.
            </p>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', marginBottom: '25px' }}>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', display: 'block', marginBottom: '6px', fontFamily: 'monospace' }}>🔑 SUA API KEY DO GATEWAY JENIOS (BRIDGE HFT)</span>
              <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>Utilizada para comunicação direta com o nosso motor de reversão.</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" readOnly value={nossaApiKeyBridge} style={{ flex: 1, padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#0f172a' }} />
                <button onClick={() => alert('Chave de API copiada!')} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Copiar Chave</button>
              </div>
            </div>
            
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', marginBottom: '25px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Contas Ativas no Gateway</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {corretorasConectadas.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', textTransform: 'uppercase' }}>[{c.mercado}]</span>
                      <b style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{c.nome}</b>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>● {c.status}</span>
                    </div>
                    <span style={{ fontSize: '11px', backgroundColor: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold' }}>Ativo</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={conectarCorretora} style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Nova Conexão & Manual de Configuração</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginBottom: '20px' }}>
                
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>MERCADO DISPONÍVEL NO SEU PLANO:</label>
                  <select 
                    value={mercadoSelecionado} 
                    onChange={(e) => {
                      const m = e.target.value;
                      setMercadoSelecionado(m);
                      if (m === 'B3') setCorretoraSelecionada('Nelogica Profit Pro / Plus');
                      if (m === 'Cripto') setCorretoraSelecionada('Binance Futures API');
                      if (m === 'Forex') setCorretoraSelecionada('MetaTrader 5 (MT5 Bridge)');
                    }}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', color: '#0f172a' }}
                  >
                    <option value="B3">B3 (Mini-Índice / Mini-Dólar / Ações)</option>
                    <option value="Cripto">Criptoativos (Binance Futures)</option>
                    <option value="Forex">Forex Global & Índices (MT5)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>CORRETORA / PLATAFORMA:</label>
                  <select 
                    value={corretoraSelecionada} 
                    onChange={(e) => setCorretoraSelecionada(e.target.value)}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', color: '#0f172a' }}
                  >
                    {mercadoSelecionado === 'B3' && (
                      <>
                        <option value="Nelogica Profit Pro / Plus">Nelogica Profit Pro / Plus</option>
                        <option value="XP Investimentos">XP Investimentos</option>
                        <option value="Banco Inter">Banco Inter</option>
                      </>
                    )}
                    {mercadoSelecionado === 'Cripto' && (
                      <option value="Binance Futures API">Binance Futures API</option>
                    )}
                    {mercadoSelecionado === 'Forex' && (
                      <option value="MetaTrader 5 (MT5 Bridge)">MetaTrader 5 (MT5 Bridge)</option>
                    )}
                  </select>
                </div>

                <div style={{ backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: '10px', padding: '16px' }}>
                  <b style={{ fontSize: '12px', color: '#6b21a8', display: 'block', marginBottom: '8px' }}>📖 {manualAtual.titulo}</b>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {manualAtual.passos.map((passo, idx) => (
                      <span key={idx} style={{ fontSize: '11px', color: '#581c87', lineHeight: '1.4' }}>{passo}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>CHAVE DE API (API KEY):</label>
                  <input 
                    type="text" 
                    value={apiKeyCorretora} 
                    onChange={(e) => setApiKeyCorretora(e.target.value)} 
                    placeholder="Cole aqui a API Key gerada" 
                    style={{ width: '100%', padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>CHAVE SECRETA (API SECRET):</label>
                  <input 
                    type="password" 
                    value={apiSecretCorretora} 
                    onChange={(e) => setApiSecretCorretora(e.target.value)} 
                    placeholder="••••••••••••••••••••••••••••••••" 
                    style={{ width: '100%', padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>

              <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                🔌 Conectar Conta e Salvar Credenciais
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}