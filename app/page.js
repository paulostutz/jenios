import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ 
      backgroundColor: '#070b19', 
      backgroundImage: 'radial-gradient(circle at 50% 15%, rgba(139, 92, 246, 0.18) 0%, rgba(7, 11, 25, 0.92) 65%, #070b19 100%)',
      color: '#f8fafc', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '40px 20px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '920px', width: '100%', textAlign: 'center' }}>
        
        {/* Cabeçalho / Emblema Luminoso */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ 
            width: '52px', 
            height: '52px', 
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', 
            borderRadius: '14px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '22px', 
            fontWeight: 'bold', 
            color: '#fff', 
            margin: '0 auto 16px auto',
            boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)'
          }}>
            J
          </div>
          <p style={{ fontSize: '11px', color: '#c084fc', letterSpacing: '2px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>
            JENIOS ECOSYSTEM • PORTAL DE ENTRADA
          </p>
          <h1 style={{ fontSize: '34px', fontWeight: '800', margin: '0 0 10px 0', letterSpacing: '-0.5px', color: '#fff' }}>
            Onde deseja entrar hoje?
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 auto', maxWidth: '580px', lineHeight: '1.6' }}>
            Selecione o ambiente desejado para aceder à comunidade de alta performance ou ao motor HFT de inteligência adaptativa.
          </p>
        </div>

        {/* Grelha de Acessos com Cartões */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(390px, 1fr))', gap: '24px', marginBottom: '40px', textAlign: 'left' }}>
          
          {/* Card Jenios Social */}
          <div style={{ 
            backgroundColor: '#f8fafc', 
            color: '#0f172a',
            border: '1px solid #e2e8f0', 
            borderRadius: '18px', 
            padding: '32px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div>
              <span style={{ 
                display: 'inline-block', 
                backgroundColor: '#ede9fe', 
                color: '#7c3aed', 
                fontSize: '11px', 
                fontWeight: '800', 
                padding: '5px 10px', 
                borderRadius: '6px', 
                marginBottom: '16px',
                letterSpacing: '0.5px'
              }}>
                100% GRATUITO
              </span>
              <h2 style={{ color: '#0f172a', fontSize: '22px', fontWeight: '800', margin: '0 0 10px 0' }}>
                Jenios Social
              </h2>
              <p style={{ color: '#475569', fontSize: '13.5px', margin: '0 0 28px 0', lineHeight: '1.6' }}>
                Aceda à nossa rede social, salas de inteligência coletiva, radar de baleias em tempo real e interaja com estrategistas profissionais sem custos.
              </p>
            </div>
            <div>
              <Link href="/social" style={{ 
                display: 'block',
                backgroundColor: '#7c3aed', 
                color: '#fff', 
                textAlign: 'center', 
                padding: '14px 18px', 
                borderRadius: '10px', 
                fontWeight: '700', 
                fontSize: '11.5px',
                textDecoration: 'none',
                boxShadow: '0 4px 15px rgba(124, 58, 237, 0.35)',
                whiteSpace: 'nowrap',
                letterSpacing: '0.2px'
              }}>
                ENTRAR NA SOCIAL (CRIAR CONTA) &rarr;
              </Link>
            </div>
          </div>

          {/* Card Plataforma & Motor HFT (Aponstando para /lp) */}
          <div style={{ 
            backgroundColor: '#f8fafc', 
            color: '#0f172a',
            border: '1px solid #e2e8f0', 
            borderRadius: '18px', 
            padding: '32px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div>
              <span style={{ 
                display: 'inline-block', 
                backgroundColor: '#d1fae5', 
                color: '#065f46', 
                fontSize: '11px', 
                fontWeight: '800', 
                padding: '5px 10px', 
                borderRadius: '6px', 
                marginBottom: '16px',
                letterSpacing: '0.5px'
              }}>
                MOTOR HFT & ASSINATURAS
              </span>
              <h2 style={{ color: '#0f172a', fontSize: '22px', fontWeight: '800', margin: '0 0 10px 0' }}>
                Plataforma & Motor HFT
              </h2>
              <p style={{ color: '#475569', fontSize: '13.5px', margin: '0 0 28px 0', lineHeight: '1.6' }}>
                Descubra a engenharia reversa adaptativa, faça o seu simulador de estresse operacional e ative a blindagem contra as baleias nos planos profissionais.
              </p>
            </div>
            <div>
              <Link href="/lp" style={{ 
                display: 'block',
                backgroundColor: '#10b981', 
                color: '#fff', 
                textAlign: 'center', 
                padding: '14px 18px', 
                borderRadius: '10px', 
                fontWeight: '800', 
                fontSize: '11.5px',
                textDecoration: 'none',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                whiteSpace: 'nowrap',
                letterSpacing: '0.2px'
              }}>
                CONHECER A PLATAFORMA (IR PARA A LP) &rarr;
              </Link>
            </div>
          </div>

        </div>

        {/* Rodapé Oficial */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '22px' }}>
          <p style={{ fontSize: '11.5px', color: '#f43f5e', fontWeight: '800', letterSpacing: '0.8px', margin: '0 0 6px 0' }}>
            A PLATAFORMA QUE TRANSFORMA O SEU ERRO EM LUCRO
          </p>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0, letterSpacing: '0.5px' }}>
            JENIOS ECOSYSTEM • Todos os direitos reservados.
          </p>
        </div>

      </div>
    </main>
  );
}