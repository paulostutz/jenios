/** B143 financial contract. Server-only inputs; no API key or payment side effects.
 * Every persistent amount uses integer nanoUSD, NOT floating point USD.
 */
import {PRO_ADDON_TERMS,PRO_ADDON_PACKS,proAddonAmounts} from './pro-addon-catalog.mjs';
import {PRO_PRICING_VERSION,proProviderCost} from './pro-pricing.mjs';
export const PRO_WALLET_VERSION='B143';
export const PRO_WALLET_TABLES=Object.freeze({
 config:'jenios_pro_config_b143',wallets:'jenios_pro_wallets_b143',periods:'jenios_pro_periods_b143',
 requests:'jenios_pro_requests_b143',budgets:'jenios_pro_budgets_b143',quotes:'jenios_pro_quotes_b143',funding:'jenios_pro_funding_b143',quoteOrders:'jenios_pro_quote_orders_b143'
});
export const PRO_WALLET_RPC=Object.freeze({
 reserve:'jenios_pro_reserve_b143',dispatch:'jenios_pro_dispatch_b143',settle:'jenios_pro_settle_b143',
 release:'jenios_pro_release_b143',reconcile:'jenios_pro_reconcile_b143',
 status:'jenios_pro_status_b143',addonQuote:'jenios_pro_create_addon_quote_g46',quote:'jenios_pro_create_quote_b143',prepareTopup:'jenios_pro_prepare_topup_order_b143',bind:'jenios_pro_bind_quote_order_b143',fund:'jenios_pro_confirm_paid_topup_b143'
});
export const MAX_LEDGER_NANO_USD=1_000_000_000_000_000;
const fail=(message,status=503)=>Object.assign(Error(message),{status});
export function ledgerInteger(value,{min=0,max=MAX_LEDGER_NANO_USD}={}){
 // PostgREST may serialize bigint as decimal text. Never accept exponent,
 // whitespace, fractional or lossy values and never silently replace with 0.
 if(typeof value==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(value))value=Number(value);
 if(!Number.isSafeInteger(value)||value<min||value>max)throw fail('Valor financeiro inválido.');
 return value;
}
export function nanoUsdDecimal(value){
 const n=BigInt(ledgerInteger(value));
 return `${n/1_000_000_000n}.${String(n%1_000_000_000n).padStart(9,'0')}`;
}
export function proWalletConfig(row,now=Date.now()){
 if(!row||row.id!==true)return {installed:false,generationEnabled:false,topupsEnabled:false,requiresReconciliation:false};
 const monthlyBudgetMode=row.monthly_budget_mode??'capped';
 if(!['capped','uncapped'].includes(monthlyBudgetMode))throw fail('Política de orçamento inválida.');
 const configuredMonthlyLimit=ledgerInteger(row.monthly_provider_limit_nano_usd,{max:1_000_000_000_000});
 const monthlyProviderLimitNanoUsd=monthlyBudgetMode==='uncapped'?null:configuredMonthlyLimit;
 const monthlyBudgetReady=monthlyBudgetMode==='uncapped'||configuredMonthlyLimit>0;
 const maxRequestProviderNanoUsd=ledgerInteger(row.max_request_provider_nano_usd,{max:50_000_000_000});
 const maxRequestRetailNanoUsd=maxRequestProviderNanoUsd*2;
 const crypto=ledgerInteger(row.crypto_allowance_nano_usd,{max:1_000_000_000_000});
 const global=ledgerInteger(row.global_allowance_nano_usd,{max:1_000_000_000_000});
 const terms=typeof row.commercial_terms_version==='string'&&row.commercial_terms_version.length>=3&&row.commercial_terms_version.length<=100;
 const catalogTopup=row.commercial_terms_version===PRO_ADDON_TERMS&&row.topup_currency==='BRL'&&row.topup_amount_minor===null;
 const configuredTopup=catalogTopup||row.commercial_terms_version!==PRO_ADDON_TERMS&&['BRL','USD'].includes(row.topup_currency)&&Number.isSafeInteger(Number(row.topup_amount_minor))&&Number(row.topup_amount_minor)>=1&&Number(row.topup_amount_minor)<=10_000_000&&terms;
 const requiresReconciliation=row.requires_reconciliation===true;
 const rateAt=Date.parse(row.rates_verified_at);
 const allowedModels=Array.isArray(row.allowed_models)?row.allowed_models.filter(m=>typeof m==='string'&&/^[a-z0-9.-]{3,50}$/.test(m)):[];
 const ratesApproved=row.pricing_approved===true&&Number.isFinite(rateAt)&&rateAt<=now&&now-rateAt<=30*86400_000&&allowedModels.length>0;
 return {installed:true,generationEnabled:row.generation_enabled===true&&!requiresReconciliation&&monthlyBudgetReady&&maxRequestProviderNanoUsd>0&&row.pricing_version===PRO_PRICING_VERSION&&ratesApproved,
  topupsEnabled:row.payments_enabled===true&&configuredTopup&&!requiresReconciliation&&ratesApproved&&row.pricing_version===PRO_PRICING_VERSION&&monthlyBudgetReady,
  requiresReconciliation,pricingVersion:row.pricing_version||null,allowedModels,ratesVerifiedAt:row.rates_verified_at||null,ratesApproved,monthlyBudgetMode,monthlyProviderLimitNanoUsd,maxRequestProviderNanoUsd,maxRequestRetailNanoUsd,
  allowances:{'platform-global-crypto':crypto,'platform-internacional-pro':global},
  topup:{confirmed:configuredTopup,baseCurrency:configuredTopup?row.topup_currency:null,amountMinor:configuredTopup&&!catalogTopup?Number(row.topup_amount_minor):null,termsVersion:terms?row.commercial_terms_version:null,...(catalogTopup?{packs:PRO_ADDON_PACKS}:{})}};
}
export function proReservationMaximum({model,maxInputTokens,maxOutputTokens,tools={}}){
 // A cache write is dearer than a normal input token on both approved models.
 // Reserve the upper bound; settlement always uses actual provider usage.
 const amount=proProviderCost({input_tokens:maxInputTokens,output_tokens:maxOutputTokens,input_tokens_details:{cache_write_tokens:maxInputTokens}},{model,tools});
 return {providerNanoUsd:amount.providerCostNanoUsd,retailNanoUsd:amount.retailDebitNanoUsd,pricingVersion:amount.version};
}
/** Only the backend supplies policy and verified FX. A suggested package never
 * qualifies as policy; neither currency nor amount has an implicit default.
 * FX is BRL per USD multiplied by 1,000,000 (six decimal places).
 */
