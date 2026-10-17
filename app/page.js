import Link from 'next/link';
import {PLATFORM_SLOGAN} from '../lib/brand/identity.mjs';

export default function Home() {
  return (
    <main className="jenios-portal" style={{ 
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
        <div className="portal-heading" style={{ marginBottom: '40px' }}>
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
            Escolha seu caminho: participe da comunidade gratuita ou conheça a tecnologia adaptativa da JENIOS Platform.
          </p>
        </div>

        <nav className="portal-quick-access" aria-label="Escolha onde entrar">
          <Link className="portal-quick-social" href="/social">Entrar na JENIOS Social <span aria-hidden="true">→</span></Link>
          <Link className="portal-quick-platform" href="/lp">Conheça a Tecnologia JENIOS <span aria-hidden="true">→</span></Link>
        </nav>

        {/* Grelha de Acessos com Cartões */}
        <div className="portal-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(390px, 1fr))', gap: '24px', marginBottom: '40px', textAlign: 'left' }}>
          
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
                Navegue pelas publicações e informações de mercado. Crie sua conta para publicar, seguir pessoas e participar das conversas da comunidade.
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
                Entrar na JENIOS Social &rarr;
              </Link>
            </div>
          </div>

          {/* Card JENIOS Platform (Aponstando para /lp) */}
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
                TECNOLOGIA ADAPTATIVA
              </span>
              <h2 style={{ color: '#0f172a', fontSize: '22px', fontWeight: '800', margin: '0 0 10px 0' }}>
                JENIOS Platform
              </h2>
              <p style={{ color: '#475569', fontSize: '13.5px', margin: '0 0 14px 0', lineHeight: '1.6' }}>
                Conheça a proposta de engenharia reversa adaptativa, o diagnóstico simulado e os métodos de controle de risco da JENIOS Platform. A execução real depende de integração e homologação.
              </p>
              <p style={{ color: '#7c3aed', fontSize: '11px', margin: '0 0 16px 0', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                {PLATFORM_SLOGAN}
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
                Conheça a Tecnologia JENIOS &rarr;
              </Link>
            </div>
          </div>

        </div>

        {/* Rodapé Oficial */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '22px' }}>
          <p style={{ fontSize: '11.5px', color: '#c084fc', fontWeight: '800', letterSpacing: '0.8px', margin: '0 0 6px 0' }}>
            UMA IDENTIDADE · DOIS PRODUTOS COM PROPÓSITOS PRÓPRIOS
          </p>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0, letterSpacing: '0.5px' }}>
            JENIOS ECOSYSTEM • Todos os direitos reservados.
          </p>
        </div>

      </div>
    </main>
  );
}