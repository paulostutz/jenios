/** B171: technical transport map, NOT executable integrations or broker permissions.
 * A single guide may represent several different broker contractual arrangements.
 */
import {CONNECTION_GUIDES} from './catalog.mjs';
const rules={
 binance:{kind:'signed_rest',authentication:'api_key_hmac',environment:'spot_testnet',next:'authenticate_testnet_account_and_audit_key_permissions',needsTerminal:false},
 alpaca:{kind:'rest',authentication:'api_key_secret',environment:'paper',next:'authenticate_paper_account_and_verify_permissions',needsTerminal:false},
 profit:{kind:'windows_terminal',authentication:'licensed_profit_dll',environment:'vendor_demo_required',next:'confirm_profit_license_routing_and_windows_bridge',needsTerminal:true},
 genial:{kind:'broker_via_terminal',authentication:'broker_and_profit_entitlement',environment:'broker_demo_required',next:'confirm_genial_broker_and_terminal_entitlements',needsTerminal:true},
 clear:{kind:'broker_via_terminal',authentication:'broker_and_profit_entitlement',environment:'broker_demo_required',next:'confirm_clear_broker_and_terminal_entitlements',needsTerminal:true},
 xp:{kind:'broker_via_terminal',authentication:'broker_and_profit_entitlement',environment:'broker_demo_required',next:'confirm_xp_broker_and_terminal_entitlements',needsTerminal:true},
 btg:{kind:'broker_via_terminal',authentication:'broker_and_profit_entitlement',environment:'broker_demo_required',next:'confirm_btg_broker_and_terminal_entitlements',needsTerminal:true},
 mt5:{kind:'terminal_bridge',authentication:'terminal_login_or_broker_extension',environment:'terminal_demo_required',next:'build_signed_local_ea_and_broker_position_reconciliation',needsTerminal:true},
 ctrader:{kind:'oauth_websocket',authentication:'oauth2_accounts_then_trading_scope',environment:'demo_host_separate',next:'register_app_and_authorize_demo_account_scope',needsTerminal:false},
 ibkr:{kind:'client_portal_or_approved_vendor',authentication:'gateway_or_approved_oauth',environment:'paper_requires_account',next:'verify_individual_gateway_vs_third_party_eligibility',needsTerminal:true},
 'mercado-bitcoin':{kind:'oauth_rest',authentication:'client_credentials',environment:'sandbox_not_certified',next:'verify_key_scopes_and_test_environment_before_authenticated_use',needsTerminal:false},
 kraken:{kind:'signed_rest',authentication:'api_key_signature',environment:'spot_test_environment_not_certified',next:'verify_eligible_market_and_provider_demo_before_credentials',needsTerminal:false}
};
const required=['kind','authentication','environment','next','needsTerminal'];
export function providerPaths(){
 const ids=CONNECTION_GUIDES.map(x=>x.id);
 if(ids.length!==12||ids.some(id=>!Object.hasOwn(rules,id))||Object.keys(rules).length!==12)throw Error('PROVIDER_REGISTRY_DRIFT');
 return ids.map(id=>Object.freeze({provider:id,...Object.fromEntries(required.map(key=>[key,rules[id][key]])),
  guideReady:true,authenticatedProduction:false,paperOrdersCertified:false,withdrawalApi:false,custody:false,
  capability:id==='binance'||id==='alpaca'?'read_only_demo_implemented_not_authenticated':'guide_only',
  externalPermissionRequired:true}));
}
export function providerPath(id){return providerPaths().find(x=>x.provider===id)||null;}
