import PlatformAdminAccess from '../../../../components/platform/PlatformAdminAccess';
import PlatformReversoFinance from '../../../../components/platform/PlatformReversoFinance';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gestão do Reverso · JENIOS Platform', robots: { index: false, follow: false } };

export default function ReversoAdminPage() {
  return <PlatformAdminAccess permission="platform.admin" returnTo="/platform/admin/robos/reverso" requireDedicated>
    <PlatformReversoFinance admin/>
  </PlatformAdminAccess>;
}
