import {notFound} from 'next/navigation';
import Link from 'next/link';
import PlatformRobotCycleAdmin from '../../../../components/platform/PlatformRobotCycleAdmin';
import {isRobotR65CycleEnabled} from '../../../../../lib/platform/research/robot-r65-cycle-access.mjs';
export const dynamic='force-dynamic';
export const metadata={title:'Ciclo de evolução dos robôs · JENIOS',robots:{index:false,follow:false}};
export default function RobotEvolutionCyclePage(){
  if(!isRobotR65CycleEnabled(process.env))notFound();
  return <main style={{padding:'24px clamp(16px,4vw,48px)',background:'#faf9fd',minHeight:'100vh'}}>
    <div style={{maxWidth:1080,margin:'0 auto'}}><nav style={{marginBottom:20}}><Link href="/platform/homologacao/robos">Voltar à homologação dos robôs</Link></nav>
      <PlatformRobotCycleAdmin readOnly showAccessNotice/>
    </div>
  </main>;
}
