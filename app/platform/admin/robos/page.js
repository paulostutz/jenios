import Link from 'next/link';
import PlatformRobotDefinitiveAdmin from '../../../components/platform/PlatformRobotDefinitiveAdmin';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Administração dos robôs · JENIOS Platform',
  robots: { index: false, follow: false },
};

export default function RobotDefinitiveAdminPage() {
  // The public shell contains no database query, session or administrative feed.
  return <main style={{ minHeight: '100vh', background: '#f2f4fa', color: '#14213b', padding: 'clamp(20px,4vw,45px)', fontFamily: 'system-ui' }}>
    <div style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gap: 24, minWidth: 0 }}>
      <nav aria-label="Navegação administrativa">
        <Link href="/platform/admin" style={{ color: '#6d28d9', fontSize: 14 }}>← Administração da Platform</Link>
      </nav>
      <header>
        <p style={{ color: '#6d28d9', fontWeight: 800, fontSize: 12, letterSpacing: 1.2 }}>JENIOS PLATFORM · ROBÔS</p>
        <h1 style={{ margin: '10px 0', fontSize: 'clamp(27px,4vw,36px)' }}>Administração dos robôs</h1>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.7, maxWidth: 740 }}>
          Acompanhe o banco definitivo, os registros de homologação e a conexão do motor privado.
        </p>
      </header>
      <PlatformRobotDefinitiveAdmin/>
    </div>
  </main>;
}
