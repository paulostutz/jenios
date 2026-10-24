import { notFound } from 'next/navigation';
import Link from 'next/link';
import PlatformRobotPrivateEvolutionAdmin from '../../../../components/platform/PlatformRobotPrivateEvolutionAdmin';
import { isRobotR71QaEnabled } from '../../../../../lib/platform/research/robot-r71-access.mjs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Evolução privada dos robôs · JENIOS', robots: { index: false, follow: false } };
export default function PrivateRobotEvolutionPage() {
  if (!isRobotR71QaEnabled(process.env)) notFound();
  // No runtime, database read or administrative data is included in this shell.
  return <main style={{ padding: '24px clamp(16px,4vw,48px)', background: '#f7f9fe', minHeight: '100vh' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto', minWidth: 0 }}>
      <nav style={{ marginBottom: 20 }}><Link href="/platform/homologacao/robos">Voltar à homologação dos robôs</Link></nav>
      <h1 style={{ fontSize: 'clamp(24px,4vw,32px)' }}>Evolução privada em homologação</h1>
      <PlatformRobotPrivateEvolutionAdmin/>
    </div>
  </main>;
}
