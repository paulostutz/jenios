import {normalizeUltraConfig,assessUltraLeverage} from '../policy.mjs';
export const CLIENT_SCHEMA='JENIOS_ULTRA_CLIENT_PLAN_V1';
export function exportClientPlan(plan){
 if(!plan||!plan.config)throw Error('Guarde a configuração antes de exportar.');
 const config=normalizeUltraConfig(plan.config),assessment=assessUltraLeverage(config);
 if(assessment.requiresAcknowledgement&&plan.risk_acknowledged!==true)throw Error('Confirme a orientação sobre alavancagem.');
 return {schema:CLIENT_SCHEMA,version:'R116',config,riskAcknowledged:assessment.requiresAcknowledgement&&plan.risk_acknowledged===true,
  credentialLocation:'trader_device',executionAuthorization:false};
}
export function validateClientPlan(input){
 if(!input||input.schema!==CLIENT_SCHEMA||input.version!=='R116'||input.credentialLocation!=='trader_device'||input.executionAuthorization!==false||Object.keys(input).some(k=>!['schema','version','config','riskAcknowledged','credentialLocation','executionAuthorization'].includes(k)))throw Error('INVALID_CLIENT_PLAN');
 return exportClientPlan({config:input.config,risk_acknowledged:input.riskAcknowledged});
}
