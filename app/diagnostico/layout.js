import PlatformAuthGuard from '../components/platform/PlatformAuthGuard';
export default function DiagnosticLayout({children}){return <PlatformAuthGuard returnTo="/diagnostico">{children}</PlatformAuthGuard>;}
