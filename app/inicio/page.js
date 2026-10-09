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
      <div style={{ maxWidth: '850px', width: '100%', textAlign: 'center' }}>
        
        {/* Cabeçalho Oficial Jenios */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ 
            display: 'inline-block', 
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', 
            color: '#fff', 
            padding: '6px 18px', 
            borderRadius: '30px', 
            fontSize: '12px', 
            fontWeight: '600', 
            letterSpacing: '0.5px',
            marginBottom: '15px',
            boxShadow: '0 4px 15px rgba(168, 85, 247, 0.25)'
          }}>
            JENIOS ECOSSISTEMA HFT
          </div>
          
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>⚡ ⇄</div>
          
          <h1 style={{ fontSize: '38px', fontWeight: '800', margin: '0 0 10px 0', letterSpacing: '-0.5px' }}>
            JENIOS
          </h1>
          <p style={{ fontSize: '16px', color: '#a1a1aa', margin: '0 0 15px 0', fontWeight: '400' }}>
            A PLATAFORMA QUE TRANSFORMA SEU ERRO EM LUCRO
          </p>
          <p style={{ fontSize: '13px', color: '#c084fc', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', margin: 0 }}>
            ⚡ TECNOLOGIA DE RETIFICAÇÃO COMPORTAMENTAL ADAPTATIVA
          </p>
        </div>

        {/* Título de Secção */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '26px', color: '#fff', fontWeight: '700', margin: '0 0 8px 0' }}>
            Ecossistema Integrado
          </h2>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
            Mais de 90% dos comerciantes perdem dinheiro porque o mercado foi atraído para capturar o seu emocional. Escolha sua porta de entrada.
          </p>
        </div>

        {/* Portas de Entrada: Social vs Plataforma */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '30px' }}>
          
          {/* Card Jenios Social */}
          <div style={{ 
            backgroundColor: '#0d1322', 
            border: '1px solid #1e293b', 
            borderRadius: '16px', 
            padding: '32px 24px', 
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <h3 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: '0 0 12px 0' }}>
                Jenios Social
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0', lineHeight: '1.5' }}>
                Participe da rede social aberta, consuma conteúdos de mercado, interaja com comunidades e descubra ideias.
              </p>
            </div>
            <div>
              <Link href="/login" style={{ 
                display: 'block',
                backgroundColor: '#9333ea', 
                color: '#fff', 
                textAlign: 'center', 
                padding: '12px 20px', 
                borderRadius: '8px', 
                fontWeight: '600', 
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(147, 51, 234, 0.4)'
              }}>
                Entrar na Social &rarr;
              </Link>
            </div>
          </div>

          {/* Card Plataforma Jenios */}
          <div style={{ 
            backgroundColor: '#0d1322', 
            border: '1px solid #1e293b', 
            borderRadius: '16px', 
            padding: '32px 24px', 
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <h3 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: '0 0 12px 0' }}>
                Plataforma Jenios
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0', lineHeight: '1.5' }}>
                Acesse o SaaS de retificação comportamental, realize seu diagnóstico e operação com controle total do capital.
              </p>
            </div>
            <div>
              <Link href="/login" style={{ 
                display: 'block',
                backgroundColor: '#10b981', 
                color: '#000', 
                textAlign: 'center', 
                padding: '12px 20px', 
                borderRadius: '8px', 
                fontWeight: '700', 
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}>
                Aceder à Plataform &rarr;
              </Link>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}