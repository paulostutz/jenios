import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ backgroundColor: '#090d16', color: '#fff', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        
        {/* Cabeçalho */}
        <div style={{ marginBottom: '40px' }}>
          <span style={{ backgroundColor: '#1a233a', color: '#8b5cf6', padding: '6px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
            JENIOS ECOSSISTEMA HFT
          </span>
          <h1 style={{ fontSize: '36px', marginTop: '15px', fontWeight: 'bold' }}>
            O Shopping do Crédito Seguro e Inteligente
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px', marginTop: '10px' }}>
            Selecione o módulo desejado para iniciar a operação.
          </p>
        </div>

        {/* Grelha de Acessos / Módulos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', textAlign: 'left' }}>
          
          {/* Card Plataforma / Dashboard */}
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px', transition: 'border-color 0.2s', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>🚀 Plataforma Principal</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Aceder ao painel operacional e de monitoramento HFT.</p>
            </div>
          </Link>

          {/* Card Social */}
          <Link href="/social" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>🌐 Comunidade Social</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Interaja com outros operadores e visualize feeds.</p>
            </div>
          </Link>

          {/* Card Ranking */}
          <Link href="/ranking" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>🏆 Ranking de Performance</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Consulte a tabela de classificação dos traders.</p>
            </div>
          </Link>

          {/* Card Suporte */}
          <Link href="/suporte" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>💬 Suporte Técnico</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Canais de atendimento e ajuda especializada.</p>
            </div>
          </Link>

          {/* Card Landing Page */}
          <Link href="/lp" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>📊 Apresentação (LP)</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Ver a página de vendas e conversão do ecossistema.</p>
            </div>
          </Link>

          {/* Card Planos */}
          <Link href="/planos" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>💎 Planos e Assinaturas</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Escolha o seu plano de escalabilidade operacional.</p>
            </div>
          </Link>

        </div>

      </div>
    </main>
  );
}