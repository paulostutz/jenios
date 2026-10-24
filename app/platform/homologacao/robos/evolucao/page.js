import {notFound} from 'next/navigation';
import PlatformRobotEvolutionPreview from '../../../../components/platform/PlatformRobotEvolutionPreview';
import {isRobotR63EvolutionEnabled} from '../../../../../lib/platform/research/robot-r63-admin-access.mjs';

export const dynamic='force-dynamic';
export const metadata={title:'Evolução dos robôs • JENIOS Platform',robots:{index:false,follow:false}};
export default function RobotEvolutionPreviewPage(){
  if(!isRobotR63EvolutionEnabled(process.env))notFound();
  return <PlatformRobotEvolutionPreview/>;
}
