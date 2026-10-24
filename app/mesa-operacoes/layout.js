import AssistantEntry from '../components/assistant/AssistantEntry';
import PlatformAuthGuard from '../components/platform/PlatformAuthGuard';
export default function MesaAssistantLayout({children}){return <PlatformAuthGuard returnTo="/mesa-operacoes">{children}<AssistantEntry/></PlatformAuthGuard>;}
