import PlatformAuthGuard from '../../components/platform/PlatformAuthGuard';
import PlatformReversoFinance from '../../components/platform/PlatformReversoFinance';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reverso · JENIOS Platform', robots: { index: false, follow: false } };

export default function ReversoPage() {
  return <PlatformAuthGuard returnTo="/platform/reverso" requireDedicated>
    <PlatformReversoFinance/>
  </PlatformAuthGuard>;
}
