import AssistantEntry from '../components/assistant/AssistantEntry';
import PlatformAuthGuard from '../components/platform/PlatformAuthGuard';
export default function DashboardAssistantLayout({children}){return <PlatformAuthGuard returnTo="/dashboard">{children}<AssistantEntry/></PlatformAuthGuard>;}
