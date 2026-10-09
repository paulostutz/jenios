'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  // Não exibe a barra nas páginas públicas de login/cadastro se preferir isolar
  if (pathname === '/login' || pathname === '/cadastro') return null;

  const links = [
    { nome: 'Mesa de Operações', href: '/dashboard' },
    { nome: 'Feed Social', href: '/social' },
    { nome: 'Market & Notícias', href: '/market' },
    { nome: 'Planos', href: '/planos' },
    { nome: 'Meu Perfil', href: '/perfil' }
  ];

  return (
    <header style={{ backgroundColor: '#090d16', borderBottom: '1px solid #1e293b', padding: '15px 20px', position: 'sticky', top: 0, zIndex: 1000, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        
        {/* Logótipo / Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
            ⚡ JENIOS ECOSYSTEM
          </span>
        </div>

        {/* Links de Navegação */}
        <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {links.map((link) => {
            const ativo = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  backgroundColor: ativo ? '#7c3aed' : '#1e293b',
                  color: ativo ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.2s',
                  border: ativo ? '1px solid #7c3aed' : '1px solid transparent'
                }}
              >
                {link.nome}
              </Link>
            );
          })}
        </nav>

      </div>
    </header>
  );
}
