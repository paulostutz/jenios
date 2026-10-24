/** Read-only administrative boundary. No scheduler, provider or trading side effect. */
import {requirePlatformAdmin} from '../admin-permissions.mjs';
import {isRobotR61QaEnabled} from './robot-r61-qa-access.mjs';

export function isRobotR63EvolutionEnabled(env={}) {
  return isRobotR61QaEnabled(env) && env.JENIOS_ROBOT_EVOLUTION_ENABLED==='true';
}
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};

export function createR63AdminReportHandler({getDb,readJournal,env=process.env,now=Date.now}={}) {
  return async function GET(request) {
    if(!isRobotR63EvolutionEnabled(env)) return Response.json({error:'Recurso indisponível.'},{status:404,headers});
    if(request.method!=='GET') return Response.json({error:'Método não permitido.'},{status:405,headers:{...headers,Allow:'GET'}});
    if(!/^Bearer [^\s]+$/i.test(request.headers.get('authorization')||''))
      return Response.json({error:'Entre com sua conta administrativa da Platform.'},{status:401,headers});
    try {
      if(typeof getDb!=='function'||typeof readJournal!=='function') throw Error('R63_DEPENDENCIES_UNAVAILABLE');
      const db=getDb();
      await requirePlatformAdmin(request,db,'platform.admin');
      const directory=env.JENIOS_ROBOT_EVOLUTION_JOURNAL_DIR;
      const key=env.JENIOS_ROBOT_EVOLUTION_JOURNAL_KEY;
      const snapshot=readJournal({directory,key});
      if(snapshot?.schema!=='JENIOS_R63_DURABLE_JOURNAL_V1'||!Array.isArray(snapshot.entries))
        throw Error('R63_INVALID_JOURNAL');
      return Response.json({
        schema:'JENIOS_R63_ADMIN_FEED_V1',adminOnly:true,source:'PRIVATE_RESEARCH_JOURNAL',
        evidenceKind:'SYNTHETIC_FIXTURE',revision:snapshot.revision,
        reports:snapshot.entries.slice(-30).map(entry=>entry.report),
        updatedAt:new Date(now()).toISOString(),productionIntegrationVerified:false,
        operationalDataDisclosureRequired:true,realOrdersSent:0,externalPaperOrdersSent:0,
      },{headers});
    } catch(error) {
      const status=[401,403].includes(error?.status)?error.status:503;
      return Response.json({error:status===403?'Conta sem autorização administrativa na Platform.':
        status===401?'Sessão inválida da Platform.':'Relatórios indisponíveis; nenhum resultado foi presumido.'},{status,headers});
    }
  };
}
