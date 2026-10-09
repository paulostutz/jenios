'use client';
import { useState } from 'react';

export default function IntegracoesPage() {
  const [apiKey, setApiKey] = useState('jn_live_9f83a7b2e104c99a88f11d');
  const [webhookUrl, setWebhookUrl] = useState('https://api.jenios.com.br/v1/webhooks/asaas');
  const [statusBaaS, setStatusBaaS] = useState(true);
  const [gerado, setGerado] = useState(false);

  const regenerarChave = () => {
    setApiKey('jn_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    setGerado(true);
    setTimeout(() => setGerado(false), 3000);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px 25px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS PLATFORM • INFRAESTRUTURA E API
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              Integrações, BaaS e Webhooks
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '9px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', border: '1px solid #cbd5e1' }}>
              ← Mesa de Operações
            </a>
          </div>
        </div>

        {/* BaaS Status Box */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', marginBottom: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Gateway de Pagamentos & Subcontas BaaS</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Infraestrutura para emissão de cobranças automáticas e notificações personalizadas para clientes.</p>
            </div>
            <span style={{ fontSize: '11px', backgroundColor: statusBaaS ? '#d1fae5' : '#fee2e2', color: statusBaaS ? '#065f46' : '#991b1b', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px' }}>
              {statusBaaS ? '🟢 Gateway Operacional' : '🔴 Pausado'}
            </span>
          </div>
        </div>

        {/* API Keys e Webhooks */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
            🔑 CHAVES DE ACESSO E CREDENCIAIS
          </span>
          <p style={{ fontSize: '13px', color: '#334155', marginBottom: '20px' }}>
            Utilize a sua API Key para autenticar pedidos externos e integrar ferramentas de terceiros à infraestrutura JENIOS.
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '6px' }}>Chave API Privada (Bearer Token)</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                readOnly
                value={apiKey}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box' }}
              />
              <button
                onClick={regenerarChave}
                style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Regenerar Chave
              </button>
            </div>
            {gerado && (
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', display: 'block', marginTop: '6px' }}>
                ✅ Nova chave gerada com sucesso!
              </span>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '6px' }}>Endpoint Webhook de Notificações</label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

        </div>

      </div>
    </main>
  );
}
