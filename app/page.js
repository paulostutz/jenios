import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ 
      backgroundColor: '#090d16', 
      color: '#fff', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '40px 20px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
    }}>
      <div style={{ maxWidth: '800px', width: '100%', textAlign: 'center' }}>
        
        {/* Cabeçalho Oficial Jenios */}
        <div style={{ marginBottom: '45px' }}>
          <div style={{ 
            display: 'inline-block', 
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', 
            color: '#fff', 
            padding: '8px 20px', 
            borderRadius: '30px', 
            fontSize: '13px', 
            fontWeight: '650', 
            letterSpacing: '1px',
            marginBottom: '20px',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)'
          }}>
            JENIOS ECOSSISTEMA HFT
          </div>
          <h1 style={{ fontSize: '42px', fontWeight: '800', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
            JENIOS
          </h1>
          <p style={{ fontSize: '18px', color: '#a1a1aa', margin: 0, fontWeight: '400' }}>
            A plataforma que transforma o seu erro em lucro.
          </p>
        </div>

        {/* Pergunta de Direcionamento */}
        <div style={{ marginBottom: '35px' }}>
          <h2 style={{ fontSize: '20px', color: '#e4e4e7', fontWeight: '500', margin: 0 }}>
            Onde você deseja acessar?
          </h2>
        </div>

        {/* Seletores Principais: Plataforma vs Social */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '35px' }}>
          
          {/* Card Jenios Plataforma */}
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <div style={{ 
              backgroundColor: '#111827', 
              border: '1px solid #1f2937', 
              borderRadius: '16px', 
              padding: '36px 28px', 
              transition: 'all 0.3s ease', 
              cursor: 'pointer',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '16px' }}>⚡</div>
              <h3 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: '0 0 10px 0' }}>
                Jenios Plataforma
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 20px 0', lineHeight: '1.5' }}>
                Aceda ao motor HFT, engenharia reversa comportamental e painel de ordens.
              </p>
              <span style={{ color: '#8b5cf6', fontSize: '14px', fontWeight: '600' }}>
                Fazer Login &rarr;
              </span>
            </div>
          </Link>

          {/* Card Jenios Social */}
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <div style={{ 
              backgroundColor: '#111827', 
              border: '1px solid #1f2937', 
              borderRadius: '16px', 
              padding: '36px 28px', 
              transition: 'all 0.3s ease', 
              cursor: 'pointer',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '16px' }}>🌐</div>
              <h3 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: '0 0 10px 0' }}>
                Jenios Social
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 20px 0', lineHeight: '1.5' }}>
                Conecte-se com a comunidade de operadores, feeds de desempenho e salas.
              </p>
              <span style={{ color: '#8b5cf6', fontSize: '14px', fontWeight: '600' }}>
                Fazer Login &rarr;
              </span>
            </div>
          </Link>

        </div>

        {/* Acesso Opcional à Apresentação / LP */}
        <div>
          <Link href="/lp" style={{ color: '#71717a', fontSize: '14px', textDecoration: 'none' }}>
            Ver Apresentação Comercial (LP) &rarr;
          </Link>
        </div>

      </div>
    </main>
  );
}