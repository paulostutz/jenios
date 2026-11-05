import Link from 'next/link';
import PlatformAdminAccess from '../../../../components/platform/PlatformAdminAccess';
import PlatformUltraResearchLab from '../../../../components/platform/PlatformUltraResearchLab';
export const dynamic='force-dynamic';
export const metadata={title:'UltraFast V2 + V3 · JENIOS Platform',robots:{index:false,follow:false}};
export default function UltraFastResearchAdminPage(){
 return <PlatformAdminAccess permission="platform.admin">
  <main style={{minHeight:'100vh',background:'#f2f4fa',padding:'clamp(18px,4vw,40px)',color:'#14213b'}}>
   <div style={{maxWidth:1060,margin:'0 auto',display:'grid',gap:20}}>
    <nav><Link href="/platform/admin/robos" style={{fontSize:13,color:'#6d28d9'}}>← Voltar à administração dos robôs</Link></nav>
    <PlatformUltraResearchLab/>
    <p style={{fontSize:12,color:'#64748b',lineHeight:1.7}}>Interface administrativa de demonstração. Para uso operacional faltam feeds prospectivos, autorização de conta, execução externa homologada e certificação independente. A proteção financeira permanece desligada.</p>
   </div>
  </main>
 </PlatformAdminAccess>;
}