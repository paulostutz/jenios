import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ 
      backgroundColor: '#070a12', 
      color: '#fff', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '40px 20px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
    }}>
      <div style={{ maxWidth: '900px', width: '100%', textAlign: 'center' }}>
        
        {/* Cabeçalho / Emblema */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ 
            width: '45px', 
            height: '45px', 
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '22px', 
            fontWeight: 'bold', 
            color: '#fff', 
            margin: '0 auto 15px auto',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
          }}>
            J
          </div>
          <p style={{ fontSize: '11px', color: '#a78bfa', letterSpacing: '2px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '12px' }}>
            JENIOS ECOSYSTEM • PORTAL DE ENTRADA
          </p>
          <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 10px 0', letterSpacing: '-0.5px' }}>
            Onde deseja entrar hoje?
          </h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 auto', maxWidth: '600px', lineHeight: '1.5' }}>
            Selecione o ambiente desejado para aceder à comunidade gratuita ou ao motor de alta frequência e inteligência adaptativa.
          </p>
        </div>

        {/* Grelha de Acessos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px', marginBottom: '40px', textAlign: 'left' }}>
          
          {/* Card Jenios Social */}
          <div style={{ 
            backgroundColor: '#0f172a', 
            border: '1px solid #1e293b', 
            borderRadius: '16px', 
            padding: '32px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <div>
              <span style={{ 
                display: 'inline-block', 
                backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                color: '#c084fc', 
                fontSize: '11px', 
                fontWeight: '700', 
                padding: '4px 10px', 
                borderRadius: '6px', 
                marginBottom: '16px',
                letterSpacing: '0.5px'
              }}>
                100% GRATUITO
              </span>
              <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: '0 0 12px 0' }}>
                Jenios Social
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0', lineHeight: '1.6' }}>
                Aceda à nossa rede social, salas de inteligência coletiva, radar de baleias em tempo real e interaja com estrategistas profissionais sem custos.
              </p>
            </div>
            <div>
              <Link href="/social" style={{ 
                display: 'block',
                backgroundColor: '#7c3aed', 
                color: '#fff', 
                textAlign: 'center', 
                padding: '14px 20px', 
                borderRadius: '10px', 
                fontWeight: '700', 
                fontSize: '13px',
                textDecoration: 'none',
                boxShadow: '0 4px 15px rgba(124, 58, 237, 0.4)',
                letterSpacing: '0.5px'
              }}>
                ENTRAR NA SOCIAL (CRIAR CONTA GRATUITA) &rarr;
              </Link>
            </div>
          </div>

          {/* Card Plataforma & Motor HFT */}
          <div style={{ 
            backgroundColor: '#0f172a', 
            border: '1px solid #1e293b', 
            borderRadius: '16px', 
            padding: '32px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <div>
              <span style={{ 
                display: 'inline-block', 
                backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                color: '#34d399', 
                fontSize: '11px', 
                fontWeight: '700', 
                padding: '4px 10px', 
                borderRadius: '6px', 
                marginBottom: '16px',
                letterSpacing: '0.5px'
              }}>
                MOTOR HFT & ASSINATURAS
              </span>
              <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: '0 0 12px 0' }}>
                Plataforma & Motor HFT
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0', lineHeight: '1.6' }}>
                Descubra a engenharia reversa adaptativa, faça o seu simulador de estresse operacional e ative a blindagem contra as baleias nos planos profissionais.
              </p>
            </div>
            <div>
              <Link href="/lp" style={{ 
                display: 'block',
                backgroundColor: '#10b981', 
                color: '#052e16', 
                textAlign: 'center', 
                padding: '14px 20px', 
                borderRadius: '10px', 
                fontWeight: '800', 
                fontSize: '13px',
                textDecoration: 'none',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                letterSpacing: '0.5px'
              }}>
                CONHECER A PLATAFORMA (IR PARA A LP) &rarr;
              </Link>
            </div>
          </div>

        </div>

        {/* Rodapé Oficial */}
        <div>
          <p style={{ fontSize: '12px', color: '#f43f5e', fontWeight: '700', letterSpacing: '0.5px', margin: '0 0 6px 0' }}>
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