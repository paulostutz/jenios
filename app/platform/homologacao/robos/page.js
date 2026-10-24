import { notFound } from 'next/navigation';
import Link from 'next/link';
import PlatformRobotAcceptanceConsole from '../../../components/platform/PlatformRobotAcceptanceConsole';
import { isRobotR61QaEnabled } from '../../../../lib/platform/research/robot-r61-qa-access.mjs';
import { isRobotR63EvolutionEnabled } from '../../../../lib/platform/research/robot-r63-admin-access.mjs';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Homologação dos robôs • JENIOS Platform',
  robots: { index: false, follow: false },
};

export default function RobotAcceptancePage() {
  if (!isRobotR61QaEnabled(process.env)) notFound();
  return <>{isRobotR63EvolutionEnabled(process.env)?<nav style={{padding:'14px 24px',background:'#f5f3ff'}}><Link href="/platform/homologacao/robos/evolucao">Observação e melhoria contínua · prévia administrativa</Link></nav>:null}<PlatformRobotAcceptanceConsole /></>;
}
