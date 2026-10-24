import PlatformAuthGuard from '../../components/platform/PlatformAuthGuard';
export default function AssistantLayout({children}){return <PlatformAuthGuard returnTo="/platform/assistente">{children}</PlatformAuthGuard>;}
