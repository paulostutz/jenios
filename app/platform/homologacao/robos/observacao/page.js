import {notFound} from 'next/navigation';
import Link from 'next/link';
import PlatformRobotOperationalReport from '../../../../components/platform/PlatformRobotOperationalReport';
import {isRobotR64QaEnabled} from '../../../../../lib/platform/research/robot-r64-access.mjs';
import {createR64Runtime} from '../../../../../lib/platform/research/robot-r64-runtime.mjs';
import {isR64OperationalReport} from '../../../../../lib/platform/research/robot-r64-admin-view.mjs';

export const dynamic='force-dynamic';
export const metadata={title:'Observação dos robôs • JENIOS Platform',robots:{index:false,follow:false}};
export default async function RobotObservationPreviewPage(){
  if(!isRobotR64QaEnabled(process.env))notFound();
  let report=null,error=false,pending=0;
  try{
    const {source,store}=createR64Runtime();
    const rows=await store.readReports({scopeId:source.scopeId,limit:30});
    if(!Array.isArray(rows)||rows.some(row=>row.scopeId!==source.scopeId))throw new Error('R64_SCOPE_INVALID');
    pending=rows.filter(row=>row.status!=='COMPLETED').length;
    const reports=rows.map(row=>row.report).filter(Boolean);
    if(!reports.every(r=>isR64OperationalReport(r)&&r.scopeId===source.scopeId))throw new Error('R64_REPORT_INVALID');
    report=reports.reduce((a,b)=>!a||b.generatedAtMs>a.generatedAtMs?b:a,null);
  }catch{error=true;}
  return <main style={{minHeight:'100vh',padding:'clamp(10px,3vw,28px)',background:'#f2f4fa',fontFamily:'system-ui',color:'#14213b'}}>
    <div style={{maxWidth:960,margin:'0 auto',display:'grid',gap:18,minWidth:0}}>
      <Link href="/platform/homologacao/robos">← Homologação dos robôs</Link>
      <header style={{background:'#211d45',color:'#fff',padding:24,borderRadius:18}}>
        <p style={{fontSize:11,letterSpacing:1.5,color:'#c4b5fd'}}>JENIOS PLATFORM · HOMOLOGAÇÃO</p>
        <h1 style={{fontSize:'clamp(23px,4vw,32px)',margin:'10px 0'}}>Observação com registro durável</h1>
        <p style={{fontSize:14,lineHeight:1.7}}>Esta prévia lê relatórios de QA já persistidos. Ela não cria eventos, não chama a IA e não inicia monitoramento de clientes.</p>
      </header>
      {error?<p role="alert">Registro de QA indisponível. Nenhum relatório foi fabricado.</p>:null}
      {pending>0?<p role="alert">Há {pending} ciclo(s) em processamento ou aguardando reconciliação.</p>:null}
      {!error&&!report?<p role="status">Ainda não há relatório persistido neste escopo de QA.</p>:null}
      {report?<PlatformRobotOperationalReport report={report}/>:null}
    </div>
  </main>;
}
