import PlatformAuthGuard from '../../components/platform/PlatformAuthGuard';
import PlatformUltraControl from '../../components/platform/PlatformUltraControl';
export const metadata={title:'Ultra · JENIOS Platform',robots:{index:false,follow:false}};
export default function UltraPage(){return <PlatformAuthGuard returnTo="/platform/ultra"><PlatformUltraControl/></PlatformAuthGuard>;}
