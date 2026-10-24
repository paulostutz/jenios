import PlatformAuthGuard from '../../components/platform/PlatformAuthGuard';
export default function LearningLayout({children}){return <PlatformAuthGuard returnTo="/platform/aprender">{children}</PlatformAuthGuard>;}
