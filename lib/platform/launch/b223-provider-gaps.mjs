/** B223 — provider-specific integration backlog without manufacturing credentials/adapters. */
import {officialBrokerImplementationMatrix} from './b220-provider-implementation-matrix.mjs';
const tasks=Object.freeze({
 profit:['CONFIRM_PROFIT_DLL_LICENSE','INSTALL_WINDOWS_TERMINAL_BRIDGE','AUTHORIZE_VENDOR_DEMO'],
 mt5:['INSTALL_APPROVED_EA_LOCAL_BRIDGE','CONFIRM_BROKER_ACCOUNT_DEMO','TEST_POSITION_RECONCILIATION'],
 ctrader:['REGISTER_OFFICIAL_OAUTH_APP','OBTAIN_DEMO_SCOPE','TEST_SESSION_REVOCATION'],
 ibkr:['CONFIRM_GATEWAY_AND_THIRD_PARTY_ELIGIBILITY','OBTAIN_PAPER_ACCOUNT','AUDIT_GATEWAY_RESTART'],
 kraken:['CONFIRM_SUPPORTED_OFFICIAL_DEMO_MARKET','AUDIT_KEY_SCOPES','RECONCILE_FUTURES_MARGIN']
});
export function buildOfficialConnectorWorklist(){
 return Object.freeze(officialBrokerImplementationMatrix().map(p=>Object.freeze({
  provider:p.provider,phase:p.testAccountReadAdapterImplemented?'READ_ONLY_DEMO_ADAPTER_EXISTS':'GUIDE_ONLY',
  blockers:Object.freeze(p.testAccountReadAdapterImplemented?
   ['REAL_CUSTOMER_TEST_AUTH_REQUIRED','PROVIDER_KEY_SCOPES_UNVERIFIED','EXTERNAL_PAPER_ORDER_CERTIFICATION_PENDING']:
   tasks[p.provider]||['VERIFY_OFFICIAL_PROVIDER_TERMS','OBTAIN_BROKER_PERMISSION','BUILD_AUTHENTICATED_ADAPTER']),
  verifiedExternalAccount:false,supportedForLiveTrading:false,canCustodyFunds:false
 })));
}
