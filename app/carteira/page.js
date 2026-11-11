import Link from 'next/link';
import PlatformAuthGuard from '../components/platform/PlatformAuthGuard';
import JeniosUltraOwnerState from '../components/platform/JeniosUltraOwnerState';
export const metadata={title:'Carteira da plataforma · JENIOS',robots:{index:false,follow:false}};
export default function CarteiraPage(){return <PlatformAuthGuard returnTo="/carteira" requireDedicated><main style={{minHeight:'100vh',background:'#10172b',padding:'30px 18px'}}><div style={{maxWidth:1100,margin:'auto'}}><Link href="/platform/ultra" style={{color:'#d0c4ff'}}>Ultra</Link><JeniosUltraOwnerState/></div></main></PlatformAuthGuard>;}
