/** B220 — derived from the EXISTING official provider registry. No new broker API. */
import {providerPaths} from '../connections/provider-paths.mjs';
const READ_ONLY=new Set(['alpaca','binance']);
export function officialBrokerImplementationMatrix(){
 const specs=providerPaths();
 if(specs.length!==12||new Set(specs.map(p=>p.provider)).size!==12)
  throw Error('B220_PROVIDER_REGISTRY_MISMATCH');
 return Object.freeze(specs.map(p=>Object.freeze({
  provider:p.provider,transport:p.kind,environment:p.environment,
  requiresTerminal:p.needsTerminal,requiresSeparateCustomerConsent:true,
  officialApiOrLicensedTerminalRequired:true,guideReady:p.guideReady===true,
  testAccountReadAdapterImplemented:READ_ONLY.has(p.provider),
  paperOrderSendRuntimeAvailable:false,realAccountExecutionCertified:false,
  externalAccountAuthenticatedByCatalog:false,productionTradingAllowed:false,
  withdrawalsAllowed:false,custody:false,
  nextGate:READ_ONLY.has(p.provider)?'AUTHENTICATE_TEST_ACCOUNT_WITH_OWNER_AND_AUDIT_KEY_SCOPE':
   p.next?.toUpperCase()||'OFFICIAL_PROVIDER_PERMISSION_AND_LICENSE_REQUIRED'
 })));
}
