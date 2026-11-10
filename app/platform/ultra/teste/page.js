import PlatformAuthGuard from '../../../components/platform/PlatformAuthGuard';
import UltraRehearsalR126 from '../../../components/platform/UltraRehearsalR126';
export const metadata={title:'Teste sem dinheiro real · Ultra JENIOS',robots:{index:false,follow:false}};
export default function UltraTestPage(){return <PlatformAuthGuard returnTo="/platform/ultra/teste" requireDedicated><UltraRehearsalR126/></PlatformAuthGuard>;}
