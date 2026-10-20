import PlatformAuthGuard from '../components/platform/PlatformAuthGuard';
import AssistantEntry from '../components/assistant/AssistantEntry';
export default function PlatformDashboardLayout({children}){return <><PlatformAuthGuard>{children}</PlatformAuthGuard><AssistantEntry/></>;}
