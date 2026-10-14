'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const COLORS = {
  background: '#f1f5f9',
  card: '#ffffff',
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  purple: '#7c3aed',
  green: '#059669',
  blue: '#0284c7'
};

const MODULES = [
  { id: 'tokens', label: 'Tendências de busca', icon: '↗' },
  { id: 'megapulse', label: 'MegaPulse B3 & Futuros', icon: '▥' },
  { id: 'baleias', label: 'Movimentações de baleias', icon: '◎' }
];

function formatTime(value) {
  if (!value) return 'Aguardando atualização';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Horário indisponível';
  return date.toLocaleString('pt-BR');
}

function StatusBadge({ available }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      padding: '7px 11px',
      fontSize: 11,
      fontWeight: 800,
      color: available ? '#047857' : '#92400e',
      background: available ? '#d1fae5' : '#fef3c7'
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: available ? '#10b981' : '#f59e0b' }} />
      {available ? 'FONTE ONLINE' : 'AGUARDANDO HOMOLOGAÇÃO'}
    </span>
  );
}

export default function TendenciasPage() {
  const [active, setActive] = useState('tokens');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/tendencias', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.mensagem || 'Consulta indisponível');
      setData(payload);
    } catch {
      setError('Não foi possível atualizar as fontes agora.');
      setData((current) => current || {
        disponivel: false,
        atualizadoEm: null,
        fonte: null,
        tokens: [],
        megapulse: [],
        baleias: [],
        modulos: {}
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const moduleStatus = data?.modulos?.[active] || {
    disponivel: false,
    mensagem: 'Fonte ainda não homologada.'
  };
  const rows = moduleStatus.disponivel && Array.isArray(data?.[active]) ? data[active] : [];

  return (
    <main style={{
      minHeight: '100vh',
      padding: '28px 18px 70px',
      background: COLORS.background,
      color: COLORS.ink,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <header style={{
          padding: '24px 28px',
          marginBottom: 20,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 18,
          background: COLORS.card,
          boxShadow: '0 8px 30px rgba(15,23,42,.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: COLORS.purple, fontSize: 11, fontWeight: 900, letterSpacing: 1.4 }}>
                JENIOS INTELLIGENCE
              </div>
              <h1 style={{ margin: '7px 0 5px', fontSize: 'clamp(25px,4vw,38px)' }}>Hub de Tendências</h1>
              <p style={{ margin: 0, maxWidth: 720, color: COLORS.muted, lineHeight: 1.6 }}>
                Dados externos identificados por fonte. Nenhum número demonstrativo é apresentado como informação em tempo real.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/dashboard-logado" style={secondaryLink}>← Sala de Controle</Link>
              <Link href="/social" style={primaryLink}>Voltar à Social</Link>
            </div>
          </div>
        </header>

        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 14,
          marginBottom: 20
        }}>
          <div style={metricCard}>
            <small style={metricLabel}>Fonte ativa</small>
            <strong style={{ fontSize: 19 }}>{data?.fonte || 'Nenhuma fonte disponível'}</strong>
          </div>
          <div style={metricCard}>
            <small style={metricLabel}>Última atualização</small>
            <strong style={{ fontSize: 17 }}>{formatTime(data?.atualizadoEm)}</strong>
          </div>
          <div style={metricCard}>
            <small style={metricLabel}>Política de integridade</small>
            <strong style={{ fontSize: 17, color: COLORS.green }}>Sem dados fictícios</strong>
          </div>
        </section>

        <nav aria-label="Módulos do Hub" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {MODULES.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => setActive(module.id)}
              aria-pressed={active === module.id}
              style={{
                padding: '12px 16px',
                borderRadius: 11,
                border: `1px solid ${active === module.id ? COLORS.purple : COLORS.line}`,
                background: active === module.id ? COLORS.purple : COLORS.card,
                color: active === module.id ? '#fff' : COLORS.ink,
                cursor: 'pointer',
                fontWeight: 800
              }}
            >
              <span aria-hidden style={{ marginRight: 7 }}>{module.icon}</span>{module.label}
            </button>
          ))}
        </nav>

        <section style={{
          minHeight: 330,
          padding: '24px',
          border: `1px solid ${COLORS.line}`,
          borderRadius: 18,
          background: COLORS.card,
          boxShadow: '0 8px 30px rgba(15,23,42,.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>
                {MODULES.find((module) => module.id === active)?.label}
              </h2>
              <p style={{ margin: 0, color: COLORS.muted, fontSize: 13 }}>
                {active === 'tokens'
                  ? 'Ativos em alta nas pesquisas da CoinGecko; não significa lançamento recente, fluxo institucional ou recomendação.'
                  : 'O módulo permanece fechado até que uma fonte verificável seja integrada e homologada.'}
              </p>
            </div>
            <StatusBadge available={Boolean(moduleStatus.disponivel)} />
          </div>

          <div style={{ height: 1, background: COLORS.line, margin: '20px 0' }} />

          {loading ? (
            <p role="status" style={{ color: COLORS.muted }}>Consultando fontes verificáveis...</p>
          ) : error && rows.length === 0 ? (
            <div style={emptyCard}><strong>Atualização indisponível</strong><p>{error}</p><button type="button" onClick={refresh} style={retryButton}>Tentar novamente</button></div>
          ) : !moduleStatus.disponivel ? (
            <div style={emptyCard}>
              <strong>Dados ainda não publicados</strong>
              <p>{moduleStatus.mensagem || 'Fonte ainda não homologada.'}</p>
              <p style={{ fontSize: 12 }}>A JENIOS não preencherá este painel com exemplos apresentados como dados reais.</p>
            </div>
          ) : rows.length === 0 ? (
            <div style={emptyCard}><strong>Nenhum registro disponível nesta atualização.</strong></div>
          ) : (
            <div style={{ display: 'grid', gap: 11 }}>
              {rows.map((item, index) => (
                <article key={item.id || index} style={{
                  display: 'grid',
                  gridTemplateColumns: '50px minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 14,
                  padding: '15px 17px',
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 13,
                  background: '#f8fafc'
                }}>
                  <strong style={{ fontSize: 20, color: COLORS.purple }}>{String(index + 1).padStart(2, '0')}</strong>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nome}</strong>
                    <span style={{ color: COLORS.muted, fontSize: 12 }}>
                      {item.rankingMercado ? `Ranking de mercado #${item.rankingMercado}` : 'Ranking de mercado não informado'}
                    </span>
                  </div>
                  <span style={{ color: COLORS.blue, fontWeight: 900 }}>{item.simbolo}</span>
                </article>
              ))}
            </div>
          )}

          <footer style={{ marginTop: 22, color: COLORS.muted, fontSize: 11, lineHeight: 1.6 }}>
            Atualização automática a cada 60 segundos. Tendências de pesquisa não medem qualidade, segurança, liquidez ou potencial de valorização.
          </footer>
        </section>
      </div>
    </main>
  );
}

const metricCard = {
  display: 'flex',
  minHeight: 92,
  padding: '17px 19px',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 7,
  border: `1px solid ${COLORS.line}`,
  borderRadius: 14,
  background: COLORS.card
};

const metricLabel = {
  color: COLORS.muted,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: 'uppercase'
};

const primaryLink = {
  padding: '10px 15px',
  borderRadius: 9,
  color: '#fff',
  background: COLORS.purple,
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 900
};

const secondaryLink = {
  ...primaryLink,
  color: COLORS.ink,
  background: '#f8fafc',
  border: `1px solid ${COLORS.line}`
};

const emptyCard = {
  padding: 24,
  borderRadius: 13,
  color: COLORS.muted,
  background: '#f8fafc',
  border: `1px dashed ${COLORS.line}`
};

const retryButton = {
  padding: '9px 13px',
  border: 0,
  borderRadius: 8,
  color: '#fff',
  background: COLORS.purple,
  cursor: 'pointer',
  fontWeight: 800
};
