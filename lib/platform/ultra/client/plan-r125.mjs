import {normalizeUltraConfig,assessUltraLeverage,ULTRA_PRODUCT_SCOPE} from '../policy-r125.mjs';
import {ultraRouteSelection} from '../routes-r125.mjs';
import {validateClientPlan as validatePrevious} from './plan.mjs';
export const CLIENT_SCHEMA_R125='JENIOS_ULTRA_CLIENT_PLAN_V2';
const selectedBrokers=config=>[...new Set(config.markets.map(m=>ultraRouteSelection({market:m.id,provider:m.provider}).broker))].sort();
export function exportClientPlanR125(plan){
 if(!plan?.config)throw Error('Guarde a configuração antes de exportar.');
 const config=normalizeUltraConfig(plan.config),assessment=assessUltraLeverage(config);
 if(assessment.requiresAcknowledgement&&plan.risk_acknowledged!==true)throw Error('Confirme a orientação sobre alavancagem.');
 return {schema:CLIENT_SCHEMA_R125,version:'R125',brokers:selectedBrokers(config),productScope:[...ULTRA_PRODUCT_SCOPE],config,riskAcknowledged:assessment.requiresAcknowledgement&&plan.risk_acknowledged===true,credentialLocation:'trader_device',executionAuthorization:false};
}
export function validateClientPlanR125(input){
 if(input?.schema==='JENIOS_ULTRA_CLIENT_PLAN_V1'){if(input.config?.markets?.some(m=>m.id!=='b3'))throw Error('LEGACY_PLAN_REVIEW_REQUIRED');if(input.config?.markets?.some(m=>Object.hasOwn(m,'provider')))throw Error('LEGACY_PLAN_CANNOT_DECLARE_ROUTE');const prior=validatePrevious(input);return exportClientPlanR125({config:{...prior.config,markets:prior.config.markets.map(m=>({...m,provider:'profit'}))},risk_acknowledged:prior.riskAcknowledged});}
 if(!input||input.schema!==CLIENT_SCHEMA_R125||input.version!=='R125'||input.credentialLocation!=='trader_device'||input.executionAuthorization!==false||!Array.isArray(input.brokers)||JSON.stringify(input.productScope)!==JSON.stringify(ULTRA_PRODUCT_SCOPE)||typeof input.riskAcknowledged!=='boolean'||Object.keys(input).some(k=>!['schema','version','brokers','productScope','config','riskAcknowledged','credentialLocation','executionAuthorization'].includes(k)))throw Error('INVALID_CLIENT_PLAN');
 const plan=exportClientPlanR125({config:input.config,risk_acknowledged:input.riskAcknowledged});
 if(JSON.stringify(input.brokers)!==JSON.stringify(plan.brokers))throw Error('INVALID_CLIENT_PLAN_BROKERS');
 return plan;
}
export function clientRoutesR125(input){return validateClientPlanR125(input).config.markets.map(m=>ultraRouteSelection({market:m.id,provider:m.provider}));}
