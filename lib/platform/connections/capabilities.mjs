/** B170: public factual connector capabilities. No secrets, no broker calls or trading permissions. */
import {CONNECTION_GUIDES} from './catalog.mjs';
import {demoEnabled} from './demo-service.mjs';
const pilot=new Map([['binance','testnet'],['alpaca','paper']]);
export function brokerCapabilities(env=process.env){
 const demoReady=demoEnabled(env);
 return Object.freeze({
  schema:'JENIOS_B170_BROKER_CAPABILITIES',
  custody:false,withdrawals:false,realOrderExecution:false,demoOrderExecution:false,
  connections:CONNECTION_GUIDES.map(g=>Object.freeze({
   provider:g.id,guideAvailable:true,guideUrl:'/integracoes?provider='+encodeURIComponent(g.id),
   integrationStage:pilot.has(g.id)?'demo_read_only_implementation':'guide_only',
   supportedDemoEnvironment:pilot.get(g.id)||null,
   demoReadOnlyApiImplemented:pilot.has(g.id),
   demoReadOnlyAvailable:pilot.has(g.id)&&demoReady,
   providerAccountAuthenticatedByJenios:false,
   brokerApiPermissionAuditCertified:false,
   orderExecutionEnabled:false,withdrawalsEnabled:false,
   requiresCustomerConsent:true,
   authentication:g.authentication
  }))
 });
}