export function approvedProTopupQuote(policy,{brlMicrosPerUsd,source,sourceAt},now=Date.now()){
 if(!policy?.enabled||!['BRL','USD'].includes(policy.baseCurrency)||typeof policy.termsVersion!=='string'||policy.termsVersion.length<3)
  throw fail('Valor e moeda do pacote ainda não foram aprovados.');
 const amountMinor=ledgerInteger(policy.amountMinor,{min:1,max:10_000_000});
 const fx=ledgerInteger(brlMicrosPerUsd,{min:1_000_000,max:100_000_000});
 const at=Date.parse(sourceAt);
 if(typeof source!=='string'||!/^BCB:[a-z0-9_.-]{1,40}$/i.test(source)||!Number.isFinite(at)||!Number.isFinite(now)||at>now||now-at>72*3600_000)
  throw fail('Câmbio verificável indisponível ou vencido.');
 const retail=policy.baseCurrency==='USD'?BigInt(amountMinor)*10_000_000n:BigInt(amountMinor)*10_000_000_000_000n/BigInt(fx);
 const cents=policy.baseCurrency==='BRL'?BigInt(amountMinor):(retail*BigInt(fx)+9_999_999_999_999n)/10_000_000_000_000n;
 const retailNanoUsd=ledgerInteger(Number(retail),{min:1});
 const amountCents=ledgerInteger(Number(cents),{min:1,max:100_000_000});
 return Object.freeze({productCode:'social-ai-pro-credits',currency:'BRL',amountCents,retailNanoUsd,
  baseCurrency:policy.baseCurrency,baseAmountMinor:amountMinor,termsVersion:policy.termsVersion,
  fxBrlMicrosPerUsd:fx,rateSource:source,rateAt:new Date(at).toISOString(),
  expiresAt:new Date(now+15*60_000).toISOString(),pricingVersion:PRO_PRICING_VERSION});
}

export function approvedProAddonQuote(policy,packCode,fx,now=Date.now()){
 if(policy?.termsVersion!==PRO_ADDON_TERMS||policy.baseCurrency!=='BRL'||policy.amountMinor!==null)
  throw fail('Catálogo de adicionais ainda não aprovado.');
 const pack=proAddonAmounts(packCode,fx.brlMicrosPerUsd);
 const checked=approvedProTopupQuote({...policy,amountMinor:pack.providerCapacityBrlCents},fx,now);
 return Object.freeze({...checked,packCode:pack.code,providerCapacityBrlCents:pack.providerCapacityBrlCents,
  providerCapacityNanoUsd:pack.providerCapacityNanoUsd,amountCents:pack.priceCents,retailNanoUsd:pack.retailNanoUsd});
}
