import { notFound } from 'next/navigation';
import PlatformRobotAcceptanceConsole from '../../../components/platform/PlatformRobotAcceptanceConsole';
import { isRobotR61QaEnabled } from '../../../../lib/platform/research/robot-r61-qa-access.mjs';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Homologação dos robôs • JENIOS Platform',
  robots: { index: false, follow: false },
};

export default function RobotAcceptancePage() {
  if (!isRobotR61QaEnabled(process.env)) notFound();
  return <PlatformRobotAcceptanceConsole />;
}
