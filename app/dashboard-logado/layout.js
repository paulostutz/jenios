import PlatformAuthGuard from '../components/platform/PlatformAuthGuard';
export default function PlatformDashboardLayout({children}){
 return <PlatformAuthGuard>{children}</PlatformAuthGuard>;
}
